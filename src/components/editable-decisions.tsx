'use client';

import { useState, useTransition } from 'react';
import { updateMeetingDecisions } from '@/lib/meetings';

export function EditableDecisions({
  meetingId,
  initial,
}: {
  meetingId: string;
  initial: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(initial.length > 0 ? initial : ['']);
  const [saved, setSaved] = useState<string[]>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const beginEdit = () => {
    setDraft(saved.length > 0 ? [...saved] : ['']);
    setEditing(true);
    setError(null);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = () => {
    setError(null);
    const cleaned = draft.map((d) => d.trim()).filter((d) => d.length > 0);
    startTransition(async () => {
      try {
        await updateMeetingDecisions(meetingId, cleaned);
        setSaved(cleaned);
        setEditing(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const updateRow = (idx: number, value: string) => {
    setDraft((rows) => rows.map((r, i) => (i === idx ? value : r)));
  };
  const removeRow = (idx: number) => {
    setDraft((rows) => (rows.length === 1 ? [''] : rows.filter((_, i) => i !== idx)));
  };
  const addRow = () => setDraft((rows) => [...rows, '']);

  // Read mode: empty state when nothing has ever been recorded.
  if (!editing && saved.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-dashed border-slate-200 p-6 flex items-center justify-between">
        <span className="text-sm text-slate-500">No decisions captured.</span>
        <button
          type="button"
          onClick={beginEdit}
          className="text-sm text-slate-700 hover:text-slate-900 font-medium"
        >
          + Add decisions
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base">
          Decisions
          {!editing && saved.length > 0 && (
            <span className="ml-2 text-xs text-slate-500 font-normal">{saved.length}</span>
          )}
        </h2>
        {!editing ? (
          <button
            type="button"
            onClick={beginEdit}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.map((value, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={value}
                onChange={(e) => updateRow(idx, e.target.value)}
                placeholder="Describe the decision…"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                autoFocus={idx === draft.length - 1 && !value}
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-slate-400 hover:text-rose-600 text-sm"
                aria-label="Remove decision"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            + Add decision
          </button>
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
        </div>
      ) : (
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          {saved.map((d, idx) => (
            <li key={idx}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
