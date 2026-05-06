import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export type OrgNode = {
  id: string;
  slug: string;
  name: string;
  commonName: string | null;
  type: string;
  parentId: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  ministry: 'Ministry',
  department: 'Department',
  agency: 'Agency',
  statutory_body: 'Statutory body',
  soe: 'State-owned enterprise',
  vendor: 'Vendor',
  partner: 'Partner',
  multilateral: 'Multilateral',
  civil_society: 'Civil society',
  media: 'Media',
  other: 'Other',
};

const GOVERNMENT_TYPES = new Set(['ministry', 'department', 'agency', 'statutory_body', 'soe']);

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function isGovernmentType(type: string): boolean {
  return GOVERNMENT_TYPES.has(type);
}

/**
 * Walk from a starting org up to the root, returning the chain leaf-first.
 * For a contact at "Digital Government Department", returns
 * [Digital Government Department, MIST].
 */
export async function getOrgAncestry(orgId: string): Promise<OrgNode[]> {
  const rows = await db.all<OrgNode>(sql`
    WITH RECURSIVE ancestry(id, slug, name, common_name, type, parent_id, depth) AS (
      SELECT id, slug, name, common_name, type, parent_id, 0
      FROM organisations
      WHERE id = ${orgId}
      UNION ALL
      SELECT o.id, o.slug, o.name, o.common_name, o.type, o.parent_id, a.depth + 1
      FROM organisations o
      JOIN ancestry a ON o.id = a.parent_id
    )
    SELECT id, slug, name, common_name AS commonName, type, parent_id AS parentId
    FROM ancestry
    ORDER BY depth ASC
  `);
  return rows;
}

/**
 * Returns the descendant ids of `orgId` (inclusive of `orgId` itself).
 * Used to roll up activity from a ministry across all of its departments
 * and agencies.
 */
export async function getOrgDescendantIds(orgId: string): Promise<string[]> {
  const rows = await db.all<{ id: string }>(sql`
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM organisations WHERE id = ${orgId}
      UNION ALL
      SELECT o.id
      FROM organisations o
      JOIN descendants d ON o.parent_id = d.id
    )
    SELECT id FROM descendants
  `);
  return rows.map((r) => r.id);
}

/**
 * Direct children of an org (one level only).
 */
export async function getOrgChildren(orgId: string): Promise<OrgNode[]> {
  return db.all<OrgNode>(sql`
    SELECT id, slug, name, common_name AS commonName, type, parent_id AS parentId
    FROM organisations
    WHERE parent_id = ${orgId}
    ORDER BY type ASC, name ASC
  `);
}
