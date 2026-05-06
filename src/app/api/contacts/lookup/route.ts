import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireUser } from '@/lib/auth';

/**
 * Returns up to 5 contacts whose name or email matches the query string.
 * Used by the new-contact form to prompt "we may already have this person"
 * before submission.
 *
 * Exact name matches sort first, then prefix matches, then substring matches.
 */
export async function GET(req: Request) {
  await requireUser();

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return NextResponse.json([]);
  const like = `%${q}%`;
  const prefix = `${q}%`;

  const rows = await db.all<{
    id: string;
    slug: string;
    fullName: string;
    title: string | null;
    primaryEmail: string | null;
    organisationName: string | null;
  }>(sql`
    SELECT c.id, c.slug, c.full_name AS fullName, c.title, c.primary_email AS primaryEmail,
      o.name AS organisationName
    FROM contacts c
    LEFT JOIN organisations o ON o.id = c.organisation_id
    WHERE LOWER(c.full_name) LIKE ${like}
       OR LOWER(c.primary_email) LIKE ${like}
    ORDER BY
      CASE WHEN LOWER(c.full_name) = ${q} THEN 0
           WHEN LOWER(c.primary_email) = ${q} THEN 1
           WHEN LOWER(c.full_name) LIKE ${prefix} THEN 2
           ELSE 3 END,
      LENGTH(c.full_name) ASC
    LIMIT 5
  `);

  return NextResponse.json(rows);
}
