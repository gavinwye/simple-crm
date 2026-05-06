import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { organisations } from '@/db/schema';
import { avatarClasses, initials, formatDate, relativeDays } from '@/lib/utils';
import { getOrgAncestry, getOrgChildren, getOrgDescendantIds, typeLabel, isGovernmentType, type OrgNode } from '@/lib/org-tree';
import { DeleteButton } from '@/components/delete-button';
import { deleteOrganisation } from '@/lib/organisations';

export default async function OrganisationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: slugOrId } = await params;
  const rows = await db.select().from(organisations).where(eq(organisations.slug, slugOrId)).limit(1);
  if (rows.length === 0) notFound();
  const org = rows[0];
  const tags = parseTags(org.tags);

  // Tree context: ancestors (for breadcrumbs), children, and the full subtree
  // (for activity rollup).
  const [ancestry, children, descendantIds] = await Promise.all([
    getOrgAncestry(org.id),
    getOrgChildren(org.id),
    getOrgDescendantIds(org.id),
  ]);
  const parents = ancestry.slice(1); // skip self
  const descendantIdList = descendantIds.length > 0 ? descendantIds : [org.id];
  const placeholders = descendantIdList.map(() => '?').join(', ');

  // Direct contacts only (not inherited from children)
  const orgContacts = await dbAll<{
    id: string;
    slug: string;
    full_name: string;
    title: string | null;
    avatar_colour: string;
    sensitive: number;
    last_seen: Date | null;
    interactions_count: number;
  }>(sql`
    SELECT c.id, c.slug, c.full_name, c.title, c.avatar_colour, c.sensitive,
      (SELECT MAX(i.occurred_at) FROM interactions i
        JOIN interaction_participants p ON p.interaction_id = i.id
        WHERE p.contact_id = c.id) AS last_seen,
      (SELECT COUNT(*) FROM interaction_participants p WHERE p.contact_id = c.id) AS interactions_count
    FROM contacts c
    WHERE c.organisation_id = ${org.id}
    ORDER BY interactions_count DESC, c.full_name ASC
  `);

  // Activity across this org AND all descendants — folds department / agency
  // activity into the parent ministry view.
  const recent = await dbAll<{
    id: string;
    title: string;
    kind: string;
    occurred_at: Date;
    summary: string | null;
  }>(sql`
    SELECT DISTINCT i.id, i.title, i.kind, i.occurred_at, i.summary
    FROM interactions i
    JOIN interaction_participants p ON p.interaction_id = i.id
    JOIN contacts c ON c.id = p.contact_id
    WHERE c.organisation_id IN (${sql.join(descendantIdList.map((id) => sql`${id}`), sql`, `)})
    ORDER BY i.occurred_at DESC
    LIMIT 6
  `);

  // Aggregate counts across the subtree.
  const [{ subtreeContacts, subtreeInteractions }] = await dbAll<{
    subtreeContacts: number;
    subtreeInteractions: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM contacts WHERE organisation_id IN (${sql.join(
        descendantIdList.map((id) => sql`${id}`),
        sql`, `,
      )}))::int AS "subtreeContacts",
      (SELECT COUNT(DISTINCT i.id)
         FROM interactions i
         JOIN interaction_participants p ON p.interaction_id = i.id
         JOIN contacts c ON c.id = p.contact_id
         WHERE c.organisation_id IN (${sql.join(
           descendantIdList.map((id) => sql`${id}`),
           sql`, `,
         )}))::int AS "subtreeInteractions"
  `);

  const departments = children.filter((c) => c.type === 'department');
  const subAgencies = children.filter((c) =>
    ['agency', 'statutory_body', 'soe'].includes(c.type),
  );
  const otherChildren = children.filter(
    (c) => c.type !== 'department' && !['agency', 'statutory_body', 'soe'].includes(c.type),
  );

  return (
    <div className="p-8 max-w-7xl">
      <nav className="text-sm mb-4 flex items-center flex-wrap gap-x-1">
        <Link href="/organisations" className="text-slate-500 hover:text-slate-900">
          Organisations
        </Link>
        {[...parents].reverse().map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <span className="text-slate-400 mx-1">/</span>
            <Link href={`/organisations/${p.slug}`} className="text-slate-500 hover:text-slate-900">
              {p.commonName ?? p.name}
            </Link>
          </span>
        ))}
        <span className="text-slate-400 mx-1">/</span>
        <span className="text-slate-900">{org.commonName ?? org.name}</span>
      </nav>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-semibold flex-shrink-0">
            {(org.commonName ?? org.name).slice(0, 4)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
              <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium uppercase tracking-wider">
                {typeLabel(org.type)}
              </span>
              {tags.map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  {t}
                </span>
              ))}
            </div>
            {parents.length > 0 && (
              <p className="text-sm text-slate-600 mt-1">
                Part of{' '}
                {parents.map((p, idx) => (
                  <span key={p.id}>
                    <Link href={`/organisations/${p.slug}`} className="text-slate-700 hover:underline">
                      {p.commonName ?? p.name}
                    </Link>
                    {idx < parents.length - 1 && <span className="text-slate-400"> · </span>}
                  </span>
                ))}
              </p>
            )}
            <p className="text-sm text-slate-700 mt-1">
              {orgContacts.length} direct contact{orgContacts.length === 1 ? '' : 's'}
              {subtreeContacts > orgContacts.length && (
                <span className="text-slate-500">
                  {' '}· {subtreeContacts} across the whole {isGovernmentType(org.type) ? 'tree' : 'group'}
                </span>
              )}
              {' '}· {subtreeInteractions} interaction{subtreeInteractions === 1 ? '' : 's'} logged
            </p>
            {org.website && (
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  {org.website}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DeleteButton
              noun={`${org.commonName ?? org.name}`}
              warning="Refused if any contacts or child organisations still reference this one."
              action={deleteOrganisation.bind(null, org.id)}
            />
            <Link
              href={`/organisations/${org.slug}/edit`}
              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {departments.length > 0 && (
            <ChildrenSection title="Departments" items={departments} parentSlug={org.slug} />
          )}
          {subAgencies.length > 0 && (
            <ChildrenSection title="Agencies & statutory bodies" items={subAgencies} parentSlug={org.slug} />
          )}
          {otherChildren.length > 0 && (
            <ChildrenSection title="Other children" items={otherChildren} parentSlug={org.slug} />
          )}

          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold">People</h2>
              <span className="text-xs text-slate-500">{orgContacts.length} direct</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {orgContacts.length === 0 && (
                <li className="px-5 py-8 text-sm text-slate-500 text-center">No contacts in this organisation yet.</li>
              )}
              {orgContacts.map((p) => {
                const c = avatarClasses(p.avatar_colour);
                return (
                  <li key={p.id}>
                    <Link href={`/contacts/${p.slug}`} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                      <div className={`w-9 h-9 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-semibold`}>
                        {initials(p.full_name)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{p.full_name}</span>
                          {p.sensitive ? <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded">Sensitive</span> : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.title ?? '—'}
                          {p.last_seen ? ` · Last contact ${relativeDays(new Date(p.last_seen))}` : ''}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">
                        {p.interactions_count} interaction{p.interactions_count === 1 ? '' : 's'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold">Recent activity</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {recent.length === 0 && (
                <li className="px-5 py-8 text-sm text-slate-500 text-center">No activity yet.</li>
              )}
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/meetings/${r.id}`} className="block px-5 py-4 hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.title}</span>
                      <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        {r.kind.charAt(0).toUpperCase() + r.kind.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(new Date(r.occurred_at))}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">About</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Type</dt>
                <dd className="mt-0.5">{typeLabel(org.type)}</dd>
              </div>
              {org.commonName && (
                <div>
                  <dt className="text-xs text-slate-500">Common name</dt>
                  <dd className="mt-0.5">{org.commonName}</dd>
                </div>
              )}
              {org.notes && (
                <div>
                  <dt className="text-xs text-slate-500">Notes</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{org.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
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

function ChildrenSection({
  title,
  items,
  parentSlug,
}: {
  title: string;
  items: OrgNode[];
  parentSlug: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-slate-500">{items.length}</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((c) => (
          <li key={c.id}>
            <Link
              href={`/organisations/${c.slug}`}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50"
            >
              <div className="w-9 h-9 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-xs flex-shrink-0">
                {(c.commonName ?? c.name).slice(0, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-xs text-slate-500">{typeLabel(c.type)}</div>
              </div>
              <span className="text-xs text-slate-400">↗</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
