'use client';

import { useState, useTransition } from 'react';

type Props = {
  /** What we're deleting, used in the confirmation prompt. e.g. "this meeting" */
  noun: string;
  /** Server action that performs the delete. Will redirect on success. */
  action: () => Promise<void>;
  /** Optional extra warning copy shown above the buttons. */
  warning?: string;
  /** Variant: 'subtle' for a small icon-link, 'button' for a full button. */
  variant?: 'subtle' | 'button';
  /** Optional label for the trigger; defaults to "Delete". */
  label?: string;
};

export function DeleteButton({
  noun,
  action,
  warning,
  variant = 'button',
  label = 'Delete',
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        // Server action redirects on success; if we're still here, treat as success.
        setConfirming(false);
      } catch (err) {
        // Next.js throws a special "redirect" error from the server action — let it propagate
        // unless the message looks like a real error.
        const msg = (err as Error)?.message ?? 'Something went wrong';
        if (msg.startsWith('NEXT_REDIRECT')) {
          // Redirect is normal; do nothing.
        } else {
          setError(msg);
        }
      }
    });
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className={
          variant === 'subtle'
            ? 'text-sm text-rose-600 hover:text-rose-700 font-medium'
            : 'inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-700 rounded-md text-sm font-medium hover:bg-rose-50'
        }
      >
        {label}
      </button>
    );
  }

  return (
    <div className="inline-flex items-stretch gap-0 rounded-md overflow-hidden border border-rose-300 bg-rose-50">
      <div className="px-3 py-2 text-sm text-rose-900">
        Delete {noun}?
        {warning && <div className="text-xs text-rose-800/80 mt-0.5">{warning}</div>}
        {error && <div className="text-xs text-rose-700 mt-1 max-w-md">{error}</div>}
      </div>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="px-3 py-2 bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed"
      >
        {pending ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        disabled={pending}
        className="px-3 py-2 bg-white text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50 border-l border-rose-300"
      >
        Cancel
      </button>
    </div>
  );
}
