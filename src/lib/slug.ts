/**
 * Convert a string into a URL-safe slug.
 *  - lowercased
 *  - accents stripped
 *  - non-alphanumeric runs collapsed to a single hyphen
 *  - trimmed and capped at 80 chars
 *  - never empty (falls back to "item")
 */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

/**
 * Resolve a unique slug. Calls `exists` repeatedly with `base`, `base-2`,
 * `base-3`, ... until one is free. Pass an `excludeId` semantically by
 * implementing it in the `exists` callback.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
    i++;
  }
}
