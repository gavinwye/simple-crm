import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { ActionCheckbox } from '@/components/action-checkbox';

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  const { filter = 'mine' } = await searchParams;

  let whereClause = sql`a.status = 'open'`;
  if (filter === 'mine') {
    whereClause = sql`a.status = 'open' AND a.owner_user_id = ${user.id}`;
  } else if (filter === 'overdue') {
    whereClause = sql`a.status = 'open' AND a.due_date < ${Math.floor(Date.now() / 1000)}`;
  } else if (filter === 'done') {
    whereClause = sql`a.status = 'done'`;
  }

  const rows = await db.all<{
    id: string;
    description: string;
    due_date: number | null;
    status: string;
    owner_name: string | null;
    interaction_id: string | null;
    interaction_title: string | null;
    contact_name: string | null;
    organisation_name: string | null;
  }>(sql`
    SELECT a.id, a.description, a.due_date, a.status,
      u.name AS owner_name,
      a.interaction_id, i.title AS interaction_title,
      c.full_name AS contact_name, o.common_name AS organisation_name
    FROM action_items a
    LEFT JOIN users u ON u.id = a.owner_user_id
    LEFT JOIN interactions i ON i.id = a.interaction_id
    LEFT JOIN contacts c ON c.id = a.owner_contact_id
    LEFT JOIN organisations o ON o.id = c.organisation_id
    WHERE ${whereClause}
    ORDER BY a.due_date ASC NULLS LAST
  `);

  const counts = await db.all<{ filter: string; count: number }>(sql`
    SELECT 'mine' AS filter, COUNT(*) AS count FROM action_items WHERE status = 'open' AND owner_user_id = ${user.id}
    UNION ALL SELECT 'all', COUNT(*) FROM action_items WHERE status = 'open'
    UNION ALL SELECT 'overdue', COUNT(*) FROM action_items WHERE status = 'open' AND due_date < ${Math.floor(Date.now() / 1000)}
    UNION ALL SELECT 'done', COUNT(*) FROM action_items WHERE status = 'done'
  `);
  const countOf = (k: string) => counts.find((c) => c.filter === k)?.count ?? 0;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Action items</h1>
        <p className="text-sm text-slate-600 mt-1">Things you and your team committed to in meetings and emails.</p>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <Tab label="Mine" filter="mine" current={filter} count={countOf('mine')} />
        <Tab label="All open" filter="all" current={filter} count={countOf('all')} />
        <Tab label="Overdue" filter="overdue" current={filter} count={countOf('overdue')} accent />
        <Tab label="Done" filter="done" current={filter} count={countOf('done')} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {rows.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-500">No items in this view.</div>
        )}
        {rows.map((a) => {
          const overdue = a.due_date && a.due_date * 1000 < Date.now() && a.status === 'open';
          return (
            <div key={a.id} className="px-5 py-4 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <ActionCheckbox id={a.id} done={a.status === 'done'} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${a.status === 'done' ? 'line-through text-slate-500' : ''}`}>
                    {a.description}
                  </p>
                  {a.interaction_title && (
                    <p className="text-sm text-slate-600 mt-0.5">
                      From{' '}
                      <Link href={`/meetings/${a.interaction_id}`} className="hover:underline">
                        {a.interaction_title}
                      </Link>
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    {a.due_date ? (
                      <span className={overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}>
                        {overdue ? 'Overdue · ' : 'Due '} {formatDate(new Date(a.due_date * 1000))}
                      </span>
                    ) : (
                      <span className="text-slate-500">No due date</span>
                    )}
                    {a.owner_name && (
                      <>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">{a.owner_name}</span>
                      </>
                    )}
                    {(a.contact_name || a.organisation_name) && (
                      <>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                          {[a.contact_name, a.organisation_name].filter(Boolean).join(' · ')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tab({
  label,
  filter,
  current,
  count,
  accent,
}: {
  label: string;
  filter: string;
  current: string;
  count: number;
  accent?: boolean;
}) {
  const active = current === filter;
  return (
    <Link
      href={`?filter=${filter}`}
      className={
        active
          ? 'px-4 py-2.5 text-sm font-medium text-slate-900 border-b-2 border-slate-900 -mb-px'
          : 'px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900'
      }
    >
      {label}
      {count > 0 && (
        <span className={`text-xs ml-1 ${accent ? 'text-rose-600' : 'text-slate-400'}`}>{count}</span>
      )}
    </Link>
  );
}
