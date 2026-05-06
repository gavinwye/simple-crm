'use client';

import { useState, useTransition } from 'react';
import { updateMeetingNotes } from '@/lib/meetings';
import { Markdown } from './markdown';

export function EditableNotes({
  meetingId,
  initial,
}: {
  meetingId: string;
  initial: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? '');
  const [saved, setSaved] = useState(initial ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const beginEdit = () => {
    setValue(saved);
    setEditing(true);
    setError(null);
  };

  const cancel = () => {
    setValue(saved);
    setEditing(false);
    setError(null);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateMeetingNotes(meetingId, value);
        setSaved(value);
        setEditing(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  // Empty + not editing → render an "Add notes" placeholder card so users
  // know they can write here even when nothing was captured up-front.
  if (!editing && !saved.trim()) {
    return (
      <div className="bg-white rounded-lg border border-dashed border-slate-200 p-6 flex items-center justify-between">
        <span className="text-sm text-slate-500">No notes yet.</span>
        <button
          type="button"
          onClick={beginEdit}
          className="text-sm text-slate-700 hover:text-slate-900 font-medium"
        >
          + Add notes
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">Notes</h2>
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
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={Math.max(8, value.split('\n').length + 2)}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            autoFocus
          />
          {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
          <p className="text-xs text-slate-500 mt-2">Markdown is preserved. Saved content shows in plain text.</p>
        </>
      ) : (
        <Markdown source={saved} />
      )}
    </div>
  );
}
