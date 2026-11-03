import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaOrganisationStructureRepository } from './prisma-organisation-structure.repository';

describe('PrismaOrganisationStructureRepository', () => {
  const businessUnitCreate = jest.fn();
  const businessUnitFindFirst = jest.fn();
  const businessUnitDelete = jest.fn();
  const departmentCreate = jest.fn();
  const departmentFindFirst = jest.fn();
  const teamCreate = jest.fn();

  const prisma = {
    businessUnit: {
      create: businessUnitCreate,
      findFirst: businessUnitFindFirst,
      delete: businessUnitDelete,
    },
    department: {
      create: departmentCreate,
      findFirst: departmentFindFirst,
    },
    team: {
      create: teamCreate,
    },
  } as unknown as PrismaService;

  let repository: PrismaOrganisationStructureRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaOrganisationStructureRepository(prisma);
  });

  it('maps unique constraint violations on business unit create', async () => {
    businessUnitCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      repository.createBusinessUnit({
        organisationId: 'org-1',
        name: 'Technology',
        code: 'TECH',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects department create when business unit is outside the organisation', async () => {
    businessUnitFindFirst.mockResolvedValue(null);

    await expect(
      repository.createDepartment({
        organisationId: 'org-1',
        businessUnitId: 'bu-other',
        name: 'Engineering',
        code: 'ENG',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects team create when department is outside the organisation', async () => {
    departmentFindFirst.mockResolvedValue(null);

    await expect(
      repository.createTeam({
        organisationId: 'org-1',
        departmentId: 'dept-other',
        name: 'Platform',
        code: 'PLATFORM',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps restrict violations when deleting a business unit with dependents', async () => {
    businessUnitFindFirst.mockResolvedValue({ id: 'bu-1' });
    businessUnitDelete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('restrict', {
        code: 'P2003',
        clientVersion: 'test',
      }),
    );

    await expect(
      repository.deleteBusinessUnit('org-1', 'bu-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
