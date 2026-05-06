'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, and, ne, count } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { organisations, contacts } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { slugify, uniqueSlug } from '@/lib/slug';

function parseTagsField(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const condition = excludeId
    ? and(eq(organisations.slug, slug), ne(organisations.id, excludeId))!
    : eq(organisations.slug, slug);
  const rows = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(condition)
    .limit(1);
  return rows.length > 0;
}

const VALID_TYPES = [
  'ministry',
  'department',
  'agency',
  'statutory_body',
  'soe',
  'vendor',
  'partner',
  'multilateral',
  'civil_society',
  'media',
  'other',
] as const;

type OrgType = (typeof VALID_TYPES)[number];

function readType(raw: FormDataEntryValue | null): OrgType {
  const value = String(raw ?? 'ministry');
  return (VALID_TYPES as readonly string[]).includes(value) ? (value as OrgType) : 'ministry';
}

/**
 * Walks the parent chain to detect cycles. Returns true if assigning
 * `proposedParentId` as the parent of `selfId` would create a loop.
 */
async function wouldCreateCycle(selfId: string, proposedParentId: string): Promise<boolean> {
  if (selfId === proposedParentId) return true;
  let current: string | null = proposedParentId;
  const seen = new Set<string>([selfId]);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    const rows: Array<{ parentId: string | null }> = await db
      .select({ parentId: organisations.parentId })
      .from(organisations)
      .where(eq(organisations.id, current))
      .limit(1);
    if (rows.length === 0) break;
    current = rows[0].parentId;
  }
  return false;
}

export async function createOrganisation(formData: FormData) {
  const user = await requireRole('member');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Name is required');

  const commonName = String(formData.get('commonName') ?? '').trim() || null;
  const requestedSlug = String(formData.get('slug') ?? '').trim();
  const baseSlug = requestedSlug || commonName || name;
  const slug = await uniqueSlug(baseSlug, (s) => slugTaken(s));

  const id = randomUUID();
  const parentId = String(formData.get('parentId') ?? '').trim() || null;
  await db.insert(organisations).values({
    id,
    slug,
    name,
    commonName,
    type: readType(formData.get('type')),
    parentId,
    website: String(formData.get('website') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    tags: parseTagsField(formData.get('tags')),
    createdBy: user.id,
  });

  await logAudit({
    actorUserId: user.id,
    action: 'organisation.created',
    entityType: 'organisation',
    entityId: id,
    details: { name, parentId },
  });

  revalidatePath('/organisations');
  redirect(`/organisations/${slug}`);
}

export async function updateOrganisation(id: string, formData: FormData) {
  const user = await requireRole('member');

  const existing = await db.select().from(organisations).where(eq(organisations.id, id)).limit(1);
  if (existing.length === 0) throw new Error('Organisation not found');
  const before = existing[0];

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Name is required');
  const commonName = String(formData.get('commonName') ?? '').trim() || null;

  const requestedSlug = String(formData.get('slug') ?? '').trim();
  let slug = before.slug;
  if (requestedSlug && requestedSlug !== before.slug) {
    slug = await uniqueSlug(requestedSlug, (s) => slugTaken(s, id));
  } else if (
    slugify(before.commonName ?? before.name) === before.slug &&
    (name !== before.name || commonName !== before.commonName)
  ) {
    slug = await uniqueSlug(commonName ?? name, (s) => slugTaken(s, id));
  }

  // Resolve and validate parent. An empty string means "no parent" (top-level).
  const requestedParent = String(formData.get('parentId') ?? '').trim() || null;
  let parentId: string | null = requestedParent;
  if (parentId && (await wouldCreateCycle(id, parentId))) {
    throw new Error('Selected parent would create a cycle in the org tree.');
  }

  await db
    .update(organisations)
    .set({
      slug,
      name,
      commonName,
      type: readType(formData.get('type')),
      parentId,
      website: String(formData.get('website') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      tags: parseTagsField(formData.get('tags')),
    })
    .where(eq(organisations.id, id));

  await logAudit({
    actorUserId: user.id,
    action: 'organisation.updated',
    entityType: 'organisation',
    entityId: id,
    details: { name, parentId },
  });

  revalidatePath('/organisations');
  revalidatePath(`/organisations/${before.slug}`);
  if (slug !== before.slug) revalidatePath(`/organisations/${slug}`);
  redirect(`/organisations/${slug}`);
}

/**
 * Permanently delete an organisation. Refuses if the org still has direct
 * contacts or child organisations — the user is asked to reassign first so
 * we don't silently orphan records.
 */
export async function deleteOrganisation(orgId: string) {
  const user = await requireRole('member');
  const rows = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  if (rows.length === 0) throw new Error('Organisation not found');
  const org = rows[0];

  const [{ contactCount }] = await db
    .select({ contactCount: count() })
    .from(contacts)
    .where(eq(contacts.organisationId, orgId));

  const [{ childCount }] = await db
    .select({ childCount: count() })
    .from(organisations)
    .where(eq(organisations.parentId, orgId));

  if (Number(contactCount) > 0 || Number(childCount) > 0) {
    const reasons: string[] = [];
    if (Number(contactCount) > 0) {
      reasons.push(
        `${contactCount} contact${Number(contactCount) === 1 ? '' : 's'} still belong${Number(contactCount) === 1 ? 's' : ''} to this organisation`,
      );
    }
    if (Number(childCount) > 0) {
      reasons.push(
        `${childCount} child organisation${Number(childCount) === 1 ? '' : 's'} list${Number(childCount) === 1 ? 's' : ''} this as a parent`,
      );
    }
    throw new Error(
      `Can't delete ${org.commonName ?? org.name}: ${reasons.join(' and ')}. Reassign or delete those first.`,
    );
  }

  await db.delete(organisations).where(eq(organisations.id, orgId));

  await logAudit({
    actorUserId: user.id,
    action: 'organisation.deleted',
    entityType: 'organisation',
    entityId: orgId,
    details: { name: org.name, slug: org.slug },
  });

  revalidatePath('/organisations');
  redirect('/organisations');
}
