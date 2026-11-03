import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  IntegrationProvider,
  Prisma,
  RecordStatus,
} from '../../../generated/prisma/client';
import { AuthenticatedPrincipal } from '../domain/authenticated-principal.interface';
import { AuthenticationRepository } from '../domain/authentication.repository';
import {
  CreateRefreshTokenInput,
  RefreshTokenLogoutResult,
  RefreshTokenRotationResult,
} from '../domain/refresh-token.types';

type PrincipalUserRow = {
  id: string;
  organisationId: string;
  officialEmail: string;
  employeeId: string | null;
  roleAssignments: Array<{
    role: {
      permissions: Array<{
        permission: {
          code: string;
        };
      }>;
    };
  }>;
};

@Injectable()
export class PrismaAuthenticationRepository
  implements AuthenticationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findActivePrincipalById(
    userId: string,
    organisationId: string,
  ): Promise<AuthenticatedPrincipal | null> {
    const now = new Date();

    const user = await this.prisma.userAccount.findFirst({
      where: {
        id: userId,
        organisationId,
        status: RecordStatus.ACTIVE,
        organisation: {
          status: RecordStatus.ACTIVE,
        },
      },
      select: this.principalUserSelect(now),
    });

    return user
      ? this.toPrincipal(user as unknown as PrincipalUserRow)
      : null;
  }

  async findActivePrincipalByGoogleSubject(
    subject: string,
  ): Promise<AuthenticatedPrincipal | null> {
    const now = new Date();

    const identity = await this.prisma.externalIdentity.findFirst({
      where: {
        provider: IntegrationProvider.GOOGLE_WORKSPACE,
        subject,
        user: {
          status: RecordStatus.ACTIVE,
          organisation: {
            status: RecordStatus.ACTIVE,
          },
        },
      },
      select: {
        user: {
          select: this.principalUserSelect(now),
        },
      },
    });

    return identity?.user
      ? this.toPrincipal(identity.user as unknown as PrincipalUserRow)
      : null;
  }

  async linkInvitedPrincipalByGoogleIdentity(input: {
    subject: string;
    email: string;
    hostedDomain: string;
  }): Promise<AuthenticatedPrincipal | null> {
    const email = input.email.trim().toLowerCase();
    const subject = input.subject.trim();
    const hostedDomain = input.hostedDomain.trim().toLowerCase();
    const emailDomain = this.emailDomain(email);

    if (!email || !subject || !hostedDomain || emailDomain !== hostedDomain) {
      return null;
    }

    const now = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const candidates = await tx.userAccount.findMany({
          where: {
            officialEmail: { equals: email, mode: 'insensitive' },
            status: { in: [RecordStatus.ACTIVE, RecordStatus.INACTIVE] },
            organisation: { status: RecordStatus.ACTIVE },
            externalIdentities: {
              none: { provider: IntegrationProvider.GOOGLE_WORKSPACE },
            },
          },
          select: { id: true, status: true },
          take: 2,
        });

        if (candidates.length !== 1) {
          return null;
        }

        const candidate = candidates[0];

        await tx.externalIdentity.create({
          data: {
            userId: candidate.id,
            provider: IntegrationProvider.GOOGLE_WORKSPACE,
            subject,
            email,
          },
        });

        if (candidate.status !== RecordStatus.ACTIVE) {
          await tx.userAccount.update({
            where: { id: candidate.id },
            data: { status: RecordStatus.ACTIVE },
          });
        }

        const user = await tx.userAccount.findFirst({
          where: {
            id: candidate.id,
            status: RecordStatus.ACTIVE,
            organisation: { status: RecordStatus.ACTIVE },
          },
          select: this.principalUserSelect(now),
        });

        return user
          ? this.toPrincipal(user as unknown as PrincipalUserRow)
          : null;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async createRefreshToken(
    input: CreateRefreshTokenInput,
  ): Promise<{ id: string }> {
    const created = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        organisationId: input.organisationId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });

    return created;
  }

  async rotateRefreshToken(input: {
    presentedTokenHash: string;
    replacementTokenHash: string;
    replacementExpiresAt: Date;
  }): Promise<RefreshTokenRotationResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findUnique({
        where: { tokenHash: input.presentedTokenHash },
        select: {
          id: true,
          userId: true,
          organisationId: true,
          familyId: true,
          expiresAt: true,
          revokedAt: true,
          replacedById: true,
        },
      });

      if (!existing) {
        return { outcome: 'invalid' };
      }

      const now = new Date();

      if (existing.revokedAt || existing.expiresAt.getTime() <= now.getTime()) {
        return { outcome: 'invalid' };
      }

      if (existing.replacedById) {
        const replacement = await tx.refreshToken.findUnique({
          where: { id: existing.replacedById },
          select: {
            id: true,
            replacedById: true,
            revokedAt: true,
          },
        });

        // Concurrent refresh of the same current token: the winner already created a
        // still-active replacement. Reject without destroying that session.
        // Confirmed reuse: the replacement itself was rotated or revoked later.
        if (
          replacement &&
          (replacement.replacedById !== null || replacement.revokedAt !== null)
        ) {
          await this.revokeFamily(tx, existing.familyId, now);
          return { outcome: 'reuse_detected', familyId: existing.familyId };
        }

        return { outcome: 'concurrent_conflict' };
      }

      const replacement = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          organisationId: existing.organisationId,
          tokenHash: input.replacementTokenHash,
          familyId: existing.familyId,
          expiresAt: input.replacementExpiresAt,
        },
        select: { id: true },
      });

      const claimed = await tx.refreshToken.updateMany({
        where: {
          id: existing.id,
          revokedAt: null,
          replacedById: null,
        },
        data: {
          replacedById: replacement.id,
        },
      });

      if (claimed.count !== 1) {
        await tx.refreshToken.delete({ where: { id: replacement.id } });
        return { outcome: 'concurrent_conflict' };
      }

      return {
        outcome: 'rotated',
        userId: existing.userId,
        organisationId: existing.organisationId,
        familyId: existing.familyId,
        previousTokenId: existing.id,
        replacementTokenId: replacement.id,
      };
    });
  }

  async revokeRefreshTokenFamilyByHash(
    tokenHash: string,
  ): Promise<RefreshTokenLogoutResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.refreshToken.findUnique({
        where: { tokenHash },
        select: {
          familyId: true,
        },
      });

      if (!existing) {
        return 'not_found';
      }

      const revokedCount = await this.revokeFamily(
        tx,
        existing.familyId,
        new Date(),
      );
      return revokedCount > 0 ? 'revoked' : 'already_inactive';
    });
  }

  private async revokeFamily(
    tx: Prisma.TransactionClient,
    familyId: string,
    revokedAt: Date,
  ): Promise<number> {
    const result = await tx.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });

    return result.count;
  }

  private principalUserSelect(now: Date): Prisma.UserAccountSelect {
    return {
      id: true,
      organisationId: true,
      officialEmail: true,
      employeeId: true,
      roleAssignments: {
        where: {
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: {
          role: {
            select: {
              permissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private toPrincipal(user: PrincipalUserRow): AuthenticatedPrincipal {
    const permissions = [
      ...new Set(
        user.roleAssignments.flatMap((assignment) =>
          assignment.role.permissions.map((item) => item.permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      organisationId: user.organisationId,
      email: user.officialEmail,
      employeeId: user.employeeId,
      permissions,
    };
  }

  private emailDomain(email: string): string | undefined {
    const at = email.lastIndexOf('@');
    if (at < 0 || at === email.length - 1) {
      return undefined;
    }
    return email.slice(at + 1).toLowerCase();
  }
}
