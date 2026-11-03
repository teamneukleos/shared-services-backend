import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionSyncService } from './application/permission-sync.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { PrismaPermissionRepository } from './infrastructure/prisma-permission.repository';

@Module({
  imports: [AuditModule],
  providers: [
    PermissionsGuard,
    PrismaPermissionRepository,
    PermissionSyncService,
  ],
  exports: [
    PermissionsGuard,
    PrismaPermissionRepository,
    PermissionSyncService,
  ],
})
export class AuthorizationModule {}
