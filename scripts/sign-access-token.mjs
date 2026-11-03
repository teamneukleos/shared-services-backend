/**
 * Development-only helper to sign a JWT access token for local verification.
 *
 * Usage:
 *   node scripts/sign-access-token.mjs --userId <uuid> --organisationId <uuid> --email <email>
 *
 * Reads JWT_ACCESS_SECRET and JWT_ACCESS_EXPIRES_IN from the environment /.env.
 * Refuses to run when NODE_ENV=production.
 * Does not print the JWT secret.
 */

import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    args[key] = value;
    index += 1;
  }

  return args;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function parseExpiresIn(value) {
  if (!value) {
    return 15 * 60;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported JWT_ACCESS_EXPIRES_IN value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
}

function signHs256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

loadEnvFile();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to sign access tokens when NODE_ENV=production');
  process.exit(1);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid arguments');
  process.exit(1);
}

const userId = args.userId;
const organisationId = args.organisationId;
const email = args.email;
const secret = process.env.JWT_ACCESS_SECRET;
const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';

if (!userId || !organisationId || !email) {
  console.error(
    'Usage: node scripts/sign-access-token.mjs --userId <uuid> --organisationId <uuid> --email <email>',
  );
  process.exit(1);
}

if (!secret || secret.length < 32) {
  console.error('JWT_ACCESS_SECRET must be set and at least 32 characters');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const payload = {
  sub: userId,
  organisationId,
  email,
  iat: now,
  exp: now + parseExpiresIn(expiresIn),
};

console.log(signHs256(payload, secret));
