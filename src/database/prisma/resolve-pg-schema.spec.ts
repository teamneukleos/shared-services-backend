import { resolvePgSchema } from './resolve-pg-schema';

describe('resolvePgSchema', () => {
  it('reads schema from the connection URL', () => {
    expect(
      resolvePgSchema(
        'postgresql://neukleos:neukleos@localhost:5432/neukleos_erp?schema=erpdb',
      ),
    ).toBe('erpdb');
  });

  it('defaults to public when schema is omitted', () => {
    expect(
      resolvePgSchema('postgresql://neukleos:neukleos@localhost:5432/neukleos_erp'),
    ).toBe('public');
  });
});
