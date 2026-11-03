/**
 * Prisma 7 + @prisma/adapter-pg does not honour DATABASE_URL ?schema= automatically.
 * Pass the resolved schema name into `new PrismaPg(config, { schema })`.
 */
export function resolvePgSchema(connectionString: string): string {
  try {
    const schema = new URL(connectionString).searchParams.get('schema');
    const trimmed = schema?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : 'public';
  } catch {
    return 'public';
  }
}
