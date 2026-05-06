'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, and, ne, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { contacts, actionItems } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { slugify, uniqueSlug } from '@/lib/slug';

const COLOURS = [
  'amber', 'blue', 'rose', 'violet', 'teal', 'emerald',
  'fuchsia', 'cyan', 'pink', 'orange', 'slate',
];

function pickColour(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLOURS[h % COLOURS.length];
}

function parseTagsField(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const condition = excludeId
    ? and(eq(contacts.slug, slug), ne(contacts.id, excludeId))!
    : eq(contacts.slug, slug);
  const rows = await db.select({ id: contacts.id }).from(contacts).where(condition).limit(1);
  return rows.length > 0;
}

export async function createContact(formData: FormData) {
  const user = await requireRole('member');

  const fullName = String(formData.get('fullName') ?? '').trim();
  if (!fullName) throw new Error('Full name is required');

  const requestedSlug = String(formData.get('slug') ?? '').trim();
  const baseSlug = requestedSlug || fullName;
  const slug = await uniqueSlug(baseSlug, (s) => slugTaken(s));

  const id = randomUUID();
  await db.insert(contacts).values({
    id,
    slug,
    fullName,
    title: String(formData.get('title') ?? '').trim() || null,
    organisationId: String(formData.get('organisationId') ?? '') || null,
    primaryEmail: String(formData.get('primaryEmail') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    sensitive: formData.get('sensitive') === 'on',
    notes: String(formData.get('notes') ?? '').trim() || null,
    tags: parseTagsField(formData.get('tags')),
    avatarColour: pickColour(fullName),
    createdBy: user.id,
  });

  await logAudit({
    actorUserId: user.id,
    action: 'contact.created',
    entityType: 'contact',
    entityId: id,
    details: { fullName },
  });

  revalidatePath('/contacts');
  redirect(`/contacts/${slug}`);
}

export async function updateContact(id: string, formData: FormData) {
  const user = await requireRole('member');

  const existing = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  if (existing.length === 0) throw new Error('Contact not found');
  const before = existing[0];

  const fullName = String(formData.get('fullName') ?? '').trim();
  if (!fullName) throw new Error('Full name is required');

  // Recompute slug if the user typed a new one OR if the name changed and the slug
  // wasn't customised away from its derived form.
  const requestedSlug = String(formData.get('slug') ?? '').trim();
  let slug = before.slug;
  if (requestedSlug && requestedSlug !== before.slug) {
    slug = await uniqueSlug(requestedSlug, (s) => slugTaken(s, id));
  } else if (slugify(before.fullName) === before.slug && fullName !== before.fullName) {
    slug = await uniqueSlug(fullName, (s) => slugTaken(s, id));
  }

  await db
    .update(contacts)
    .set({
      slug,
      fullName,
      title: String(formData.get('title') ?? '').trim() || null,
      organisationId: String(formData.get('organisationId') ?? '') || null,
      primaryEmail: String(formData.get('primaryEmail') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      sensitive: formData.get('sensitive') === 'on',
      notes: String(formData.get('notes') ?? '').trim() || null,
      tags: parseTagsField(formData.get('tags')),
    })
    .where(eq(contacts.id, id));

  await logAudit({
    actorUserId: user.id,
    action: 'contact.updated',
    entityType: 'contact',
    entityId: id,
    details: { fullName },
  });

  revalidatePath('/contacts');
  revalidatePath(`/contacts/${before.slug}`);
  if (slug !== before.slug) revalidatePath(`/contacts/${slug}`);
  redirect(`/contacts/${slug}`);
}

/**
 * Permanently delete a contact. Cascades to interaction_participants via the
 * foreign key. Action items where this contact was the owner have their
 * owner_contact_id nulled rather than being deleted, so the work isn't lost.
 */
export async function deleteContact(contactId: string) {
  const user = await requireRole('member');
  const rows = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (rows.length === 0) throw new Error('Contact not found');
  const contact = rows[0];

  // Preserve action items by nulling the owner.
  await db
    .update(actionItems)
    .set({ ownerContactId: null })
    .where(eq(actionItems.ownerContactId, contactId));

  await db.delete(contacts).where(eq(contacts.id, contactId));

  await logAudit({
    actorUserId: user.id,
    action: 'contact.deleted',
    entityType: 'contact',
    entityId: contactId,
    details: { fullName: contact.fullName, slug: contact.slug },
  });

  revalidatePath('/contacts');
  revalidatePath('/dashboard');
  redirect('/contacts');
}
