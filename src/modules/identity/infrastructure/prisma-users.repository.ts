import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  getPaginationSkipTake,
} from '../../../common/utils/pagination.util';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  IntegrationProvider,
  Prisma,
  RecordStatus,
} from '../../../generated/prisma/client';
import { UserAccountRecord } from '../domain/user.types';

type UserRow = {
  id: string;
  organisationId: string;
  officialEmail: string;
  status: RecordStatus;
  employeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  externalIdentities: Array<{
    id: string;
    provider: IntegrationProvider;
    subject: string;
    email: string | null;
  }>;
};

@Injectable()
export class PrismaUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    organisationId: string;
    officialEmail: string;
    status?: RecordStatus;
    employeeId?: string | null;
  }): Promise<UserAccountRecord> {
    if (input.employeeId) {
      await this.assertLinkableEmployee(
        input.organisationId,
        input.employeeId,
      );
    }

    try {
      const created = await this.prisma.userAccount.create({
        data: {
          organisationId: input.organisationId,
          officialEmail: this.normalizeEmail(input.officialEmail),
          status: input.status ?? RecordStatus.ACTIVE,
          employeeId: input.employeeId ?? null,
        },
        include: this.userInclude(),
      });
      return this.toRecord(created);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async invite(input: {
    organisationId: string;
    officialEmail: string;
    status?: RecordStatus;
    employeeId?: string | null;
    googleSubject?: string;
    googleEmail?: string;
  }): Promise<UserAccountRecord> {
    if (input.employeeId) {
      await this.assertLinkableEmployee(
        input.organisationId,
        input.employeeId,
      );
    }

    const officialEmail = this.normalizeEmail(input.officialEmail);
    const subject = input.googleSubject?.trim();
    const defaultStatus = subject
      ? RecordStatus.ACTIVE
      : RecordStatus.INACTIVE;

    try {
      if (!subject) {
        const created = await this.prisma.userAccount.create({
          data: {
            organisationId: input.organisationId,
            officialEmail,
            status: input.status ?? defaultStatus,
            employeeId: input.employeeId ?? null,
          },
          include: this.userInclude(),
        });
        return this.toRecord(created);
      }

      const googleEmail = this.normalizeEmail(
        input.googleEmail ?? input.officialEmail,
      );

      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.userAccount.create({
          data: {
            organisationId: input.organisationId,
            officialEmail,
            status: input.status ?? defaultStatus,
            employeeId: input.employeeId ?? null,
          },
        });

        await tx.externalIdentity.create({
          data: {
            userId: user.id,
            provider: IntegrationProvider.GOOGLE_WORKSPACE,
            subject,
            email: googleEmail,
          },
        });

        return tx.userAccount.findUniqueOrThrow({
          where: { id: user.id },
          include: this.userInclude(),
        });
      });

      return this.toRecord(created);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async findById(
    organisationId: string,
    userId: string,
  ): Promise<UserAccountRecord | null> {
    const row = await this.prisma.userAccount.findFirst({
      where: { id: userId, organisationId },
      include: this.userInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async list(query: {
    organisationId: string;
    page: number;
    size: number;
    search?: string;
    status?: RecordStatus;
  }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where: Prisma.UserAccountWhereInput = {
      organisationId: query.organisationId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            officialEmail: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.userAccount.count({ where }),
      this.prisma.userAccount.findMany({
        where,
        include: this.userInclude(),
        orderBy: { officialEmail: 'asc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toRecord(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async update(input: {
    organisationId: string;
    userId: string;
    officialEmail?: string;
    status?: RecordStatus;
    employeeId?: string | null;
  }): Promise<UserAccountRecord> {
    const existing = await this.prisma.userAccount.findFirst({
      where: { id: input.userId, organisationId: input.organisationId },
      select: { id: true, employeeId: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (input.employeeId !== undefined) {
      if (input.employeeId === null) {
        // unlink employee — allowed
      } else if (input.employeeId !== existing.employeeId) {
        await this.assertLinkableEmployee(
          input.organisationId,
          input.employeeId,
          input.userId,
        );
      }
    }

    try {
      const updated = await this.prisma.userAccount.update({
        where: { id: input.userId },
        data: {
          ...(input.officialEmail !== undefined
            ? { officialEmail: this.normalizeEmail(input.officialEmail) }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.employeeId !== undefined
            ? { employeeId: input.employeeId }
            : {}),
        },
        include: this.userInclude(),
      });
      return this.toRecord(updated);
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }
  }

  async linkGoogleIdentity(input: {
    organisationId: string;
    userId: string;
    subject: string;
    email?: string;
  }): Promise<UserAccountRecord> {
    const user = await this.prisma.userAccount.findFirst({
      where: { id: input.userId, organisationId: input.organisationId },
      include: {
        externalIdentities: {
          where: { provider: IntegrationProvider.GOOGLE_WORKSPACE },
          select: { id: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.externalIdentities.length > 0) {
      throw new ConflictException(
        'User already has a Google Workspace identity linked',
      );
    }

    try {
      await this.prisma.externalIdentity.create({
        data: {
          userId: user.id,
          provider: IntegrationProvider.GOOGLE_WORKSPACE,
          subject: input.subject.trim(),
          email: input.email
            ? this.normalizeEmail(input.email)
            : this.normalizeEmail(user.officialEmail),
        },
      });
    } catch (error) {
      this.rethrowUniqueConflict(error);
      throw error;
    }

    const refreshed = await this.findById(input.organisationId, input.userId);
    if (!refreshed) {
      throw new NotFoundException('User not found');
    }
    return refreshed;
  }

  async unlinkGoogleIdentity(input: {
    organisationId: string;
    userId: string;
  }): Promise<UserAccountRecord> {
    const user = await this.prisma.userAccount.findFirst({
      where: { id: input.userId, organisationId: input.organisationId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const deleted = await this.prisma.externalIdentity.deleteMany({
      where: {
        userId: user.id,
        provider: IntegrationProvider.GOOGLE_WORKSPACE,
      },
    });
    if (deleted.count === 0) {
      throw new NotFoundException('Google Workspace identity not found');
    }

    const refreshed = await this.findById(input.organisationId, input.userId);
    if (!refreshed) {
      throw new NotFoundException('User not found');
    }
    return refreshed;
  }

  private async assertLinkableEmployee(
    organisationId: string,
    employeeId: string,
    currentUserId?: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organisationId },
      select: {
        id: true,
        userAccount: { select: { id: true } },
      },
    });
    if (!employee) {
      throw new BadRequestException(
        'Employee does not belong to this organisation',
      );
    }
    if (
      employee.userAccount &&
      employee.userAccount.id !== currentUserId
    ) {
      throw new ConflictException(
        'Employee is already linked to another user account',
      );
    }
  }

  private userInclude() {
    return {
      externalIdentities: {
        orderBy: { provider: 'asc' as const },
      },
    } satisfies Prisma.UserAccountInclude;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private rethrowUniqueConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const rawTarget = error.meta?.target;
      const target = Array.isArray(rawTarget)
        ? rawTarget.map(String).join(',')
        : String(rawTarget ?? '');

      if (target.includes('officialEmail') || target.includes('organisationId')) {
        throw new ConflictException(
          'A user with this email already exists in the organisation',
        );
      }
      if (target.includes('employeeId')) {
        throw new ConflictException(
          'Employee is already linked to another user account',
        );
      }
      if (target.includes('provider') || target.includes('subject')) {
        throw new ConflictException(
          'This Google Workspace identity is already linked to a user',
        );
      }
      throw new ConflictException('Unique constraint violation');
    }
  }

  private toRecord(row: UserRow): UserAccountRecord {
    return {
      id: row.id,
      organisationId: row.organisationId,
      officialEmail: row.officialEmail,
      status: row.status,
      employeeId: row.employeeId,
      externalIdentities: row.externalIdentities.map((identity) => ({
        id: identity.id,
        provider: identity.provider,
        subject: identity.subject,
        email: identity.email,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
