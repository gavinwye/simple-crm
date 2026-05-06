import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';

// Initiates the Google OAuth flow. Configured via GOOGLE_CLIENT_ID.
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const allowedHd = process.env.ALLOWED_HD;
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 501 });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const c = await cookies();
  c.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  const baseUrl = new URL(req.url);
  const redirectUri = `${baseUrl.origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    ...(allowedHd ? { hd: allowedHd } : {}),
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
