import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { SettingsTabs } from './_tabs';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/dashboard');

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-600 mt-1">Admin-only. Changes here affect the whole pilot.</p>
      </div>

      <SettingsTabs />

      {children}
    </div>
  );
}
