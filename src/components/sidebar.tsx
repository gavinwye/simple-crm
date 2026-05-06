'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@/db/schema';
import { avatarClasses, initials, cn } from '@/lib/utils';

const NAV: Array<{ href: string; label: string; match: RegExp; icon: React.ReactNode }> = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    match: /^\/dashboard/,
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.121 0L22.28 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    ),
  },
  {
    href: '/contacts',
    label: 'Contacts',
    match: /^\/contacts/,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
  },
  {
    href: '/organisations',
    label: 'Organisations',
    match: /^\/organisations/,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />,
  },
  {
    href: '/meetings',
    label: 'Meetings',
    match: /^\/(meetings|emails)/,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />,
  },
  {
    href: '/actions',
    label: 'Action items',
    match: /^\/actions/,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
  {
    href: '/search',
    label: 'Search',
    match: /^\/search/,
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />,
  },
];

export function Sidebar({ user, openActionsCount = 0 }: { user: User; openActionsCount?: number }) {
  const pathname = usePathname() ?? '';
  const c = avatarClasses(user.avatarColour);

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-slate-900 text-slate-100 flex flex-col z-20">
      <div className="px-5 py-5 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-900 font-bold text-sm">
            G
          </div>
          <div>
            <div className="font-semibold tracking-tight text-sm leading-tight">Stakeholders</div>
            <div className="text-[11px] text-slate-400 leading-tight">GovTech Barbados</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const isActive = item.match.test(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'nav-link flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                isActive
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                {item.icon}
              </svg>
              {item.label}
              {item.label === 'Action items' && openActionsCount > 0 && (
                <span className="ml-auto text-[11px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                  {openActionsCount}
                </span>
              )}
            </Link>
          );
        })}

        {user.role === 'admin' && (
          <div className="pt-4 mt-4 border-t border-slate-800">
            <div className="px-3 text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Admin</div>
            <Link
              href="/settings/audit"
              className={cn(
                'nav-link flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                pathname.startsWith('/settings/audit')
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Audit log
            </Link>
            <Link
              href="/settings"
              className={cn(
                'nav-link flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                pathname.startsWith('/settings') && !pathname.startsWith('/settings/audit')
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.559-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78.165-.398.142-.854-.108-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
          </div>
        )}
      </nav>

      <form action="/api/auth/signout" method="post" className="px-3 py-3 border-t border-slate-800">
        <button type="submit" className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-800 text-left" title="Sign out">
          <div className={`w-7 h-7 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-semibold`}>
            {initials(user.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{user.name}</div>
            <div className="text-[11px] text-slate-400 capitalize">{user.role}</div>
          </div>
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
        </button>
      </form>
    </aside>
  );
}
