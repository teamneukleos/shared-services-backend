import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  CreateAuditEntry,
  PersistedAuditEntry,
} from '../domain/audit-entry.interface';
import { AUDIT_REPOSITORY, AuditRepository } from '../domain/audit.repository';
import { sanitizeAuditData } from './sanitize-audit-data';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
    private readonly requestContextService: RequestContextService,
  ) {}

  async record(entry: CreateAuditEntry): Promise<void> {
    if (entry.action === undefined || entry.action === null) {
      throw new BadRequestException('Audit action is required');
    }

    if (typeof entry.resourceType !== 'string') {
      throw new BadRequestException('Audit resourceType is required');
    }

    const resourceType = entry.resourceType.trim();
    if (resourceType.length === 0) {
      throw new BadRequestException('Audit resourceType must not be empty');
    }

    const context = this.requestContextService.getContext();
    const resourceId = this.trimOptional(entry.resourceId);
    const reason = this.trimOptional(entry.reason);
    const actorId =
      entry.actorId !== undefined
        ? this.trimOptional(entry.actorId)
        : context?.userId;
    const organisationId =
      entry.organisationId !== undefined
        ? this.trimOptional(entry.organisationId)
        : context?.organisationId;

    const metadata = this.buildMetadata({
      provided: entry.metadata,
      organisationId,
      reason,
      requestId: context?.requestId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    const persisted: PersistedAuditEntry = {
      action: entry.action,
      entityType: resourceType,
      entityId: resourceId,
      actorUserId: actorId,
      oldValue:
        entry.oldValues === undefined
          ? undefined
          : sanitizeAuditData(entry.oldValues),
      newValue:
        entry.newValues === undefined
          ? undefined
          : sanitizeAuditData(entry.newValues),
      metadata,
    };

    this.logger.log(
      `Recording audit event action=${persisted.action} resourceType=${persisted.entityType}`,
    );

    try {
      await this.auditRepository.create(persisted);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event action=${persisted.action} resourceType=${persisted.entityType}`,
      );
      throw error;
    }
  }

  private trimOptional(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private buildMetadata(input: {
    provided?: Record<string, unknown>;
    organisationId?: string;
    reason?: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Record<string, unknown> | undefined {
    const base: Record<string, unknown> = {
      ...(input.provided ?? {}),
    };

    if (input.organisationId !== undefined) {
      base.organisationId = input.organisationId;
    }

    if (input.reason !== undefined) {
      base.reason = input.reason;
    }

    if (input.requestId !== undefined) {
      base.requestId = input.requestId;
    }

    if (input.ipAddress !== undefined) {
      base.ipAddress = input.ipAddress;
    }

    if (input.userAgent !== undefined) {
      base.userAgent = input.userAgent;
    }

    const sanitized = sanitizeAuditData(base);
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }
}
