import { db } from '@/lib/db';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN';

export type AuditActor = {
  id: string;
  username: string;
  name: string;
};

export type AuditPayload = {
  actor: AuditActor;
  action: AuditAction | string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown> | string | null;
};

function serializeDetails(details?: Record<string, unknown> | string | null): string | null {
  if (details == null) return null;
  return typeof details === 'string' ? details : JSON.stringify(details);
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await db.journalEntry.create({
      data: {
        actorId: payload.actor.id,
        actorName: payload.actor.name || payload.actor.username,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId ?? null,
        details: serializeDetails(payload.details),
      },
    });
  } catch {
    // Never block the main action because of audit logging
  }
}
