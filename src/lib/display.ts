/**
 * Display-time disambiguation for people whose names collide.
 *
 * Rule of thumb: don't add noise unless it's needed.
 *  - If the name is unique, just show "Sandra Husbands · MIST".
 *  - If the name appears more than once at the same organisation, append the
 *    job title or email to disambiguate.
 *  - If the name appears in multiple organisations, the organisation column
 *    already disambiguates — no extra text needed.
 *
 * Returns a Map keyed by id so callers can look up the rendered label by id.
 */

export type DisambiguableContact = {
  id: string;
  fullName: string;
  title?: string | null;
  email?: string | null;
  organisationName?: string | null;
};

export type ContactDisplay = {
  primary: string;
  secondary?: string;
};

export function disambiguateContacts<T extends DisambiguableContact>(
  contacts: T[],
): Map<string, ContactDisplay> {
  const sameNameSameOrg = new Map<string, number>();
  for (const c of contacts) {
    const k = `${c.fullName.toLowerCase()}|${(c.organisationName ?? '').toLowerCase()}`;
    sameNameSameOrg.set(k, (sameNameSameOrg.get(k) ?? 0) + 1);
  }

  const out = new Map<string, ContactDisplay>();
  for (const c of contacts) {
    const k = `${c.fullName.toLowerCase()}|${(c.organisationName ?? '').toLowerCase()}`;
    const collidesInOrg = (sameNameSameOrg.get(k) ?? 0) > 1;

    let secondary = c.organisationName ?? undefined;
    if (collidesInOrg) {
      const tail = c.title ?? c.email ?? undefined;
      if (tail) {
        secondary = secondary ? `${secondary} · ${tail}` : tail;
      }
    }
    out.set(c.id, { primary: c.fullName, secondary });
  }
  return out;
}
