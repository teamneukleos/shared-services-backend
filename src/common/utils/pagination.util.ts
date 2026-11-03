import { BadRequestException } from '@nestjs/common';
import {
  PaginatedResult,
  PaginationMeta,
  PaginationSkipTake,
} from '../interfaces/pagination.interface';

const MIN_PAGE = 1;
const MIN_SIZE = 1;
const MAX_SIZE = 100;

function assertValidPageAndSize(page: number, size: number): void {
  if (!Number.isInteger(page) || page < MIN_PAGE) {
    throw new BadRequestException(
      `page must be an integer greater than or equal to ${MIN_PAGE}`,
    );
  }

  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new BadRequestException(
      `size must be an integer between ${MIN_SIZE} and ${MAX_SIZE}`,
    );
  }
}

export function getPaginationSkipTake(
  page: number,
  size: number,
): PaginationSkipTake {
  assertValidPageAndSize(page, size);

  return {
    skip: (page - 1) * size,
    take: size,
  };
}

export function createPaginationMeta(
  page: number,
  size: number,
  totalItems: number,
): PaginationMeta {
  assertValidPageAndSize(page, size);

  if (!Number.isInteger(totalItems) || totalItems < 0) {
    throw new BadRequestException('totalItems must be a non-negative integer');
  }

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / size);

  return {
    page,
    size,
    totalItems,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function createPaginatedResult<T>(
  data: T[],
  page: number,
  size: number,
  totalItems: number,
): PaginatedResult<T> {
  return {
    data,
    meta: createPaginationMeta(page, size, totalItems),
  };
}
