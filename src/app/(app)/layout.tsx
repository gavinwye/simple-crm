import { eq, count } from 'drizzle-orm';
import { db } from '@/db';
import { actionItems } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [{ open }] = await db
    .select({ open: count() })
    .from(actionItems)
    .where(eq(actionItems.status, 'open'));

  const canWrite = user.role !== 'viewer';

  return (
    <>
      <Sidebar user={user} openActionsCount={Number(open) || 0} />
      <main className="ml-60 min-h-screen">
        <Topbar user={user} canWrite={canWrite} />
        {children}
      </main>
    </>
  );
}
