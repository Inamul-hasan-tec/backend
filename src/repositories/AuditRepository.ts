import pool from '../config/db';
import { getTenantId } from '../utils/tenantContext';

const sensitiveKey = /password|token|authorization|cookie|secret|api[_-]?key|payment[_-]?proof/i;

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : sanitizeAuditValue(child),
    ])
  );
}

interface TenantAuditEvent {
  actorUserId?: number;
  action: string;
  entityType: string;
  entityId: number;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
}

interface PlatformAuditEvent {
  actorUserId?: number;
  action: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  metadata?: unknown;
  requestId?: string;
  ipAddress?: string;
}

class AuditRepository {
  async recordTenant(event: TenantAuditEvent): Promise<void> {
    await pool.execute(
      `INSERT INTO audit_logs
       (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        getTenantId(),
        event.actorUserId || null,
        event.action,
        event.entityType,
        event.entityId,
        event.oldValues === undefined ? null : JSON.stringify(sanitizeAuditValue(event.oldValues)),
        event.newValues === undefined ? null : JSON.stringify(sanitizeAuditValue(event.newValues)),
        event.ipAddress || null,
      ]
    );
  }

  async recordPlatform(event: PlatformAuditEvent): Promise<void> {
    await pool.execute(
      `INSERT INTO platform_audit_logs
       (actor_user_id, action, target_type, target_id, reason, metadata, request_id, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.actorUserId || null,
        event.action,
        event.targetType,
        event.targetId || null,
        event.reason || null,
        event.metadata === undefined ? null : JSON.stringify(sanitizeAuditValue(event.metadata)),
        event.requestId || null,
        event.ipAddress || null,
      ]
    );
  }
}

export default new AuditRepository();
