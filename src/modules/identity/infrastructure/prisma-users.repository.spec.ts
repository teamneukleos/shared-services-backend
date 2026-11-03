import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrismaUsersRepository } from './prisma-users.repository';

describe('PrismaUsersRepository', () => {
  const userCreate = jest.fn();
  const userFindFirst = jest.fn();
  const userUpdate = jest.fn();
  const externalCreate = jest.fn();
  const externalDeleteMany = jest.fn();
  const employeeFindFirst = jest.fn();
  const transaction = jest.fn();

  const prisma = {
    userAccount: {
      create: userCreate,
      findFirst: userFindFirst,
      update: userUpdate,
    },
    externalIdentity: {
      create: externalCreate,
      deleteMany: externalDeleteMany,
    },
    employee: {
      findFirst: employeeFindFirst,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  let repository: PrismaUsersRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaUsersRepository(prisma);
  });

  it('maps email uniqueness conflicts on create', async () => {
    userCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['organisationId', 'officialEmail'] },
      }),
    );

    await expect(
      repository.create({
        organisationId: 'org-1',
        officialEmail: 'ada@neukleos.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects linking Google when one already exists', async () => {
    userFindFirst.mockResolvedValue({
      id: 'user-1',
      officialEmail: 'ada@neukleos.com',
      externalIdentities: [{ id: 'ext-1' }],
    });

    await expect(
      repository.linkGoogleIdentity({
        organisationId: 'org-1',
        userId: 'user-1',
        subject: 'google-sub',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects unlink when no Google identity exists', async () => {
    userFindFirst.mockResolvedValue({ id: 'user-1' });
    externalDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.unlinkGoogleIdentity({
        organisationId: 'org-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects employee link when employee already has a user', async () => {
    employeeFindFirst.mockResolvedValue({
      id: 'emp-1',
      userAccount: { id: 'other-user' },
    });

    await expect(
      repository.create({
        organisationId: 'org-1',
        officialEmail: 'ada@neukleos.com',
        employeeId: 'emp-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
