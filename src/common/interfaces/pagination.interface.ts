export interface PaginationMeta {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationSkipTake {
  skip: number;
  take: number;
}
