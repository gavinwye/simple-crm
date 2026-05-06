'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Match = {
  id: string;
  slug: string;
  // Contact fields
  fullName?: string;
  title?: string | null;
  organisationName?: string | null;
  // Org fields
  name?: string;
  commonName?: string | null;
  typeLabel?: string;
};

type Props = {
  /** "fullName" for contacts, "name" for organisations — used as the form input name. */
  inputName: string;
  /** Lookup endpoint, e.g. "/api/contacts/lookup". */
  lookupUrl: string;
  /** Where each match links to (slug interpolated). */
  buildHref: (slug: string) => string;
  /** How to render a match's primary line. */
  renderPrimary: (match: Match) => string;
  /** How to render a match's secondary line. */
  renderSecondary?: (match: Match) => string | null;
  /** Initial value when editing. */
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  /** Threshold to start searching. */
  minLength?: number;
  /** Label shown above the input. */
  label: string;
  /** "person" or "organisation" — used in the message copy. */
  noun: string;
};

/**
 * An input that, after the user has typed a few characters, fetches potential
 * duplicates and shows them inline. Modeled on Asana / Linear / Notion's
 * "did you mean an existing X" prompt.
 *
 * The user can:
 *   - click a match to open it in a new tab (preserving their in-progress form)
 *   - dismiss the panel ("It's a different <noun>") to confirm intent
 *   - keep typing — once the input no longer matches, the panel disappears
 */
export function DuplicateHint({
  inputName,
  lookupUrl,
  buildHref,
  renderPrimary,
  renderSecondary,
  defaultValue,
  placeholder,
  required,
  minLength = 2,
  label,
  noun,
}: Props) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [matches, setMatches] = useState<Match[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastRequestedRef = useRef<string>('');

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < minLength) {
      setMatches([]);
      return;
    }
    if (dismissed) return;

    const handle = window.setTimeout(async () => {
      lastRequestedRef.current = trimmed;
      setLoading(true);
      try {
        const res = await fetch(`${lookupUrl}?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          setMatches([]);
          return;
        }
        const json = (await res.json()) as Match[];
        // Drop late-arriving responses if the user has typed more.
        if (lastRequestedRef.current === trimmed) setMatches(json);
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(handle);
  }, [value, dismissed, lookupUrl, minLength]);

  // Re-show the hint when the user changes the value after dismissing.
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (dismissed) setDismissed(false);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type="text"
        name={inputName}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
      />

      {!dismissed && matches.length > 0 && (
        <div className="mt-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-7.036A11.959 11.959 0 003.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900">
                We may already have this {noun}
              </p>
              <ul className="mt-1.5 space-y-1">
                {matches.map((m) => {
                  const secondary = renderSecondary?.(m);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <Link
                        href={buildHref(m.slug)}
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-amber-900 hover:underline truncate"
                      >
                        <span className="font-medium">{renderPrimary(m)}</span>
                        {secondary && (
                          <span className="text-amber-800/70"> · {secondary}</span>
                        )}
                      </Link>
                      <Link
                        href={buildHref(m.slug)}
                        target="_blank"
                        rel="noopener"
                        className="text-xs text-amber-900 font-medium hover:underline flex-shrink-0"
                      >
                        Open ↗
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="mt-2 text-xs text-amber-900 hover:text-amber-950 underline"
              >
                It&apos;s a different {noun}, continue
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && value.trim().length >= minLength && matches.length === 0 && (
        <p className="text-xs text-slate-500 mt-1.5">Checking for duplicates…</p>
      )}
    </div>
  );
}
