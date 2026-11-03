import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaRbacRepository } from './prisma-rbac.repository';

describe('PrismaRbacRepository', () => {
  const roleCreate = jest.fn();
  const roleFindFirst = jest.fn();
  const permissionFindMany = jest.fn();
  const rolePermissionCreateMany = jest.fn();
  const roleAssignmentFindFirst = jest.fn();
  const roleAssignmentCreate = jest.fn();
  const userAccountFindFirst = jest.fn();

  const prisma = {
    role: {
      create: roleCreate,
      findFirst: roleFindFirst,
    },
    permission: {
      findMany: permissionFindMany,
    },
    rolePermission: {
      createMany: rolePermissionCreateMany,
    },
    roleAssignment: {
      findFirst: roleAssignmentFindFirst,
      create: roleAssignmentCreate,
    },
    userAccount: {
      findFirst: userAccountFindFirst,
    },
  } as unknown as PrismaService;

  let repository: PrismaRbacRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaRbacRepository(prisma);
  });

  it('maps unique constraint violations to ConflictException on create', async () => {
    permissionFindMany.mockResolvedValue([]);
    roleCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      repository.createRole({
        organisationId: 'org-1',
        name: 'HR',
        code: 'HR',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unknown permission codes', async () => {
    roleFindFirst.mockResolvedValue({ id: 'role-1' });
    permissionFindMany.mockResolvedValue([]);

    await expect(
      repository.assignPermissions({
        organisationId: 'org-1',
        roleId: 'role-1',
        permissionCodes: ['missing.perm'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate active role assignment', async () => {
    userAccountFindFirst.mockResolvedValue({ id: 'user-2' });
    roleFindFirst.mockResolvedValue({ id: 'role-1' });
    roleAssignmentFindFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      repository.assignRoleToUser({
        organisationId: 'org-1',
        userId: 'user-2',
        roleId: 'role-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
