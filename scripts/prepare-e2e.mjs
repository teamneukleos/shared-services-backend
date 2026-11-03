/**
 * Creates the isolated e2e database (if needed) and applies Prisma migrations to it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function toAdminUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  return url.toString();
}

function toE2eUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  url.pathname = '/neukleos_erp_e2e';
  url.searchParams.set('schema', 'public');
  return url.toString();
}

loadEnvFile();

const sourceUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error('DATABASE_URL or E2E_DATABASE_URL is required');
  process.exit(1);
}

const e2eUrl = process.env.E2E_DATABASE_URL ?? toE2eUrl(sourceUrl);

if (!process.env.E2E_DATABASE_URL) {
  const client = new pg.Client({ connectionString: toAdminUrl(sourceUrl) });
  await client.connect();
  const existing = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    ['neukleos_erp_e2e'],
  );
  if (existing.rowCount === 0) {
    await client.query('CREATE DATABASE neukleos_erp_e2e');
    console.log('Created database neukleos_erp_e2e');
  } else {
    console.log('Database neukleos_erp_e2e already exists');
  }
  await client.end();
}

process.env.DATABASE_URL = e2eUrl;

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

console.log(`E2E database ready: ${e2eUrl.replace(/:[^:@/]+@/, ':***@')}`);
