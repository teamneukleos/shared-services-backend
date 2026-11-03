import { AuditAction } from './audit-action.enum';

export interface CreateAuditEntry {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  organisationId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: Record<string, unknown>;
  reason?: string;
}

/**
 * Schema-aligned persistence contract for AuditEvent.
 * Domain CreateAuditEntry fields are mapped here before repository write.
 */
export interface PersistedAuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  actorUserId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}
