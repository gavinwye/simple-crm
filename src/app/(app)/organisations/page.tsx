import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { typeLabel } from '@/lib/org-tree';
import { cn } from '@/lib/utils';

const TYPE_COLOUR: Record<string, string> = {
  ministry: 'bg-blue-50 text-blue-700',
  department: 'bg-indigo-50 text-indigo-700',
  agency: 'bg-sky-50 text-sky-700',
  statutory_body: 'bg-cyan-50 text-cyan-700',
  soe: 'bg-teal-50 text-teal-700',
  vendor: 'bg-amber-50 text-amber-700',
  partner: 'bg-emerald-50 text-emerald-700',
  multilateral: 'bg-emerald-50 text-emerald-700',
  civil_society: 'bg-violet-50 text-violet-700',
  media: 'bg-pink-50 text-pink-700',
  other: 'bg-slate-100 text-slate-700',
};

const GOVERNMENT_TYPES = ['ministry', 'department', 'agency', 'statutory_body', 'soe'];

const FILTERS: Array<{ key: string; label: string; types: string[] | null }> = [
  { key: 'all', label: 'All', types: null },
  { key: 'government', label: 'Government', types: GOVERNMENT_TYPES },
  { key: 'ministries', label: 'Ministries', types: ['ministry'] },
  { key: 'departments', label: 'Departments', types: ['department'] },
  { key: 'agencies', label: 'Agencies', types: ['agency', 'statutory_body', 'soe'] },
  { key: 'vendors', label: 'Vendors', types: ['vendor'] },
  { key: 'partners', label: 'Partners', types: ['partner', 'multilateral'] },
];

export default async function OrganisationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = 'all' } = await searchParams;
  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  const allOrgs = await dbAll<{
    id: string;
    slug: string;
    name: string;
    common_name: string | null;
    type: string;
    parent_id: string | null;
    parent_name: string | null;
    parent_slug: string | null;
    tags: string;
    contacts_count: number;
    interactions_count: number;
  }>(sql`
    SELECT o.id, o.slug, o.name, o.common_name, o.type, o.parent_id, o.tags,
      p.name AS parent_name, p.slug AS parent_slug,
      (SELECT COUNT(*) FROM contacts c WHERE c.organisation_id = o.id) AS contacts_count,
      (SELECT COUNT(DISTINCT i.id)
        FROM interactions i
        JOIN interaction_participants pa ON pa.interaction_id = i.id
        JOIN contacts c2 ON c2.id = pa.contact_id
        WHERE c2.organisation_id = o.id) AS interactions_count
    FROM organisations o
    LEFT JOIN organisations p ON p.id = o.parent_id
    ORDER BY o.name ASC
  `);

  const orgs = activeFilter.types
    ? allOrgs.filter((o) => activeFilter.types!.includes(o.type))
    : allOrgs;

  const counts: Record<string, number> = { all: allOrgs.length };
  for (const f of FILTERS) {
    if (f.key === 'all') continue;
    counts[f.key] = f.types ? allOrgs.filter((o) => f.types!.includes(o.type)).length : 0;
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organisations</h1>
          <p className="text-sm text-slate-600 mt-1">
            {allOrgs.length} organisation{allOrgs.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href="/organisations/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New organisation
        </Link>
      </div>

      <div className="flex items-center gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {FILTERS.map((f) => {
          const active = activeFilter.key === f.key;
          const count = counts[f.key] ?? 0;
          return (
            <Link
              key={f.key}
              href={`?filter=${f.key}`}
              className={cn(
                'px-3 py-2.5 text-sm whitespace-nowrap',
                active
                  ? 'font-medium text-slate-900 border-b-2 border-slate-900 -mb-px'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {f.label}
              {count > 0 && <span className="text-xs ml-1 text-slate-400">{count}</span>}
            </Link>
          );
        })}
      </div>

      {orgs.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-sm text-slate-500">
          No organisations match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {orgs.map((o) => {
            const tags = parseTags(o.tags);
            const initialsLogo = (o.common_name ?? o.name).slice(0, 4);
            return (
              <Link
                key={o.id}
                href={`/organisations/${o.slug}`}
                className="bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm',
                    TYPE_COLOUR[o.type] ?? TYPE_COLOUR.other,
                  )}>
                    {initialsLogo}
                  </div>
                  <span className={cn(
                    'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium',
                    TYPE_COLOUR[o.type] ?? TYPE_COLOUR.other,
                  )}>
                    {typeLabel(o.type)}
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-tight">{o.name}</h3>
                {o.parent_name && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Part of <span className="text-slate-700">{o.parent_name}</span>
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  {o.contacts_count} contact{o.contacts_count === 1 ? '' : 's'} · {o.interactions_count} interaction{o.interactions_count === 1 ? '' : 's'}
                </p>
                {tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {tags.map((t) => (
                      <span key={t} className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
