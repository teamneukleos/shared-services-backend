import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import {
  MAIL_SERVICE,
  MailService,
} from '../../notifications/domain/mail.service';
import {
  CreateUserDto,
  InviteUserDto,
  LinkGoogleIdentityDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from '../dto/users.dto';
import { UserAccountRecord } from '../domain/user.types';
import { PrismaUsersRepository } from '../infrastructure/prisma-users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: PrismaUsersRepository,
    private readonly auditService: AuditService,
    @Inject(MAIL_SERVICE) private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
  ): Promise<UserAccountRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const created = await this.usersRepository.create({
      organisationId,
      officialEmail: dto.officialEmail,
      status: dto.status,
      employeeId: dto.employeeId,
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'UserAccount',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: this.userSnapshot(created),
    });

    return created;
  }

  async invite(
    actor: AuthenticatedUser,
    dto: InviteUserDto,
  ): Promise<UserAccountRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const googleSubject = dto.googleSubject?.trim();
    const created = await this.usersRepository.invite({
      organisationId,
      officialEmail: dto.officialEmail,
      status: dto.status,
      employeeId: dto.employeeId,
      googleSubject,
      googleEmail: dto.googleEmail,
    });

    const appWebUrl = this.configService
      .getOrThrow<string>('email.appWebUrl')
      .replace(/\/$/, '');
    const signInUrl = `${appWebUrl}/sign-in`;

    let inviteEmail;
    try {
      inviteEmail = await this.mailService.sendUserInviteEmail({
        to: created.officialEmail,
        signInUrl,
        invitedByEmail: actor.email,
      });
    } catch (error) {
      await this.auditService.record({
        action: AuditAction.CREATE,
        resourceType: 'UserAccount',
        resourceId: created.id,
        actorId: actor.id,
        organisationId,
        newValues: {
          ...this.userSnapshot(created),
          invite: true,
          ...(googleSubject
            ? { googleSubject }
            : { linkOnFirstGoogleSignIn: true }),
          inviteEmail: { status: 'failed' },
        },
        reason: googleSubject
          ? 'Workspace invite provisioned; invite email failed'
          : 'Workspace email-only invite provisioned; invite email failed',
      });
      throw error;
    }

    await this.auditService.record({
      action: AuditAction.CREATE,
      resourceType: 'UserAccount',
      resourceId: created.id,
      actorId: actor.id,
      organisationId,
      newValues: {
        ...this.userSnapshot(created),
        invite: true,
        ...(googleSubject ? { googleSubject } : { linkOnFirstGoogleSignIn: true }),
        inviteEmail,
      },
      reason: googleSubject
        ? 'Workspace invite: account + Google ExternalIdentity provisioned'
        : 'Workspace invite: email-only account; Google identity links on first sign-in',
    });

    return created;
  }

  async list(
    actor: AuthenticatedUser,
    query: ListUsersQueryDto,
  ): Promise<PaginatedResult<UserAccountRecord>> {
    const organisationId = this.requireOrganisationId(actor);
    return this.usersRepository.list({
      organisationId,
      page: query.page,
      size: query.size,
      search: query.search,
      status: query.status,
    });
  }

  async findOne(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<UserAccountRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const user = await this.usersRepository.findById(organisationId, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserAccountRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.usersRepository.findById(organisationId, userId);
    if (!before) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersRepository.update({
      organisationId,
      userId,
      officialEmail: dto.officialEmail,
      status: dto.status,
      employeeId: dto.employeeId,
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      resourceType: 'UserAccount',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      oldValues: this.userSnapshot(before),
      newValues: this.userSnapshot(updated),
    });

    return updated;
  }

  async linkGoogleIdentity(
    actor: AuthenticatedUser,
    userId: string,
    dto: LinkGoogleIdentityDto,
  ): Promise<UserAccountRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const updated = await this.usersRepository.linkGoogleIdentity({
      organisationId,
      userId,
      subject: dto.subject,
      email: dto.email,
    });

    await this.auditService.record({
      action: AuditAction.ASSIGN,
      resourceType: 'ExternalIdentity',
      resourceId: updated.id,
      actorId: actor.id,
      organisationId,
      newValues: {
        userId,
        provider: 'GOOGLE_WORKSPACE',
        subject: dto.subject.trim(),
        email: dto.email ?? updated.officialEmail,
      },
    });

    return updated;
  }

  async unlinkGoogleIdentity(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<UserAccountRecord> {
    const organisationId = this.requireOrganisationId(actor);
    const before = await this.usersRepository.findById(organisationId, userId);
    if (!before) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.usersRepository.unlinkGoogleIdentity({
      organisationId,
      userId,
    });

    await this.auditService.record({
      action: AuditAction.UNASSIGN,
      resourceType: 'ExternalIdentity',
      resourceId: userId,
      actorId: actor.id,
      organisationId,
      oldValues: {
        identities: before.externalIdentities.filter(
          (item) => item.provider === 'GOOGLE_WORKSPACE',
        ),
      },
      newValues: this.userSnapshot(updated),
    });

    return updated;
  }

  private requireOrganisationId(actor: AuthenticatedUser): string {
    const organisationId = actor.organisationId?.trim();
    if (!organisationId) {
      throw new UnauthorizedException('Organisation context is required');
    }
    return organisationId;
  }

  private userSnapshot(user: UserAccountRecord) {
    return {
      officialEmail: user.officialEmail,
      status: user.status,
      employeeId: user.employeeId,
      externalIdentityProviders: user.externalIdentities.map(
        (item) => item.provider,
      ),
    };
  }
}
