'use client';

import { useState, useTransition } from 'react';
import { updateUserRole } from '@/lib/users';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export function TeamRoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: string;
  disabled?: boolean;
}) {
  const [role, setRole] = useState(currentRole);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
        {ROLE_LABELS[role] ?? role}
      </span>
    );
  }

  const handleChange = (next: string) => {
    const previous = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateUserRole(userId, next);
      } catch (err) {
        setRole(previous);
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value)}
        disabled={pending}
        className="text-sm bg-white border border-slate-200 rounded px-2 py-1 disabled:opacity-50"
      >
        <option value="admin">Admin</option>
        <option value="member">Member</option>
        <option value="viewer">Viewer</option>
      </select>
      {pending && <span className="text-xs text-slate-500">saving…</span>}
      {error && <span className="text-xs text-rose-600 max-w-xs">{error}</span>}
    </div>
  );
}
