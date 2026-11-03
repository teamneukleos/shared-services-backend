import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(): void {
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

function toE2eDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = '/neukleos_erp_e2e';
  // Keep e2e tables in the default public schema so PrismaPg search_path matches migrations.
  url.searchParams.set('schema', 'public');
  return url.toString();
}

loadEnvFile();

const sourceUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceUrl) {
  throw new Error(
    'DATABASE_URL or E2E_DATABASE_URL is required for authentication e2e tests',
  );
}

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.E2E_PORT ?? '3100';
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? toE2eDatabaseUrl(sourceUrl);
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ??
  'e2e-access-secret-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ??
  'e2e-refresh-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173';
process.env.GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ??
  'e2e-google-client.apps.googleusercontent.com';
process.env.GOOGLE_ALLOWED_DOMAINS =
  process.env.GOOGLE_ALLOWED_DOMAINS ??
  'neukleos.com,imageandtime.com,kucheza.com';
process.env.EMAIL_FROM =
  process.env.EMAIL_FROM ?? 'Neukleos <onboarding@resend.dev>';
process.env.APP_WEB_URL =
  process.env.APP_WEB_URL ?? 'http://localhost:3001';

