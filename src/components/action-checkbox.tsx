'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleActionItem } from '@/lib/action-items';
import { cn } from '@/lib/utils';

export function ActionCheckbox({
  id,
  done,
  size = 'md',
}: {
  id: string;
  done: boolean;
  size?: 'sm' | 'md';
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [pending, startTransition] = useTransition();

  const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-4 h-4 mt-0.5';

  return (
    <input
      type="checkbox"
      checked={optimisticDone}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.checked;
        startTransition(async () => {
          setOptimisticDone(next);
          await toggleActionItem(id, next);
        });
      }}
      className={cn('rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer', sizeClass)}
      aria-label={done ? 'Mark as open' : 'Mark as done'}
    />
  );
}
