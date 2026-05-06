import Link from 'next/link';
import { and, desc, eq, sql, count } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { contacts, organisations, interactions, actionItems } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { formatDate, relativeDays, avatarClasses, initials } from '@/lib/utils';
import { ActionCheckbox } from '@/components/action-checkbox';
import { getSetting, SETTING_KEYS, type PilotBanner } from '@/lib/settings';

export default async function DashboardPage() {
  const user = await requireUser();
  const banner = await getSetting<PilotBanner>(SETTING_KEYS.pilotBanner);

  // Stats
  const [{ contactCount }] = await db.select({ contactCount: count() }).from(contacts);
  const [{ orgCount }] = await db.select({ orgCount: count() }).from(organisations);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [{ meetingsThisMonth }] = await db
    .select({ meetingsThisMonth: count() })
    .from(interactions)
    .where(and(eq(interactions.kind, 'meeting'), sql`${interactions.occurredAt} >= ${startOfMonth}`));

  const [{ openActionsCount }] = await db
    .select({ openActionsCount: count() })
    .from(actionItems)
    .where(eq(actionItems.status, 'open'));

  const [{ overdueActionsCount }] = await db
    .select({ overdueActionsCount: count() })
    .from(actionItems)
    .where(and(eq(actionItems.status, 'open'), sql`${actionItems.dueDate} < ${new Date()}`));

  // Recent activity
  const recentInteractions = await db
    .select()
    .from(interactions)
    .orderBy(desc(interactions.occurredAt))
    .limit(8);

  // Open actions assigned to me
  const myActionsRaw = await db
    .select({
      action: actionItems,
      interactionTitle: interactions.title,
      assignedToContact: contacts.fullName,
    })
    .from(actionItems)
    .leftJoin(interactions, eq(actionItems.interactionId, interactions.id))
    .leftJoin(contacts, eq(actionItems.ownerContactId, contacts.id))
    .where(and(eq(actionItems.status, 'open'), eq(actionItems.ownerUserId, user.id)))
    .orderBy(actionItems.dueDate)
    .limit(5);

  // Dormant relationships (no contact in 90+ days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000);
  const dormant = await dbAll<{
    id: string;
    slug: string;
    full_name: string;
    organisation_name: string | null;
    last_seen: Date;
    avatar_colour: string;
  }>(sql`
    SELECT c.id, c.slug, c.full_name, c.avatar_colour, o.common_name AS organisation_name,
      (SELECT MAX(i.occurred_at) FROM interactions i
       JOIN interaction_participants p ON p.interaction_id = i.id
       WHERE p.contact_id = c.id) AS last_seen
    FROM contacts c
    LEFT JOIN organisations o ON o.id = c.organisation_id
    GROUP BY c.id, c.slug, c.full_name, c.avatar_colour, o.common_name
    HAVING (SELECT MAX(i.occurred_at) FROM interactions i
            JOIN interaction_participants p ON p.interaction_id = i.id
            WHERE p.contact_id = c.id) < ${ninetyDaysAgo}
    ORDER BY last_seen ASC
    LIMIT 4
  `);

  return (
    <div className="p-8 max-w-7xl">
      {banner.enabled && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <span className="font-medium text-amber-900">Pilot · v0.1</span>
            <span className="text-amber-800"> · {banner.text}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good {timeOfDay()}, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-600 mt-1">{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Stat label="Contacts" value={contactCount} />
        <Stat label="Organisations" value={orgCount} />
        <Stat label="Meetings this month" value={meetingsThisMonth} />
        <Stat label="Open actions" value={openActionsCount} accent={overdueActionsCount > 0 ? `${overdueActionsCount} overdue` : undefined} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold">Recent activity</h2>
              <Link href="/meetings" className="text-xs text-slate-600 hover:text-slate-900">
                View all →
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {recentInteractions.length === 0 && (
                <li className="px-5 py-12 text-center text-sm text-slate-500">No activity yet.</li>
              )}
              {recentInteractions.map((i) => (
                <li key={i.id}>
                  <Link
                    href={i.kind === 'email' && i.reviewStatus === 'pending' ? `/emails/${i.id}/review` : `/meetings/${i.id}`}
                    className="block px-5 py-4 hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <KindIcon kind={i.kind} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{i.title}</span>
                          <span className={kindBadgeClass(i.kind)}>{kindLabel(i.kind)}</span>
                          {i.reviewStatus === 'pending' && (
                            <span className="text-[11px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Needs review</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5 line-clamp-1">
                          {i.summary ?? i.body?.slice(0, 120) ?? ''}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span>{formatDate(i.occurredAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold">My open actions</h2>
              <span className="text-xs text-slate-500">{myActionsRaw.length}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {myActionsRaw.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-500">Nothing on your plate.</li>
              )}
              {myActionsRaw.map(({ action, interactionTitle }) => {
                const overdue = action.dueDate && action.dueDate.getTime() < Date.now();
                return (
                  <li key={action.id} className="px-5 py-3.5 flex items-start gap-2.5">
                    <ActionCheckbox id={action.id} done={action.status === 'done'} />
                    <div className="flex-1">
                    <p className="text-sm">{action.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className={overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}>
                        {overdue ? 'Overdue · ' : 'Due '}
                        {action.dueDate ? formatDate(action.dueDate) : 'no date'}
                      </span>
                      {interactionTitle && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 truncate">{interactionTitle}</span>
                        </>
                      )}
                    </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {dormant.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold">Dormant relationships</h2>
                <p className="text-xs text-slate-500 mt-0.5">No contact in 90+ days</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {dormant.map((d) => {
                  const c = avatarClasses(d.avatar_colour);
                  return (
                    <li key={d.id}>
                      <Link href={`/contacts/${d.slug}`} className="block px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                        <div className={`w-8 h-8 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-medium`}>
                          {initials(d.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{d.full_name}</div>
                          <div className="text-xs text-slate-500">
                            {d.organisation_name ?? '—'} · {relativeDays(new Date(d.last_seen))}
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value}</div>
      {accent && <div className="text-xs text-rose-600 mt-1">{accent}</div>}
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'email') {
    return (
      <div className="w-8 h-8 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-violet-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25" />
        </svg>
      </div>
    );
  }
  if (kind === 'note') {
    return (
      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
      <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07" />
      </svg>
    </div>
  );
}

function kindLabel(kind: string) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function kindBadgeClass(kind: string) {
  if (kind === 'email') return 'text-[11px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded';
  if (kind === 'note') return 'text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded';
  return 'text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded';
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
