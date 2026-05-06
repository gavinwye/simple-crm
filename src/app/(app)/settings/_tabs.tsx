'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/settings/general', label: 'General' },
  { href: '/settings/team', label: 'Team' },
  { href: '/settings/email', label: 'Email ingestion' },
  { href: '/settings/audit', label: 'Audit log' },
];

export function SettingsTabs() {
  const pathname = usePathname() ?? '';
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'px-4 py-2.5 text-sm whitespace-nowrap',
              active
                ? 'font-medium text-slate-900 border-b-2 border-slate-900 -mb-px'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
