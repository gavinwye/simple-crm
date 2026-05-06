'use client';

import { useState } from 'react';

/**
 * Self-contained editable list of decisions for use inside a server-rendered
 * form. Renders one <input name={name}> per row; the parent form posts them
 * as an array via formData.getAll(name). Comes with add and remove rows.
 *
 * Empty rows are intentionally allowed so the user can leave a placeholder;
 * the server action filters them out before persisting.
 */
export function DecisionsList({
  name = 'decision',
  initial = [],
  placeholder = 'Describe the decision…',
}: {
  name?: string;
  initial?: string[];
  placeholder?: string;
}) {
  const [rows, setRows] = useState<string[]>(initial.length > 0 ? [...initial] : ['']);

  const update = (idx: number, value: string) =>
    setRows((r) => r.map((x, i) => (i === idx ? value : x)));
  const remove = (idx: number) =>
    setRows((r) => (r.length === 1 ? [''] : r.filter((_, i) => i !== idx)));
  const add = () => setRows((r) => [...r, '']);

  return (
    <div className="space-y-2">
      {rows.map((value, idx) => (
        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
          <input
            type="text"
            name={name}
            value={value}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-slate-400 hover:text-rose-600"
            aria-label="Remove decision"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-slate-600 hover:text-slate-900 font-medium"
      >
        + Add decision
      </button>
    </div>
  );
}
