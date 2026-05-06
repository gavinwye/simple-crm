import type { Organisation } from '@/db/schema';

export type OrgPickerOption = {
  id: string;
  name: string;
  commonName: string | null;
  type: string;
  depth: number;
};

/**
 * Order organisations as a depth-first tree so the parent picker reads
 * naturally: ministry → its departments → its agencies → next ministry, etc.
 * Top-level orgs (no parent) come first, ordered by name.
 *
 * Pass `excludeId` to remove an org and all its descendants from the list —
 * used by the org edit form to prevent picking yourself or a descendant as
 * your parent (which would cycle).
 */
export function buildParentOptions(
  all: Organisation[],
  excludeId?: string,
): OrgPickerOption[] {
  const childrenOf = new Map<string | null, Organisation[]>();
  for (const o of all) {
    const list = childrenOf.get(o.parentId ?? null) ?? [];
    list.push(o);
    childrenOf.set(o.parentId ?? null, list);
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }

  const out: OrgPickerOption[] = [];
  const visit = (orgId: string | null, depth: number, blocked: boolean) => {
    const kids = childrenOf.get(orgId) ?? [];
    for (const k of kids) {
      const blockHere = blocked || k.id === excludeId;
      if (!blockHere) {
        out.push({
          id: k.id,
          name: k.commonName ?? k.name,
          commonName: k.commonName,
          type: k.type,
          depth,
        });
      }
      visit(k.id, depth + 1, blockHere);
    }
  };
  visit(null, 0, false);
  return out;
}
