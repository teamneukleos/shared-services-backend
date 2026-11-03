import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OrganisationStructureService } from './application/organisation-structure.service';
import { BusinessUnitsController } from './business-units.controller';
import { DepartmentsController } from './departments.controller';
import { PrismaOrganisationStructureRepository } from './infrastructure/prisma-organisation-structure.repository';
import { PositionsController } from './positions.controller';
import { TeamsController } from './teams.controller';

@Module({
  imports: [AuditModule],
  controllers: [
    BusinessUnitsController,
    DepartmentsController,
    TeamsController,
    PositionsController,
  ],
  providers: [
    OrganisationStructureService,
    PrismaOrganisationStructureRepository,
  ],
  exports: [OrganisationStructureService],
})
export class OrganisationModule {}
