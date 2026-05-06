import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';

const COOKIE_NAME = 'gt_session';
const SESSION_TTL_HOURS = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET environment variable is required');
  return new TextEncoder().encode(s);
}

export async function createSession(userId: string) {
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret());

  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = payload.uid as string | undefined;
    if (!uid) return null;
    const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect('/signin');
  return u;
}

export async function requireRole(role: 'admin' | 'member'): Promise<User> {
  const u = await requireUser();
  if (role === 'admin' && u.role !== 'admin') {
    throw new Error('Forbidden: admin role required');
  }
  if (role === 'member' && u.role === 'viewer') {
    throw new Error('Forbidden: write access required');
  }
  return u;
}

/**
 * Validates a Google ID token's `hd` (hosted-domain) claim against ALLOWED_HD.
 * Used by the Google OAuth callback when GOOGLE_CLIENT_ID is configured.
 */
export function isGoogleDomainAllowed(hd: string | undefined): boolean {
  const allowed = process.env.ALLOWED_HD;
  if (!allowed) return false;
  return hd === allowed;
}
