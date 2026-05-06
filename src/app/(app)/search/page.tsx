import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { initials, formatDate, avatarClasses } from '@/lib/utils';

type ContactHit = { kind: 'contact'; id: string; slug: string; full_name: string; title: string | null; organisation_name: string | null; avatar_colour: string };
type OrgHit = { kind: 'organisation'; id: string; slug: string; name: string; type: string };
type InteractionHit = { kind: 'interaction'; id: string; title: string; ikind: string; occurred_at: Date; summary: string | null; body: string | null; review_status: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? '').trim();
  const like = `%${term.toLowerCase()}%`;

  let contactsHits: ContactHit[] = [];
  let orgsHits: OrgHit[] = [];
  let interactionsHits: InteractionHit[] = [];

  if (term) {
    contactsHits = await dbAll<ContactHit>(sql`
      SELECT 'contact' AS kind, c.id, c.slug, c.full_name, c.title, c.avatar_colour, o.name AS organisation_name
      FROM contacts c
      LEFT JOIN organisations o ON o.id = c.organisation_id
      WHERE LOWER(c.full_name) LIKE ${like}
        OR LOWER(c.primary_email) LIKE ${like}
        OR LOWER(c.title) LIKE ${like}
        OR LOWER(c.notes) LIKE ${like}
        OR LOWER(c.tags::text) LIKE ${like}
      LIMIT 25
    `);
    orgsHits = await dbAll<OrgHit>(sql`
      SELECT 'organisation' AS kind, id, slug, name, type
      FROM organisations
      WHERE LOWER(name) LIKE ${like}
        OR LOWER(common_name) LIKE ${like}
        OR LOWER(notes) LIKE ${like}
        OR LOWER(tags::text) LIKE ${like}
      LIMIT 25
    `);
    interactionsHits = await dbAll<InteractionHit>(sql`
      SELECT 'interaction' AS kind, id, title, kind AS ikind, occurred_at, summary, body, review_status
      FROM interactions
      WHERE LOWER(title) LIKE ${like}
        OR LOWER(body) LIKE ${like}
        OR LOWER(summary) LIKE ${like}
        OR LOWER(tags::text) LIKE ${like}
      ORDER BY occurred_at DESC
      LIMIT 50
    `);
  }

  const total = contactsHits.length + orgsHits.length + interactionsHits.length;

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Search</h1>
      <p className="text-sm text-slate-600 mb-5">Across contacts, organisations, meetings, emails and notes.</p>

      <form className="relative mb-5">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          name="q"
          defaultValue={term}
          autoFocus
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
        />
      </form>

      {!term ? (
        <div className="text-sm text-slate-500 text-center py-12">Type a term above to search.</div>
      ) : total === 0 ? (
        <div className="text-sm text-slate-500 text-center py-12">No results for &ldquo;{term}&rdquo;.</div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-3">{total} result{total === 1 ? '' : 's'}</p>

          {contactsHits.map((c) => {
            const cl = avatarClasses(c.avatar_colour);
            return (
              <Link
                key={`c-${c.id}`}
                href={`/contacts/${c.slug}`}
                className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full ${cl.bg} ${cl.text} flex items-center justify-center text-sm font-semibold flex-shrink-0`}>
                    {initials(c.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">Contact</span>
                      <span className="font-semibold">{highlight(c.full_name, term)}</span>
                      <span className="text-xs text-slate-500">{[c.title, c.organisation_name].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {orgsHits.map((o) => (
            <Link
              key={`o-${o.id}`}
              href={`/organisations/${o.slug}`}
              className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {o.name.slice(0, 4)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">Organisation</span>
                    <span className="font-semibold">{highlight(o.name, term)}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {interactionsHits.map((i) => {
            const href = i.ikind === 'email' && i.review_status === 'pending' ? `/emails/${i.id}/review` : `/meetings/${i.id}`;
            const snippet = (i.summary ?? i.body ?? '').replace(/\s+/g, ' ').slice(0, 240);
            return (
              <Link
                key={`i-${i.id}`}
                href={href}
                className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-sm transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                    <KindIcon kind={i.ikind} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                        {i.ikind.charAt(0).toUpperCase() + i.ikind.slice(1)}
                      </span>
                      <span className="font-semibold">{highlight(i.title, term)}</span>
                    </div>
                    {snippet && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{highlight(snippet, term)}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">{formatDate(new Date(i.occurred_at))}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'email') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25" />
      </svg>
    );
  }
  if (kind === 'note') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07" />
    </svg>
  );
}

function highlight(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(re);
  return parts.map((p, i) => (re.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>));
}
