'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { actionItems } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function toggleActionItem(id: string, markDone: boolean) {
  const user = await requireRole('member');

  const next = markDone
    ? { status: 'done' as const, completedAt: new Date() }
    : { status: 'open' as const, completedAt: null };

  await db.update(actionItems).set(next).where(eq(actionItems.id, id));

  await logAudit({
    actorUserId: user.id,
    action: markDone ? 'action.completed' : 'action.reopened',
    entityType: 'action_item',
    entityId: id,
  });

  // Refresh anywhere an action item might appear.
  revalidatePath('/actions');
  revalidatePath('/dashboard');
  revalidatePath('/contacts', 'layout');
  revalidatePath('/meetings', 'layout');
}
