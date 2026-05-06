import { NextResponse } from 'next/server';
import { destroySession, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST() {
  const u = await getCurrentUser();
  await destroySession();
  if (u) {
    await logAudit({
      actorUserId: u.id,
      action: 'session.destroyed',
      entityType: 'user',
      entityId: u.id,
    });
  }
  return NextResponse.redirect(new URL('/signin', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
}
