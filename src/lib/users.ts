'use server';

import { revalidatePath } from 'next/cache';
import { eq, count } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const VALID_ROLES = ['admin', 'member', 'viewer'] as const;
type Role = (typeof VALID_ROLES)[number];

const COLOURS = ['amber', 'blue', 'rose', 'violet', 'teal', 'emerald', 'fuchsia', 'cyan', 'pink', 'orange'];
function pickColour(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLOURS[h % COLOURS.length];
}

export async function updateUserRole(userId: string, role: string) {
  const actor = await requireRole('admin');
  if (!VALID_ROLES.includes(role as Role)) throw new Error('Invalid role');

  if (userId === actor.id) {
    throw new Error("You can't change your own role. Ask another admin.");
  }

  // Don't allow demoting the last admin.
  const target = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (target.length === 0) throw new Error('User not found');
  if (target[0].role === 'admin' && role !== 'admin') {
    const [{ admins }] = await db
      .select({ admins: count() })
      .from(users)
      .where(eq(users.role, 'admin'));
    if (Number(admins) <= 1) {
      throw new Error('At least one admin is required.');
    }
  }

  await db.update(users).set({ role: role as Role }).where(eq(users.id, userId));

  await logAudit({
    actorUserId: actor.id,
    action: 'user.role_changed',
    entityType: 'user',
    entityId: userId,
    details: { from: target[0].role, to: role },
  });

  revalidatePath('/settings/team');
}

export async function addTeamMember(formData: FormData) {
  const actor = await requireRole('admin');

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'member');

  if (!name) throw new Error('Name is required');
  if (!email || !email.includes('@')) throw new Error('A valid email is required');
  if (!VALID_ROLES.includes(role as Role)) throw new Error('Invalid role');

  // Check for duplicates by email.
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error(`A user with email ${email} already exists.`);
  }

  // If Google OAuth is configured with a domain restriction, enforce it.
  const allowedHd = process.env.ALLOWED_HD;
  if (process.env.GOOGLE_CLIENT_ID && allowedHd) {
    const domain = email.split('@')[1] ?? '';
    if (domain !== allowedHd) {
      throw new Error(
        `Email domain doesn't match the allowed Google Workspace domain (${allowedHd}). Update ALLOWED_HD or use a permitted address.`,
      );
    }
  }

  const id = randomUUID();
  await db.insert(users).values({
    id,
    name,
    email,
    role: role as Role,
    avatarColour: pickColour(name),
  });

  await logAudit({
    actorUserId: actor.id,
    action: 'user.created',
    entityType: 'user',
    entityId: id,
    details: { email, role },
  });

  revalidatePath('/settings/team');
  revalidatePath('/signin');
}
