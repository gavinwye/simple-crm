import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { avatarClasses, initials, relativeDays } from '@/lib/utils';

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const filter = q ? `%${q.toLowerCase()}%` : null;

  const rows = await dbAll<{
    id: string;
    slug: string;
    full_name: string;
    title: string | null;
    primary_email: string | null;
    sensitive: number;
    avatar_colour: string;
    tags: string;
    organisation_name: string | null;
    organisation_common_name: string | null;
    last_seen: Date | null;
    interaction_count: number;
  }>(sql`
    SELECT c.id, c.slug, c.full_name, c.title, c.primary_email, c.sensitive, c.avatar_colour, c.tags,
      o.name AS organisation_name, o.common_name AS organisation_common_name,
      (SELECT MAX(i.occurred_at) FROM interactions i
        JOIN interaction_participants p ON p.interaction_id = i.id
        WHERE p.contact_id = c.id) AS last_seen,
      (SELECT COUNT(*) FROM interaction_participants p WHERE p.contact_id = c.id) AS interaction_count
    FROM contacts c
    LEFT JOIN organisations o ON o.id = c.organisation_id
    ${filter ? sql`WHERE LOWER(c.full_name) LIKE ${filter} OR LOWER(c.primary_email) LIKE ${filter} OR LOWER(o.name) LIKE ${filter}` : sql``}
    ORDER BY c.full_name ASC
  `);

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-slate-600 mt-1">{rows.length} {rows.length === 1 ? 'person' : 'people'}</p>
        </div>
        <Link
          href="/contacts/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New contact
        </Link>
      </div>

      <form className="bg-white rounded-lg border border-slate-200 mb-4 p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Filter by name, email, or organisation…"
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-slate-300"
          />
        </div>
        {q && (
          <Link href="/contacts" className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900">
            Clear
          </Link>
        )}
      </form>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Organisation</th>
              <th className="px-5 py-3 font-medium">Tags</th>
              <th className="px-5 py-3 font-medium">Last contact</th>
              <th className="px-5 py-3 font-medium text-right">Interactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                  No contacts match your filter.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const tags = parseTags(r.tags);
              const c = avatarClasses(r.avatar_colour);
              const lastSeen = r.last_seen ? new Date(r.last_seen) : null;
              const dormant = lastSeen && Date.now() - lastSeen.getTime() > 90 * 86400000;
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/contacts/${r.slug}`} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-semibold`}>
                        {initials(r.full_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{r.full_name}</span>
                          {r.sensitive ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-medium">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                              </svg>
                              Sensitive
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">{r.title ?? ''}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{r.organisation_name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`px-5 py-3 ${dormant ? 'text-rose-600 font-medium' : 'text-slate-600'}`}>
                    {lastSeen ? relativeDays(lastSeen) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700 font-medium">{r.interaction_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseTags(raw: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
