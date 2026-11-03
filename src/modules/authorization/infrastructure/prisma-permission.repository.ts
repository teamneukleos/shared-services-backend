import { Injectable } from '@nestjs/common';
import {
  createPaginatedResult,
  getPaginationSkipTake,
} from '../../../common/utils/pagination.util';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  PERMISSION_CATALOGUE,
  PermissionCatalogueEntry,
} from '../domain/permission-catalogue';
import { PermissionRecord } from '../domain/permission-record';

export type PermissionSyncResult = {
  created: number;
  updated: number;
  total: number;
};

@Injectable()
export class PrismaPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async syncFromCatalogue(
    entries: readonly PermissionCatalogueEntry[] = PERMISSION_CATALOGUE,
  ): Promise<PermissionSyncResult> {
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = await this.prisma.permission.findUnique({
        where: { code: entry.code },
      });

      if (!existing) {
        await this.prisma.permission.create({
          data: {
            code: entry.code,
            description: entry.description,
          },
        });
        created += 1;
        continue;
      }

      if (existing.description !== entry.description) {
        await this.prisma.permission.update({
          where: { id: existing.id },
          data: { description: entry.description },
        });
        updated += 1;
      }
    }

    return {
      created,
      updated,
      total: entries.length,
    };
  }

  async list(query: { page: number; size: number; search?: string }) {
    const { skip, take } = getPaginationSkipTake(query.page, query.size);
    const search = query.search?.trim();
    const where = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' as const } },
            {
              description: { contains: search, mode: 'insensitive' as const },
            },
          ],
        }
      : {};

    const [totalItems, rows] = await this.prisma.$transaction([
      this.prisma.permission.count({ where }),
      this.prisma.permission.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take,
      }),
    ]);

    return createPaginatedResult(
      rows.map((row) => this.toRecord(row)),
      query.page,
      query.size,
      totalItems,
    );
  }

  async findByCodes(codes: string[]): Promise<PermissionRecord[]> {
    if (codes.length === 0) {
      return [];
    }

    const rows = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: {
    id: string;
    code: string;
    description: string | null;
  }): PermissionRecord {
    return {
      id: row.id,
      code: row.code,
      description: row.description,
    };
  }
}
