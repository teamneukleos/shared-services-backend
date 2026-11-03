import { Module } from '@nestjs/common';
import { AuditService } from './application/audit.service';
import { AUDIT_REPOSITORY } from './domain/audit.repository';
import { PrismaAuditRepository } from './infrastructure/prisma-audit.repository';

@Module({
  providers: [
    AuditService,
    {
      provide: AUDIT_REPOSITORY,
      useClass: PrismaAuditRepository,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
