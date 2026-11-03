import { BadRequestException } from '@nestjs/common';
import {
  createPaginatedResult,
  createPaginationMeta,
  getPaginationSkipTake,
} from './pagination.util';

describe('pagination.util', () => {
  describe('getPaginationSkipTake', () => {
    it('returns correct skip and take for the first page', () => {
      expect(getPaginationSkipTake(1, 20)).toEqual({ skip: 0, take: 20 });
    });

    it('returns correct skip and take for later pages', () => {
      expect(getPaginationSkipTake(3, 20)).toEqual({ skip: 40, take: 20 });
      expect(getPaginationSkipTake(2, 50)).toEqual({ skip: 50, take: 50 });
    });

    it('throws for an invalid page', () => {
      expect(() => getPaginationSkipTake(0, 20)).toThrow(BadRequestException);
      expect(() => getPaginationSkipTake(1.5, 20)).toThrow(BadRequestException);
    });

    it('throws for an invalid size', () => {
      expect(() => getPaginationSkipTake(1, 0)).toThrow(BadRequestException);
      expect(() => getPaginationSkipTake(1, 101)).toThrow(BadRequestException);
      expect(() => getPaginationSkipTake(1, 10.5)).toThrow(BadRequestException);
    });
  });

  describe('createPaginationMeta', () => {
    it('builds empty-result metadata', () => {
      expect(createPaginationMeta(1, 20, 0)).toEqual({
        page: 1,
        size: 20,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it('builds exact-page-boundary metadata', () => {
      expect(createPaginationMeta(5, 20, 100)).toEqual({
        page: 5,
        size: 20,
        totalItems: 100,
        totalPages: 5,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('builds partial-final-page metadata', () => {
      expect(createPaginationMeta(3, 20, 45)).toEqual({
        page: 3,
        size: 20,
        totalItems: 45,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('sets previous and next flags correctly', () => {
      expect(createPaginationMeta(1, 10, 25)).toMatchObject({
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
      expect(createPaginationMeta(2, 10, 25)).toMatchObject({
        hasNextPage: true,
        hasPreviousPage: true,
      });
      expect(createPaginationMeta(3, 10, 25)).toMatchObject({
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('throws for an invalid page', () => {
      expect(() => createPaginationMeta(0, 20, 10)).toThrow(
        BadRequestException,
      );
    });

    it('throws for an invalid size', () => {
      expect(() => createPaginationMeta(1, 101, 10)).toThrow(
        BadRequestException,
      );
    });

    it('throws for a negative total', () => {
      expect(() => createPaginationMeta(1, 20, -1)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('createPaginatedResult', () => {
    it('preserves generic result data and builds metadata', () => {
      const data = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ];

      const result = createPaginatedResult(data, 1, 20, 2);

      expect(result.data).toBe(data);
      expect(result.meta).toEqual({
        page: 1,
        size: 20,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
