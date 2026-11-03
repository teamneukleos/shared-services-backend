import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EmployeesService } from './employees/application/employees.service';
import { EMPLOYEE_REPOSITORY } from './employees/domain/employee.repository';
import { EmployeesController } from './employees/employees.controller';
import { PrismaEmployeeRepository } from './employees/infrastructure/prisma-employee.repository';
import { OnboardingService } from './onboarding/application/onboarding.service';
import { ONBOARDING_REPOSITORY } from './onboarding/domain/onboarding.repository';
import { OnboardingController } from './onboarding/onboarding.controller';
import { PrismaOnboardingRepository } from './onboarding/infrastructure/prisma-onboarding.repository';

@Module({
  imports: [AuditModule],
  controllers: [EmployeesController, OnboardingController],
  providers: [
    EmployeesService,
    {
      provide: EMPLOYEE_REPOSITORY,
      useClass: PrismaEmployeeRepository,
    },
    OnboardingService,
    {
      provide: ONBOARDING_REPOSITORY,
      useClass: PrismaOnboardingRepository,
    },
  ],
  exports: [EmployeesService, OnboardingService],
})
export class HrModule {}
