'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type PickerOption = {
  id: string;
  label: string;
  /** Right-aligned secondary text — typically the organisation. */
  secondary?: string;
  /** Searchable but not displayed (e.g. email). */
  searchable?: string;
};

type Props = {
  name: string;
  options: PickerOption[];
  placeholder?: string;
  emptyLabel?: string;
  /** Initial selection in uncontrolled mode. Ignored when `value` is provided. */
  initialSelectedIds?: string[];
  /** When provided, the picker is controlled by the parent. */
  value?: string[];
  onChange?: (ids: string[]) => void;
};

/**
 * A searchable, keyboard-driven multi-select.
 *
 * Renders a hidden <input name={name}> for every selected option, so it
 * drops straight into a server-action form in place of <select multiple>.
 *
 * Keys: ↑/↓ navigate, Enter adds, Esc closes, Backspace on empty removes last.
 *
 * Supports both uncontrolled (initialSelectedIds) and controlled (value+onChange)
 * modes. Use the controlled mode when you need external code to add or remove
 * selections at runtime — e.g. "Smart-fill from transcript".
 */
export function MultiPicker({
  name,
  options,
  placeholder = 'Type to search…',
  emptyLabel = 'No matches',
  initialSelectedIds = [],
  value,
  onChange,
}: Props) {
  const isControlled = value !== undefined;
  const [internalSelected, setInternalSelected] = useState<string[]>(initialSelectedIds);
  const selectedIds = isControlled ? value! : internalSelected;
  const setSelectedIds = (next: string[] | ((prev: string[]) => string[])) => {
    const computed = typeof next === 'function' ? next(selectedIds) : next;
    if (isControlled) {
      onChange?.(computed);
    } else {
      setInternalSelected(computed);
    }
  };
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is PickerOption => Boolean(o)),
    [selectedIds, options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !selectedIds.includes(o.id))
      .filter((o) => {
        if (!q) return true;
        return (
          o.label.toLowerCase().includes(q) ||
          (o.secondary?.toLowerCase().includes(q) ?? false) ||
          (o.searchable?.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 100);
  }, [options, query, selectedIds]);

  // Reset highlight when the filter set changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query, selectedIds.length]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const add = (id: string) => {
    setSelectedIds((s) => (s.includes(id) ? s : [...s, id]));
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (id: string) => {
    setSelectedIds((s) => s.filter((x) => x !== id));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[activeIdx]) {
        e.preventDefault();
        add(filtered[activeIdx].id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Backspace' && !query && selected.length > 0) {
      e.preventDefault();
      remove(selected[selected.length - 1].id);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="min-h-[42px] w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-300 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-slate-100 text-slate-900 rounded-full text-sm"
          >
            <input type="hidden" name={name} value={s.id} />
            <span>{s.label}</span>
            {s.secondary && <span className="text-slate-500">· {s.secondary}</span>}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(s.id);
              }}
              className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              aria-label={`Remove ${s.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={selected.length === 0 ? placeholder : ''}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-[140px] bg-transparent text-sm focus:outline-none px-1 py-1"
        />
      </div>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-72 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">{emptyLabel}</div>
          ) : (
            <ul ref={listRef} className="py-1">
              {filtered.map((o, i) => (
                <li key={o.id}>
                  <button
                    type="button"
                    data-idx={i}
                    onMouseDown={(e) => {
                      // Use mousedown so the input blur doesn't close the menu first.
                      e.preventDefault();
                      add(o.id);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3',
                      i === activeIdx ? 'bg-slate-100' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.secondary && (
                      <span className="text-xs text-slate-500 flex-shrink-0">{o.secondary}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>⌫ remove last</span>
            {filtered.length === 100 && <span className="ml-auto">First 100 matches shown</span>}
          </div>
        </div>
      )}
    </div>
  );
}
