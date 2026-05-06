import 'server-only';
import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import type { SuggestedParticipant } from '@/db/schema';

type MentionedPerson = { name: string; role?: string };

/**
 * Given a list of names extracted from the body of an email or transcript,
 * find candidate contacts in the database. Returns one entry per input name
 * with zero, one, or many candidate matches.
 *
 * Matching strategy (cheap and good enough for the pilot):
 *  - Exact case-insensitive full-name match → confidence "exact"
 *  - All input tokens appear as space-separated words in a contact's
 *    full_name (handles "Sandra H." matching "Sandra Husbands") → "partial"
 *  - Last name only match when the input has 2+ tokens → "partial"
 *
 * Contacts whose id appears in `excludeContactIds` are skipped — typically
 * the contacts already linked via email headers, so the user doesn't see
 * Sandra Husbands in both the "matched" panel AND the "suggested" panel.
 */
export async function findCandidatesForNames(
  mentioned: MentionedPerson[],
  excludeContactIds: string[] = [],
): Promise<SuggestedParticipant[]> {
  if (mentioned.length === 0) return [];

  // Pull all contacts once. At pilot scale (<2k contacts) this is far cheaper
  // than a query per name.
  const all = await dbAll<{
    id: string;
    slug: string;
    full_name: string;
    title: string | null;
    organisation_name: string | null;
  }>(sql`
    SELECT c.id, c.slug, c.full_name, c.title, o.name AS organisation_name
    FROM contacts c
    LEFT JOIN organisations o ON o.id = c.organisation_id
  `);

  const exclude = new Set(excludeContactIds);
  const pool = all.filter((c) => !exclude.has(c.id));

  return mentioned.map((m) => {
    const candidates = matchOne(m.name, pool);
    return {
      name: m.name,
      role: m.role,
      candidates,
    };
  });
}

function matchOne(
  query: string,
  pool: Array<{ id: string; slug: string; full_name: string; title: string | null; organisation_name: string | null }>,
): SuggestedParticipant['candidates'] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qTokens = q.split(/\s+/).filter(Boolean);

  const candidates: SuggestedParticipant['candidates'] = [];

  for (const c of pool) {
    const name = c.full_name.toLowerCase();
    const tokens = name.split(/\s+/);

    // Exact full-name match.
    if (name === q) {
      candidates.push(toCandidate(c, 'exact'));
      continue;
    }

    // All query tokens appear in the name (in any order, as whole words).
    const allTokensPresent = qTokens.every((t) => tokens.includes(t));
    if (allTokensPresent && qTokens.length >= 1) {
      candidates.push(toCandidate(c, 'partial'));
      continue;
    }

    // Surname match when query has at least two parts.
    if (qTokens.length >= 2) {
      const querySurname = qTokens[qTokens.length - 1];
      const nameSurname = tokens[tokens.length - 1];
      if (querySurname.length >= 3 && querySurname === nameSurname) {
        candidates.push(toCandidate(c, 'partial'));
        continue;
      }
    }
  }

  // Prefer exact matches; cap to 5 to keep the review UI tidy.
  candidates.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'exact' ? -1 : 1));
  return candidates.slice(0, 5);
}

function toCandidate(
  c: { id: string; slug: string; full_name: string; title: string | null; organisation_name: string | null },
  confidence: 'exact' | 'partial',
): SuggestedParticipant['candidates'][number] {
  return {
    contactId: c.id,
    contactSlug: c.slug,
    fullName: c.full_name,
    title: c.title,
    organisationName: c.organisation_name,
    confidence,
  };
}
