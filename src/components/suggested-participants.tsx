'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SuggestedParticipant } from '@/db/schema';

type Choice =
  | { kind: 'skip' }
  | { kind: 'match'; contactId: string }
  | { kind: 'create'; email: string; organisationId: string };

type OrgOption = { id: string; name: string; commonName: string | null };

export function SuggestedParticipantsForm({
  suggestions,
  organisations,
}: {
  suggestions: SuggestedParticipant[];
  organisations: OrgOption[];
}) {
  // Default each suggestion's action: match to the first exact candidate,
  // otherwise skip. Users can change the choice.
  const [choices, setChoices] = useState<Choice[]>(() =>
    suggestions.map((s) => {
      const exact = s.candidates.find((c) => c.confidence === 'exact');
      if (exact) return { kind: 'match', contactId: exact.contactId };
      return { kind: 'skip' };
    }),
  );

  if (suggestions.length === 0) return null;

  const update = (idx: number, c: Choice) => {
    setChoices((cur) => cur.map((existing, i) => (i === idx ? c : existing)));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
        People mentioned in the body
      </label>
      <p className="text-xs text-slate-500 mb-2">
        Claude found these names in the email body. Link them to existing contacts, create new ones, or
        skip.
      </p>
      <ul className="space-y-2">
        {suggestions.map((s, idx) => (
          <SuggestionRow
            key={idx}
            idx={idx}
            suggestion={s}
            choice={choices[idx]}
            onChange={(c) => update(idx, c)}
            organisations={organisations}
          />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  idx,
  suggestion,
  choice,
  onChange,
  organisations,
}: {
  idx: number;
  suggestion: SuggestedParticipant;
  choice: Choice;
  onChange: (c: Choice) => void;
  organisations: OrgOption[];
}) {
  // Build the dropdown options.
  const candidateOptions = suggestion.candidates.map((c) => ({
    value: `match:${c.contactId}`,
    label:
      c.confidence === 'exact'
        ? `Link to ${c.fullName}${c.organisationName ? ` · ${c.organisationName}` : ''} (exact match)`
        : `Link to ${c.fullName}${c.organisationName ? ` · ${c.organisationName}` : ''} (similar)`,
  }));

  const selectValue = (() => {
    if (choice.kind === 'match') return `match:${choice.contactId}`;
    if (choice.kind === 'create') return 'create';
    return 'skip';
  })();

  const onSelectChange = (value: string) => {
    if (value === 'skip') return onChange({ kind: 'skip' });
    if (value === 'create') return onChange({ kind: 'create', email: '', organisationId: '' });
    if (value.startsWith('match:')) return onChange({ kind: 'match', contactId: value.slice(6) });
  };

  return (
    <li className="px-3 py-2.5 bg-slate-50 rounded-md">
      {/* Hidden inputs that the form posts. Always include the name; encode the
          action and conditional fields based on the current choice. */}
      <input type="hidden" name={`mention_${idx}_name`} value={suggestion.name} />
      <input type="hidden" name={`mention_${idx}_role`} value={suggestion.role ?? ''} />
      <input type="hidden" name={`mention_${idx}_action`} value={choice.kind} />
      {choice.kind === 'match' && (
        <input type="hidden" name={`mention_${idx}_matchContactId`} value={choice.contactId} />
      )}
      {choice.kind === 'create' && (
        <>
          <input type="hidden" name={`mention_${idx}_newEmail`} value={choice.email} />
          <input type="hidden" name={`mention_${idx}_newOrganisationId`} value={choice.organisationId} />
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{suggestion.name}</div>
          {suggestion.role && <div className="text-xs text-slate-500">{suggestion.role}</div>}
        </div>
        <select
          value={selectValue}
          onChange={(e) => onSelectChange(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded px-2 py-1.5 max-w-[280px]"
        >
          <option value="skip">— Skip —</option>
          {candidateOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="create">+ Create new contact</option>
        </select>
      </div>

      {choice.kind === 'match' && (
        <div className="mt-2 text-xs text-slate-500">
          {(() => {
            const c = suggestion.candidates.find((x) => x.contactId === choice.contactId);
            if (!c) return null;
            return (
              <span>
                Linking to{' '}
                <Link
                  href={`/contacts/${c.contactSlug}`}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-700 hover:underline"
                >
                  {c.fullName} ↗
                </Link>
              </span>
            );
          })()}
        </div>
      )}

      {choice.kind === 'create' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            type="email"
            placeholder="Email (optional)"
            value={choice.email}
            onChange={(e) => onChange({ ...choice, email: e.target.value })}
            className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
          />
          <select
            value={choice.organisationId}
            onChange={(e) => onChange({ ...choice, organisationId: e.target.value })}
            className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
          >
            <option value="">No organisation</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.commonName ?? o.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </li>
  );
}
