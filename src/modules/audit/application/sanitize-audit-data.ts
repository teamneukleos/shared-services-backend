const SENSITIVE_KEY_TERMS = [
  'password',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'accesskey',
  'refreshtoken',
  'privatekey',
] as const;

const REDACTED = '[REDACTED]';

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_TERMS.some((term) => normalized.includes(term));
}

export function sanitizeAuditData<T>(value: T): T {
  return sanitizeValue(value, new WeakSet<object>()) as T;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'undefined') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  const result: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    result[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(nested, seen);
  }

  return result;
}
