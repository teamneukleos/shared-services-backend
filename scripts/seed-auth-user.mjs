/**
 * Development-only bootstrap seed.
 *
 * Creates (idempotent upserts):
 * - Organisation
 * - UserAccount
 * - ExternalIdentity (GOOGLE_WORKSPACE) for local Google login linking
 * - Permission catalogue rows used by current HR APIs + planned admin APIs
 * - SUPER_ADMIN Role for that organisation with those permissions
 * - RoleAssignment linking the user to SUPER_ADMIN
 *
 * There is no platform-wide super-admin flag in the Prisma schema; Roles are
 * organisation-scoped, so "super admin" means an org role with broad permissions.
 *
 * Refuses to run when NODE_ENV=production.
 *
 * Optional env overrides:
 *   SEED_ADMIN_EMAIL      default: dev.admin@neukleos.com
 *   SEED_GOOGLE_SUBJECT   default: dev-google-sub-neukleos-admin
 *   SEED_ORG_NAME         default: Neukleos Dev
 *   SEED_ORG_CODE         default: NEUKLEOS_DEV
 *
 * For real Google Workspace login locally, set SEED_ADMIN_EMAIL to your Workspace
 * email (domain must be in GOOGLE_ALLOWED_DOMAINS) and SEED_GOOGLE_SUBJECT to your
 * Google account `sub` from the ID token.
 */

import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed auth users when NODE_ENV=production');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

function resolvePgSchema(connectionString) {
  try {
    const schema = new URL(connectionString).searchParams.get('schema');
    return schema && schema.trim().length > 0 ? schema.trim() : 'public';
  } catch {
    return 'public';
  }
}

const pgSchema = resolvePgSchema(databaseUrl);

/** Stable IDs so re-runs remain idempotent and JWT helper docs stay accurate. */
const organisationId = '11111111-1111-1111-1111-111111111111';
const userId = '22222222-2222-2222-2222-222222222222';
const roleId = '33333333-3333-3333-3333-333333333333';
const externalIdentityId = '44444444-4444-4444-4444-444444444444';

const organisationName = process.env.SEED_ORG_NAME?.trim() || 'Neukleos Dev';
const organisationCode = process.env.SEED_ORG_CODE?.trim() || 'NEUKLEOS_DEV';
const email =
  process.env.SEED_ADMIN_EMAIL?.trim() || 'dev.admin@neukleos.com';
const googleSubject =
  process.env.SEED_GOOGLE_SUBJECT?.trim() || 'dev-google-sub-neukleos-admin';

/**
 * Shared with Nest via src/modules/authorization/domain/permission-catalogue.data.json.
 * Runtime sync is also available at POST /api/v1/identity/permissions/sync.
 */
const cataloguePath = resolve(
  process.cwd(),
  'src/modules/authorization/domain/permission-catalogue.data.json',
);
if (!existsSync(cataloguePath)) {
  console.error(`Permission catalogue not found at ${cataloguePath}`);
  process.exit(1);
}
const PERMISSIONS = JSON.parse(readFileSync(cataloguePath, 'utf8')).map(
  (entry) => [entry.code, entry.description],
);

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  // Prisma's DATABASE_URL ?schema=erpdb is not applied by node-pg automatically.
  await client.query(`SET search_path TO "${pgSchema.replace(/"/g, '')}"`);
  await client.query('BEGIN');

  await client.query(
    `
      INSERT INTO "Organisation" (id, name, code, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          code = EXCLUDED.code,
          status = 'ACTIVE',
          "updatedAt" = NOW()
    `,
    [organisationId, organisationName, organisationCode],
  );

  // If a previous seed used the same id with a different code that conflicts on
  // Organisation.code uniqueness for a different row, surface a clear error.
  await client.query(
    `
      INSERT INTO "UserAccount" (id, "organisationId", "officialEmail", status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET "organisationId" = EXCLUDED."organisationId",
          "officialEmail" = EXCLUDED."officialEmail",
          status = 'ACTIVE',
          "updatedAt" = NOW()
    `,
    [userId, organisationId, email],
  );

  // ExternalIdentity: unique on (provider, subject). Also clean stale subject for this user.
  await client.query(
    `
      DELETE FROM "ExternalIdentity"
      WHERE "userId" = $1
        AND provider = 'GOOGLE_WORKSPACE'
        AND subject <> $2
    `,
    [userId, googleSubject],
  );

  await client.query(
    `
      INSERT INTO "ExternalIdentity" (id, "userId", provider, subject, email)
      VALUES ($1, $2, 'GOOGLE_WORKSPACE', $3, $4)
      ON CONFLICT (provider, subject) DO UPDATE
      SET "userId" = EXCLUDED."userId",
          email = EXCLUDED.email
    `,
    [externalIdentityId, userId, googleSubject, email],
  );

  const permissionIds = [];
  for (const [code, description] of PERMISSIONS) {
    const existing = await client.query(
      `SELECT id FROM "Permission" WHERE code = $1`,
      [code],
    );
    if (existing.rows[0]?.id) {
      permissionIds.push(existing.rows[0].id);
      await client.query(
        `UPDATE "Permission" SET description = $2 WHERE id = $1`,
        [existing.rows[0].id, description],
      );
    } else {
      const id = randomUUID();
      await client.query(
        `
          INSERT INTO "Permission" (id, code, description)
          VALUES ($1, $2, $3)
        `,
        [id, code, description],
      );
      permissionIds.push(id);
    }
  }

  // Prefer the stable role id; if another SUPER_ADMIN already exists for this org,
  // reuse that row so @@unique([organisationId, code]) is respected.
  const existingRole = await client.query(
    `
      SELECT id FROM "Role"
      WHERE "organisationId" = $1 AND code = 'SUPER_ADMIN'
      LIMIT 1
    `,
    [organisationId],
  );
  const resolvedRoleId = existingRole.rows[0]?.id ?? roleId;

  await client.query(
    `
      INSERT INTO "Role" (id, "organisationId", name, code)
      VALUES ($1, $2, 'Super Admin', 'SUPER_ADMIN')
      ON CONFLICT (id) DO UPDATE
      SET name = 'Super Admin',
          code = 'SUPER_ADMIN'
    `,
    [resolvedRoleId, organisationId],
  );

  for (const permissionId of permissionIds) {
    await client.query(
      `
        INSERT INTO "RolePermission" ("roleId", "permissionId")
        VALUES ($1, $2)
        ON CONFLICT ("roleId", "permissionId") DO NOTHING
      `,
      [resolvedRoleId, permissionId],
    );
  }

  const assignment = await client.query(
    `
      SELECT id FROM "RoleAssignment"
      WHERE "userId" = $1 AND "roleId" = $2 AND "endsAt" IS NULL
      LIMIT 1
    `,
    [userId, resolvedRoleId],
  );

  if (!assignment.rows[0]) {
    await client.query(
      `
        INSERT INTO "RoleAssignment" (id, "userId", "roleId", "startsAt")
        VALUES ($1, $2, $3, NOW())
      `,
      [randomUUID(), userId, resolvedRoleId],
    );
  }

  await client.query('COMMIT');

  console.log(
    JSON.stringify(
      {
        organisationId,
        organisationName,
        organisationCode,
        userId,
        email,
        googleSubject,
        provider: 'GOOGLE_WORKSPACE',
        roleId: resolvedRoleId,
        roleCode: 'SUPER_ADMIN',
        permissionCount: PERMISSIONS.length,
        notes: [
          'Dev-only seed. Refuses NODE_ENV=production.',
          'No platform super-admin flag exists; SUPER_ADMIN is org-scoped with broad permissions.',
          'For live Google login, set SEED_ADMIN_EMAIL and SEED_GOOGLE_SUBJECT to your Workspace identity.',
          'JWT helper still works without Google: npm run auth:sign-access-token',
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(error instanceof Error ? error.message : 'Seed failed');
  process.exit(1);
} finally {
  await client.end();
}
