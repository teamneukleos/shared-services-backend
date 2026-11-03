import { PersistedAuditEntry } from './audit-entry.interface';

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditRepository {
  create(entry: PersistedAuditEntry): Promise<void>;
}
