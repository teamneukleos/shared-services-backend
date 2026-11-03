import { Injectable } from '@nestjs/common';
import { PaginatedResult } from '../../../common/interfaces/pagination.interface';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../domain/authenticated-user.interface';
import { PERMISSION_CATALOGUE } from '../domain/permission-catalogue';
import { PermissionRecord } from '../domain/permission-record';
import {
  PermissionSyncResult,
  PrismaPermissionRepository,
} from '../infrastructure/prisma-permission.repository';

@Injectable()
export class PermissionSyncService {
  constructor(
    private readonly permissionRepository: PrismaPermissionRepository,
    private readonly auditService: AuditService,
  ) {}

  async syncCatalogue(
    actor: AuthenticatedUser,
  ): Promise<PermissionSyncResult> {
    const result = await this.permissionRepository.syncFromCatalogue(
      PERMISSION_CATALOGUE,
    );

    await this.auditService.record({
      action: AuditAction.IMPORT,
      resourceType: 'PermissionCatalogue',
      resourceId: actor.organisationId,
      actorId: actor.id,
      organisationId: actor.organisationId,
      newValues: {
        created: result.created,
        updated: result.updated,
        total: result.total,
      },
    });

    return result;
  }

  async list(
    query: { page: number; size: number; search?: string },
  ): Promise<PaginatedResult<PermissionRecord>> {
    return this.permissionRepository.list(query);
  }
}
