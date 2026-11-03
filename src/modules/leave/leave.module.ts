import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LeaveService } from './application/leave.service';
import { PrismaLeaveRepository } from './infrastructure/prisma-leave.repository';
import { LeaveApplicationsController } from './leave-applications.controller';
import { LeaveBalancesController } from './leave-balances.controller';
import { LeaveTypesController } from './leave-types.controller';

@Module({
  imports: [AuditModule],
  controllers: [
    LeaveTypesController,
    LeaveBalancesController,
    LeaveApplicationsController,
  ],
  providers: [LeaveService, PrismaLeaveRepository],
  exports: [LeaveService],
})
export class LeaveModule {}
