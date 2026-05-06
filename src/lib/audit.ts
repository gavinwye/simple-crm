import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { auditLog } from '@/db/schema';

type AuditEntry = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry) {
  try {
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      details: entry.details ?? null,
    });
  } catch (err) {
    // Never fail the user's action just because audit logging failed.
    console.error('Audit log write failed:', err);
  }
}
