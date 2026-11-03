# Neukleos ERP API

Foundation NestJS 11 + Prisma 7 + PostgreSQL project for the Neukleos ERP modular monolith.

## Prerequisites
- Node.js 22+
- npm 10+
- Docker Desktop (or another local PostgreSQL 17 instance)

## Start locally
```bash
cp .env.example .env
# Set DATABASE_URL to match docker-compose.yml (user/db: neukleos / neukleos_erp on localhost:5432)
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:validate
npm run db:deploy
npm run start:dev
```

API base: `http://localhost:3000/api/v1`

Health check: `GET /api/v1/health` (requires Postgres to be running)

## Authentication (Google Workspace)

### Required configuration
| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID used to verify ID token audience |
| `GOOGLE_ALLOWED_DOMAINS` | Comma-separated Workspace hosted domains (e.g. `neukleos.com,imageandtime.com,kucheza.com`) |
| `JWT_ACCESS_SECRET` | HS256 signing secret for ERP access tokens (min 32 chars) |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (`15m`, `1h`, etc.) |
| `JWT_REFRESH_SECRET` | HMAC key used to hash opaque refresh tokens (min 32 chars); never used to store raw tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`) |

`.env.example` contains placeholders only — never commit real secrets.

### Login flow
1. Frontend obtains a Google ID token for an allowed Workspace domain.
2. `POST /api/v1/authentication/google` with `{ "idToken": "..." }`.
3. The API verifies the token server-side, requires an existing `ExternalIdentity` link (`GOOGLE_WORKSPACE` + Google `sub`), and returns:
   - `accessToken` (short-lived JWT)
   - `refreshToken` (opaque; stored only as HMAC-SHA-256 hash)
   - user profile + permissions loaded from the database

Accounts are **not** auto-created. Email-only linking is **not** supported.

### Refresh and logout
- `POST /api/v1/authentication/refresh` with `{ "refreshToken": "..." }` rotates the refresh token and issues a new access token.
- Reuse of an already-rotated refresh token revokes the entire token family.
- `POST /api/v1/authentication/logout` with `{ "refreshToken": "..." }` revokes that token family (idempotent).

**Important:** logout revokes refresh sessions only. An already-issued access JWT remains valid until it expires. There is no access-token denylist.

### Local bootstrap seed (development only)

`npm run auth:seed-dev-admin` (runs `scripts/seed-auth-user.mjs`) creates an idempotent local admin setup. It refuses to run when `NODE_ENV=production`.

Each run upserts:

| Record | Details |
|--------|---------|
| Organisation | Stable id `11111111-1111-1111-1111-111111111111` (`NEUKLEOS_DEV` by default) |
| UserAccount | Stable id `22222222-2222-2222-2222-222222222222` |
| ExternalIdentity | `GOOGLE_WORKSPACE` + configurable Google `sub` |
| Permission rows | Current HR permission codes + planned org/identity admin codes |
| Role | Org-scoped `SUPER_ADMIN` (schema has no platform super-admin flag) |
| RoleAssignment | Links the seeded user to `SUPER_ADMIN` |

Optional `.env` overrides: `SEED_ADMIN_EMAIL`, `SEED_GOOGLE_SUBJECT`, `SEED_ORG_NAME`, `SEED_ORG_CODE`.

For **live Google login**, set `SEED_ADMIN_EMAIL` to your Workspace email (domain must be in `GOOGLE_ALLOWED_DOMAINS`) and `SEED_GOOGLE_SUBJECT` to that account’s Google ID token `sub`.

For **JWT-only local calls** (no Google), sign a token after seeding:

```bash
npm run auth:seed-dev-admin
npm run auth:sign-access-token -- --userId 22222222-2222-2222-2222-222222222222 --organisationId 11111111-1111-1111-1111-111111111111 --email dev.admin@neukleos.com
```

```bash
curl -i -H "Authorization: Bearer <ACCESS_TOKEN>" http://localhost:3000/api/v1/authentication/me
```

## Migrations and tests

```bash
npm run prisma:validate
npm run db:deploy
npm run test -- --runInBand
npm run test:e2e
```

`npm run test:e2e` creates an isolated database `neukleos_erp_e2e` (derived from `DATABASE_URL`, or use `E2E_DATABASE_URL`), applies migrations, and runs authentication end-to-end tests with Google verification mocked (no live Google network calls).

## Domain modules
Organisation, Identity, HR Core, Recruitment, Leave, Performance, Finance, Reconciliation, Workflow, Documents, Notifications, Audit, Integrations and AI.

## Important
This is the base domain schema, not the final production schema. Approval rules, accounting design, reporting projections, tenancy policy and detailed API contracts must be finalized before production migration stability is declared.
