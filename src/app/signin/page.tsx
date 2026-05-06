import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { createSession, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { avatarClasses, initials } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function signInAs(formData: FormData) {
  'use server';
  const userId = String(formData.get('userId') ?? '');
  if (!userId) return;
  await createSession(userId);
  await logAudit({
    actorUserId: userId,
    action: 'session.created',
    entityType: 'user',
    entityId: userId,
    details: { method: 'dev-credentials' },
  });
  redirect('/dashboard');
}

export default async function SignInPage() {
  const current = await getCurrentUser();
  if (current) redirect('/dashboard');

  const allUsers = await db.select().from(users).orderBy(users.name);
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  const allowedHd = process.env.ALLOWED_HD ?? '';

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">GovTech Stakeholders</h1>
          <p className="text-sm text-slate-600 mt-1">Internal tool for the GovTech Barbados team</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold mb-1">Sign in</h2>
          <p className="text-sm text-slate-600 mb-6">
            {googleEnabled
              ? 'Use your GovTech Google Workspace account to continue.'
              : 'Local development: pick a seeded user to sign in. Configure Google OAuth in production.'}
          </p>

          {googleEnabled ? (
            <Link
              href="/api/auth/google/start"
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
            >
              <GoogleLogo />
              Continue with Google Workspace
            </Link>
          ) : (
            <form action={signInAs} className="space-y-2">
              {allUsers.map((u) => {
                const c = avatarClasses(u.avatarColour);
                return (
                  <button
                    key={u.id}
                    type="submit"
                    name="userId"
                    value={u.id}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition text-left"
                  >
                    <div className={`w-9 h-9 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-semibold`}>
                      {initials(u.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">{u.role}</span>
                  </button>
                );
              })}
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>
                {googleEnabled ? (
                  <>
                    Sign-in is restricted to <span className="font-medium text-slate-700">@{allowedHd}</span> accounts.
                  </>
                ) : (
                  <>
                    Production sign-in is restricted to <span className="font-medium text-slate-700">@{allowedHd}</span> Google
                    Workspace accounts. All activity is logged for security.
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">Pilot · v0.1</p>
      </div>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09 0-.73.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
