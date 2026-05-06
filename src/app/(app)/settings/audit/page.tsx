import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireRole } from '@/lib/auth';
import { avatarClasses, initials, formatDateTime, cn } from '@/lib/utils';

type Row = {
  id: string;
  occurred_at: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar_colour: string | null;
};

const ACTION_GROUPS: Array<{ key: string; label: string; matcher: (a: string) => boolean }> = [
  { key: 'all', label: 'All', matcher: () => true },
  { key: 'session', label: 'Sessions', matcher: (a) => a.startsWith('session.') },
  { key: 'meeting', label: 'Meetings', matcher: (a) => a.startsWith('meeting.') },
  { key: 'email', label: 'Emails', matcher: (a) => a.startsWith('email.') },
  { key: 'contact', label: 'Contacts', matcher: (a) => a.startsWith('contact.') },
  { key: 'organisation', label: 'Orgs', matcher: (a) => a.startsWith('organisation.') },
  { key: 'action', label: 'Action items', matcher: (a) => a.startsWith('action.') },
  { key: 'user', label: 'Admin', matcher: (a) => a.startsWith('user.') },
];

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  await requireRole('admin');
  const { filter = 'all', page = '1' } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const rows = await db.all<Row>(sql`
    SELECT a.id, a.occurred_at, a.action, a.entity_type, a.entity_id, a.details,
      u.id AS actor_id, u.name AS actor_name, u.avatar_colour AS actor_avatar_colour
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_user_id
    ORDER BY a.occurred_at DESC
    LIMIT ${PAGE_SIZE + 1} OFFSET ${offset}
  `);

  const filterDef = ACTION_GROUPS.find((g) => g.key === filter) ?? ACTION_GROUPS[0];
  const filtered = rows.slice(0, PAGE_SIZE).filter((r) => filterDef.matcher(r.action));
  const hasNext = rows.length > PAGE_SIZE;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {ACTION_GROUPS.map((g) => {
          const active = filter === g.key;
          return (
            <Link
              key={g.key}
              href={`/settings/audit?filter=${g.key}`}
              className={cn(
                'px-3 py-2 text-sm whitespace-nowrap',
                active
                  ? 'font-medium text-slate-900 border-b-2 border-slate-900 -mb-px'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {g.label}
            </Link>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 font-medium">Actor</th>
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Entity</th>
              <th className="px-5 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                  Nothing in the audit log for this filter.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const colour = r.actor_avatar_colour ? avatarClasses(r.actor_avatar_colour) : null;
              return (
                <tr key={r.id} className="align-top">
                  <td className="px-5 py-3 whitespace-nowrap text-slate-600 text-xs font-mono">
                    {formatDateTime(new Date(r.occurred_at * 1000))}
                  </td>
                  <td className="px-5 py-3">
                    {r.actor_name ? (
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${colour?.bg ?? 'bg-slate-100'} ${colour?.text ?? 'text-slate-700'}`}>
                          {initials(r.actor_name)}
                        </div>
                        <span className="text-sm">{r.actor_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">system</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">{r.action}</code>
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">
                    <div>{r.entity_type}</div>
                    {r.entity_id && (
                      <div className="text-slate-400 font-mono mt-0.5 truncate max-w-[160px]">
                        {r.entity_id}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600 text-xs">
                    <DetailsCell raw={r.details} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {(offset + 1).toLocaleString()}–{(offset + filtered.length).toLocaleString()}</span>
          <div className="flex items-center gap-1">
            {pageNum > 1 ? (
              <Link
                href={`/settings/audit?filter=${filter}&page=${pageNum - 1}`}
                className="px-2 py-1 rounded hover:bg-slate-100"
              >
                Previous
              </Link>
            ) : (
              <span className="px-2 py-1 text-slate-400">Previous</span>
            )}
            <span className="px-2.5 py-1 rounded bg-slate-900 text-white">{pageNum}</span>
            {hasNext ? (
              <Link
                href={`/settings/audit?filter=${filter}&page=${pageNum + 1}`}
                className="px-2 py-1 rounded hover:bg-slate-100"
              >
                Next
              </Link>
            ) : (
              <span className="px-2 py-1 text-slate-400">Next</span>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 px-1">
        The audit log is append-only. It records every sign-in, write, ingest, and admin change.
        Retention is unlimited for the pilot — set up a periodic prune before production use.
      </p>
    </div>
  );
}

function DetailsCell({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-slate-400">—</span>;
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // leave as string
  }
  if (typeof parsed === 'string') return <span className="break-words">{parsed}</span>;
  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-slate-400">—</span>;
    return (
      <ul className="space-y-0.5">
        {entries.map(([k, v]) => (
          <li key={k}>
            <span className="text-slate-500">{k}:</span>{' '}
            <span className="font-mono">{String(v)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <span>{String(parsed)}</span>;
}
