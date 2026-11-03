import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(PaginationQueryDto, plain);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('PaginationQueryDto', () => {
  it('applies default page and size', async () => {
    const { dto, errors } = await validateDto({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.size).toBe(20);
  });

  it('converts string query values to numbers', async () => {
    const { dto, errors } = await validateDto({ page: '3', size: '50' });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.size).toBe(50);
  });

  it('accepts valid values', async () => {
    const { dto, errors } = await validateDto({ page: 2, size: 100 });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.size).toBe(100);
  });

  it('rejects page 0', async () => {
    const { errors } = await validateDto({ page: 0 });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('page');
  });

  it('rejects negative values', async () => {
    const pageResult = await validateDto({ page: -1 });
    const sizeResult = await validateDto({ size: -5 });

    expect(pageResult.errors.length).toBeGreaterThan(0);
    expect(sizeResult.errors.length).toBeGreaterThan(0);
  });

  it('rejects decimal values', async () => {
    const pageResult = await validateDto({ page: 1.5 });
    const sizeResult = await validateDto({ size: 20.2 });

    expect(pageResult.errors.length).toBeGreaterThan(0);
    expect(sizeResult.errors.length).toBeGreaterThan(0);
  });

  it('rejects size above 100', async () => {
    const { errors } = await validateDto({ size: 101 });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.property).toBe('size');
  });

  it('rejects non-numeric values', async () => {
    const pageResult = await validateDto({ page: 'abc' });
    const sizeResult = await validateDto({ size: 'twenty' });

    expect(pageResult.errors.length).toBeGreaterThan(0);
    expect(sizeResult.errors.length).toBeGreaterThan(0);
  });
});
