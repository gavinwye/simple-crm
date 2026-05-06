import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { users } from '@/db/schema';
import { createSession, isGoogleDomainAllowed } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const c = await cookies();
  const stored = c.get('oauth_state')?.value;
  c.delete('oauth_state');

  if (!code || !state || state !== stored) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${url.origin}/api/auth/google/callback`;

  // Exchange code for tokens.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) {
    return NextResponse.json({ error: 'No ID token returned' }, { status: 502 });
  }

  // Decode ID token (a JWT). For production, verify signature against Google's JWKS.
  const payload = decodeJwt(tokens.id_token);
  if (!payload) return NextResponse.json({ error: 'Bad ID token' }, { status: 502 });

  const hd = payload.hd as string | undefined;
  const email = payload.email as string | undefined;
  const name = (payload.name as string | undefined) ?? email ?? 'Unknown';

  if (!email) return NextResponse.json({ error: 'No email in ID token' }, { status: 403 });
  if (!isGoogleDomainAllowed(hd)) {
    return NextResponse.json(
      { error: `Sign-in is restricted to @${process.env.ALLOWED_HD ?? '<unset>'} accounts.` },
      { status: 403 },
    );
  }

  // Upsert the user.
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user = existing[0];
  if (!user) {
    const id = randomUUID();
    await db.insert(users).values({ id, email, name, role: 'member' });
    user = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  }

  await createSession(user.id);
  await logAudit({
    actorUserId: user.id,
    action: 'session.created',
    entityType: 'user',
    entityId: user.id,
    details: { method: 'google-oauth', hd },
  });

  return NextResponse.redirect(new URL('/dashboard', url.origin));
}

function decodeJwt(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
