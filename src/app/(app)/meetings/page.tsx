import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';

type Row = {
  id: string;
  title: string;
  occurred_at: Date;
  location: string | null;
  organisations: string | null;
  attendee_names: string | null;
  total_actions: number;
  open_actions: number;
};

export default async function MeetingsPage() {
  const rows = await dbAll<Row>(sql`
    SELECT i.id, i.title, i.occurred_at, i.location,
      (SELECT STRING_AGG(DISTINCT COALESCE(o.common_name, o.name), ', ')
        FROM interaction_participants p
        JOIN contacts c ON c.id = p.contact_id
        JOIN organisations o ON o.id = c.organisation_id
        WHERE p.interaction_id = i.id) AS organisations,
      (SELECT STRING_AGG(c.full_name, ', ')
        FROM interaction_participants p
        JOIN contacts c ON c.id = p.contact_id
        WHERE p.interaction_id = i.id) AS attendee_names,
      (SELECT COUNT(*) FROM action_items a WHERE a.interaction_id = i.id) AS total_actions,
      (SELECT COUNT(*) FROM action_items a WHERE a.interaction_id = i.id AND a.status = 'open') AS open_actions
    FROM interactions i
    WHERE i.kind = 'meeting'
    ORDER BY i.occurred_at DESC
  `);

  // Group by ISO week (Monday-based)
  const grouped = new Map<string, Row[]>();
  rows.forEach((r) => {
    const week = isoWeekKey(new Date(r.occurred_at));
    if (!grouped.has(week)) grouped.set(week, []);
    grouped.get(week)!.push(r);
  });

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-slate-600 mt-1">{rows.length} meeting{rows.length === 1 ? '' : 's'} logged</p>
        </div>
        <Link href="/meetings/new" className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New meeting
        </Link>
      </div>

      <div className="space-y-6">
        {rows.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <p className="text-sm text-slate-600">No meetings yet.</p>
            <Link href="/meetings/new" className="mt-3 inline-block text-sm text-slate-900 hover:underline font-medium">
              Log your first meeting →
            </Link>
          </div>
        )}
        {[...grouped.entries()].map(([week, items]) => (
          <div key={week}>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
              Week of {weekLabel(week)}
            </h3>
            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
              {items.map((r) => {
                const d = new Date(r.occurred_at);
                return (
                  <Link key={r.id} href={`/meetings/${r.id}`} className="px-5 py-4 hover:bg-slate-50 flex items-center gap-4">
                    <div className="flex flex-col items-center w-12 flex-shrink-0">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                        {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-semibold leading-tight">{d.getDate()}</div>
                      <div className="text-[10px] text-slate-500">
                        {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{r.title}</div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {[r.organisations, r.attendee_names, r.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {r.total_actions > 0 ? (
                        <>
                          <span className="text-slate-500">{r.total_actions} action{r.total_actions === 1 ? '' : 's'}</span>
                          {r.open_actions > 0 ? (
                            <span className="text-amber-600 font-medium">{r.open_actions} open</span>
                          ) : (
                            <span className="text-emerald-600 font-medium">All done</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">No actions</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function isoWeekKey(d: Date): string {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  // Roll back to Monday
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function weekLabel(weekKey: string): string {
  return new Date(weekKey).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
