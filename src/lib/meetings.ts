'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import {
  interactions,
  interactionParticipants,
  actionItems,
} from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export type EnrichPayload = {
  /** Plain summary text from Claude. Appended to body if non-empty. */
  summary?: string;
  /** Decisions Claude extracted. Merged into the structured decisions field. */
  decisions?: string[];
  /** Action items to create. Owner names already resolved to user IDs client-side. */
  actionItems?: Array<{ description: string; ownerUserId?: string; dueDate?: string }>;
  /** Contact IDs to add as attendees. */
  attendeeContactIds?: string[];
  /** Raw transcript text. Appended to the meeting body. */
  transcript?: string;
};

const fmtDateBlock = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Enrich an existing meeting with content from a transcript that was extracted
 * via the smart-fill flow. Idempotent-ish: action items and attendees are
 * additive (no de-duplication beyond uniqueness constraints); body and decisions
 * are appended/merged so the user always gets the new content.
 */
export async function enrichMeeting(meetingId: string, payload: EnrichPayload) {
  const user = await requireRole('member');

  const rows = await db.select().from(interactions).where(eq(interactions.id, meetingId)).limit(1);
  if (rows.length === 0) throw new Error('Meeting not found');
  const meeting = rows[0];

  // The summary is appended to the body so it shows alongside the team's notes.
  // The transcript goes into its own column so the meeting page can keep it
  // tucked away by default. Decisions stay in the structured field.
  let newBody = (meeting.body ?? '').trim();
  if (payload.summary?.trim()) {
    const block = `## Summary added on ${fmtDateBlock(new Date())}\n\n${payload.summary.trim()}`;
    newBody = newBody ? `${newBody}\n\n---\n\n${block}` : block;
  }

  // If there's already a transcript on the meeting (someone enriched it
  // before), append a new transcript with a date divider rather than
  // overwriting. Otherwise just set it.
  let newTranscript = meeting.transcript;
  if (payload.transcript?.trim()) {
    const block = `[transcript added ${fmtDateBlock(new Date())}]\n\n${payload.transcript.trim()}`;
    newTranscript = meeting.transcript?.trim()
      ? `${meeting.transcript.trim()}\n\n---\n\n${block}`
      : block;
  }

  // Merge decisions, preserving order and avoiding exact duplicates.
  const existingDecisions = Array.isArray(meeting.decisions) ? meeting.decisions : [];
  const seenDecisions = new Set(existingDecisions.map((d) => d.trim().toLowerCase()));
  const mergedDecisions = [...existingDecisions];
  for (const d of payload.decisions ?? []) {
    const key = d.trim().toLowerCase();
    if (!seenDecisions.has(key)) {
      mergedDecisions.push(d);
      seenDecisions.add(key);
    }
  }

  await db
    .update(interactions)
    .set({ body: newBody, decisions: mergedDecisions, transcript: newTranscript })
    .where(eq(interactions.id, meetingId));

  // Add attendees (no-op if already present thanks to the unique index).
  for (const cid of payload.attendeeContactIds ?? []) {
    await db
      .insert(interactionParticipants)
      .values({ interactionId: meetingId, contactId: cid, role: 'attendee' })
      .onConflictDoNothing();
  }

  // Insert action items.
  let actionsCreated = 0;
  for (const a of payload.actionItems ?? []) {
    const desc = a.description.trim();
    if (!desc) continue;
    await db.insert(actionItems).values({
      id: randomUUID(),
      interactionId: meetingId,
      description: desc,
      ownerUserId: a.ownerUserId || null,
      dueDate: a.dueDate ? new Date(`${a.dueDate}T00:00:00`) : null,
      status: 'open',
    });
    actionsCreated++;
  }

  await logAudit({
    actorUserId: user.id,
    action: 'meeting.enriched',
    entityType: 'interaction',
    entityId: meetingId,
    details: {
      decisionsAdded: (payload.decisions ?? []).length,
      actionsCreated,
      attendeesAdded: (payload.attendeeContactIds ?? []).length,
      transcriptChars: payload.transcript?.length ?? 0,
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath('/dashboard');
  revalidatePath('/actions');
}

/**
 * Replace the body (notes) of a meeting. Trimmed; empty string clears it.
 */
export async function updateMeetingNotes(meetingId: string, body: string) {
  const user = await requireRole('member');
  const next = body.trim() || null;
  await db.update(interactions).set({ body: next }).where(eq(interactions.id, meetingId));
  await logAudit({
    actorUserId: user.id,
    action: 'meeting.notes_updated',
    entityType: 'interaction',
    entityId: meetingId,
    details: { length: next?.length ?? 0 },
  });
  revalidatePath(`/meetings/${meetingId}`);
}

/**
 * Replace the decisions list on a meeting. Empty/whitespace decisions are
 * dropped. Order is preserved as supplied.
 */
export async function updateMeetingDecisions(meetingId: string, decisions: string[]) {
  const user = await requireRole('member');
  const cleaned = decisions.map((d) => d.trim()).filter((d) => d.length > 0);
  await db.update(interactions).set({ decisions: cleaned }).where(eq(interactions.id, meetingId));
  await logAudit({
    actorUserId: user.id,
    action: 'meeting.decisions_updated',
    entityType: 'interaction',
    entityId: meetingId,
    details: { count: cleaned.length },
  });
  revalidatePath(`/meetings/${meetingId}`);
}

/**
 * Permanently delete a meeting (or any interaction). Cascades to participants
 * and internal attendees via foreign keys; nullifies the interaction_id on
 * any action items so they're preserved as orphan tasks the user can deal
 * with separately.
 */
export async function deleteMeeting(meetingId: string) {
  const user = await requireRole('member');
  const rows = await db.select().from(interactions).where(eq(interactions.id, meetingId)).limit(1);
  if (rows.length === 0) throw new Error('Meeting not found');
  const meeting = rows[0];

  await db.delete(interactions).where(eq(interactions.id, meetingId));

  await logAudit({
    actorUserId: user.id,
    action: 'meeting.deleted',
    entityType: 'interaction',
    entityId: meetingId,
    details: { title: meeting.title, kind: meeting.kind },
  });

  revalidatePath('/meetings');
  revalidatePath('/dashboard');
  revalidatePath('/actions');
  redirect('/meetings');
}

/**
 * Add a single contact as an attendee on an existing meeting. Used by the
 * "pending mentions" UI to resolve names that needed manual disambiguation.
 */
export async function addMeetingAttendee(meetingId: string, contactId: string) {
  const user = await requireRole('member');
  await db
    .insert(interactionParticipants)
    .values({ interactionId: meetingId, contactId, role: 'attendee' })
    .onConflictDoNothing();
  await logAudit({
    actorUserId: user.id,
    action: 'meeting.attendee_added',
    entityType: 'interaction',
    entityId: meetingId,
    details: { contactId },
  });
  revalidatePath(`/meetings/${meetingId}`);
}
