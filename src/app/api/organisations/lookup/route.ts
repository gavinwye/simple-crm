import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { requireUser } from '@/lib/auth';
import { typeLabel } from '@/lib/org-tree';

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
    name: string;
    commonName: string | null;
    type: string;
  }>(sql`
    SELECT id, slug, name, common_name AS commonName, type
    FROM organisations
    WHERE LOWER(name) LIKE ${like} OR LOWER(common_name) LIKE ${like}
    ORDER BY
      CASE WHEN LOWER(name) = ${q} OR LOWER(common_name) = ${q} THEN 0
           WHEN LOWER(name) LIKE ${prefix} OR LOWER(common_name) LIKE ${prefix} THEN 1
           ELSE 2 END,
      LENGTH(name) ASC
    LIMIT 5
  `);

  return NextResponse.json(
    rows.map((r) => ({ ...r, typeLabel: typeLabel(r.type) })),
  );
}
