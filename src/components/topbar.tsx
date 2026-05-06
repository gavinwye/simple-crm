import Link from 'next/link';
import type { User } from '@/db/schema';

export function Topbar({ user, canWrite }: { user: User; canWrite: boolean }) {
  return (
    <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center gap-6 sticky top-0 z-10">
      <form action="/search" method="get" className="flex-1 max-w-xl relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          name="q"
          placeholder="Search contacts, organisations, meetings…"
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
        />
      </form>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 hidden md:inline">
          Signed in as <span className="font-medium text-slate-700">{user.email}</span>
        </span>
        {canWrite && (
          <Link
            href="/meetings/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New meeting
          </Link>
        )}
      </div>
    </header>
  );
}
