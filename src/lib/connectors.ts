'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { contactConnectors, contacts } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const VALID_STRENGTHS = ['close', 'professional', 'acquaintance'] as const;
export type ConnectorStrength = (typeof VALID_STRENGTHS)[number];

function readStrength(raw: unknown): ConnectorStrength {
  const v = String(raw ?? 'professional');
  return (VALID_STRENGTHS as readonly string[]).includes(v) ? (v as ConnectorStrength) : 'professional';
}

function clean(raw: unknown): string | null {
  const v = String(raw ?? '').trim();
  return v.length > 0 ? v : null;
}

async function lookupContactSlug(contactId: string): Promise<string> {
  const rows = await db
    .select({ slug: contacts.slug })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (rows.length === 0) throw new Error('Contact not found');
  return rows[0].slug;
}

/**
 * Add a GovTech member as a connector on a contact. If a row already exists
 * for this (contact, user) pair, treat the call as an update so callers don't
 * have to branch on existence.
 */
export async function addConnector(input: {
  contactId: string;
  userId: string;
  strength: string;
  notes: string;
}) {
  const actor = await requireRole('member');
  const userId = input.userId.trim();
  if (!userId) throw new Error('Pick a GovTech member to add as a connector.');

  const slug = await lookupContactSlug(input.contactId);
  const strength = readStrength(input.strength);
  const notes = clean(input.notes);

  const existing = await db
    .select()
    .from(contactConnectors)
    .where(
      and(eq(contactConnectors.contactId, input.contactId), eq(contactConnectors.userId, userId)),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(contactConnectors)
      .set({ strength, notes })
      .where(eq(contactConnectors.id, existing[0].id));
    await logAudit({
      actorUserId: actor.id,
      action: 'connector.updated',
      entityType: 'contact',
      entityId: input.contactId,
      details: { userId, strength },
    });
  } else {
    const id = randomUUID();
    await db.insert(contactConnectors).values({
      id,
      contactId: input.contactId,
      userId,
      strength,
      notes,
      createdBy: actor.id,
    });
    await logAudit({
      actorUserId: actor.id,
      action: 'connector.added',
      entityType: 'contact',
      entityId: input.contactId,
      details: { userId, strength },
    });
  }

  revalidatePath(`/contacts/${slug}`);
}

/**
 * Update strength and/or notes on an existing connector row.
 */
export async function updateConnector(
  connectorId: string,
  input: { strength: string; notes: string },
) {
  const actor = await requireRole('member');

  const existing = await db
    .select({ row: contactConnectors, slug: contacts.slug })
    .from(contactConnectors)
    .innerJoin(contacts, eq(contacts.id, contactConnectors.contactId))
    .where(eq(contactConnectors.id, connectorId))
    .limit(1);
  if (existing.length === 0) throw new Error('Connector not found');

  const strength = readStrength(input.strength);
  const notes = clean(input.notes);

  await db
    .update(contactConnectors)
    .set({ strength, notes })
    .where(eq(contactConnectors.id, connectorId));

  await logAudit({
    actorUserId: actor.id,
    action: 'connector.updated',
    entityType: 'contact',
    entityId: existing[0].row.contactId,
    details: { userId: existing[0].row.userId, strength },
  });

  revalidatePath(`/contacts/${existing[0].slug}`);
}

/**
 * Remove a connector row. Idempotent: silently no-ops if the row is gone.
 */
export async function removeConnector(connectorId: string) {
  const actor = await requireRole('member');

  const existing = await db
    .select({ row: contactConnectors, slug: contacts.slug })
    .from(contactConnectors)
    .innerJoin(contacts, eq(contacts.id, contactConnectors.contactId))
    .where(eq(contactConnectors.id, connectorId))
    .limit(1);
  if (existing.length === 0) return;

  await db.delete(contactConnectors).where(eq(contactConnectors.id, connectorId));

  await logAudit({
    actorUserId: actor.id,
    action: 'connector.removed',
    entityType: 'contact',
    entityId: existing[0].row.contactId,
    details: { userId: existing[0].row.userId },
  });

  revalidatePath(`/contacts/${existing[0].slug}`);
}
