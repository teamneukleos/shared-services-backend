import {
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditService } from '../../audit/application/audit.service';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import {
  BusinessUnitRecord,
  DepartmentRecord,
  PositionRecord,
  TeamRecord,
} from '../domain/organisation-structure.types';
import { PrismaOrganisationStructureRepository } from '../infrastructure/prisma-organisation-structure.repository';
import { OrganisationStructureService } from './organisation-structure.service';

describe('OrganisationStructureService', () => {
  const createBusinessUnit = jest.fn();
  const listBusinessUnits = jest.fn();
  const findBusinessUnit = jest.fn();
  const updateBusinessUnit = jest.fn();
  const deleteBusinessUnit = jest.fn();
  const createDepartment = jest.fn();
  const findDepartment = jest.fn();
  const createTeam = jest.fn();
  const findTeam = jest.fn();
  const createPosition = jest.fn();
  const findPosition = jest.fn();
  const deletePosition = jest.fn();
  const record = jest.fn();

  const repository = {
    createBusinessUnit,
    listBusinessUnits,
    findBusinessUnit,
    updateBusinessUnit,
    deleteBusinessUnit,
    createDepartment,
    findDepartment,
    createTeam,
    findTeam,
    createPosition,
    findPosition,
    deletePosition,
  } as unknown as PrismaOrganisationStructureRepository;

  const auditService = { record } as unknown as AuditService;
  let service: OrganisationStructureService;

  const actor: AuthenticatedUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'admin@neukleos.com',
    employeeId: null,
    permissions: [
      'organisation.structure.manage',
      'organisation.structure.read',
    ],
  };

  const businessUnit: BusinessUnitRecord = {
    id: 'bu-1',
    organisationId: 'org-1',
    name: 'Technology',
    code: 'TECH',
    departmentCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const department: DepartmentRecord = {
    id: 'dept-1',
    businessUnitId: 'bu-1',
    businessUnitCode: 'TECH',
    organisationId: 'org-1',
    name: 'Engineering',
    code: 'ENG',
    teamCount: 0,
    positionCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const team: TeamRecord = {
    id: 'team-1',
    departmentId: 'dept-1',
    departmentCode: 'ENG',
    businessUnitId: 'bu-1',
    organisationId: 'org-1',
    name: 'Platform',
    code: 'PLATFORM',
  };

  const position: PositionRecord = {
    id: 'pos-1',
    departmentId: 'dept-1',
    departmentCode: 'ENG',
    businessUnitId: 'bu-1',
    organisationId: 'org-1',
    title: 'Software Engineer',
    code: 'SWE',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    record.mockResolvedValue(undefined);
    service = new OrganisationStructureService(repository, auditService);
  });

  it('creates a business unit scoped to the actor organisation and audits', async () => {
    createBusinessUnit.mockResolvedValue(businessUnit);

    await expect(
      service.createBusinessUnit(actor, {
        name: 'Technology',
        code: 'TECH',
      }),
    ).resolves.toEqual(businessUnit);

    expect(createBusinessUnit).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: 'org-1', code: 'TECH' }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'BusinessUnit',
      }),
    );
  });

  it('rejects access without organisation context', async () => {
    await expect(
      service.listBusinessUnits(
        { ...actor, organisationId: '' },
        { page: 1, size: 20 },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a department under a business unit and audits', async () => {
    createDepartment.mockResolvedValue(department);

    await expect(
      service.createDepartment(actor, {
        businessUnitId: 'bu-1',
        name: 'Engineering',
        code: 'ENG',
      }),
    ).resolves.toEqual(department);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'Department',
      }),
    );
  });

  it('creates a team under a department and audits', async () => {
    createTeam.mockResolvedValue(team);

    await expect(
      service.createTeam(actor, {
        departmentId: 'dept-1',
        name: 'Platform',
        code: 'PLATFORM',
      }),
    ).resolves.toEqual(team);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'Team',
      }),
    );
  });

  it('creates a position under a department and audits', async () => {
    createPosition.mockResolvedValue(position);

    await expect(
      service.createPosition(actor, {
        departmentId: 'dept-1',
        title: 'Software Engineer',
        code: 'SWE',
      }),
    ).resolves.toEqual(position);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        resourceType: 'Position',
      }),
    );
  });

  it('returns not found for missing business units', async () => {
    findBusinessUnit.mockResolvedValue(null);

    await expect(
      service.getBusinessUnit(actor, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a position after loading it for audit', async () => {
    findPosition.mockResolvedValue(position);
    deletePosition.mockResolvedValue(undefined);

    await expect(service.deletePosition(actor, 'pos-1')).resolves.toEqual(
      position,
    );

    expect(deletePosition).toHaveBeenCalledWith('org-1', 'pos-1');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        resourceType: 'Position',
      }),
    );
  });
});
