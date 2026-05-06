import Link from 'next/link';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  contacts,
  organisations,
  users,
  interactions,
  interactionParticipants,
  interactionInternalAttendees,
  actionItems,
  projects,
} from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { MeetingForm } from '@/components/meeting-form';

async function saveMeeting(formData: FormData) {
  'use server';
  const user = await requireRole('member');

  const title = String(formData.get('title') ?? '').trim();
  const date = String(formData.get('date') ?? '');
  const startTime = String(formData.get('startTime') ?? '');
  const endTime = String(formData.get('endTime') ?? '');
  const location = String(formData.get('location') ?? '').trim() || null;
  const projectId = String(formData.get('projectId') ?? '') || null;
  const body = String(formData.get('body') ?? '').trim() || null;
  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  // Controlled checkbox sends "on" when checked; absent otherwise.
  const sensitive = formData.get('sensitive') === 'on';
  // Hidden fields populated by smart-fill.
  const decisions = formData.getAll('decision').map(String).filter(Boolean);
  const transcript = String(formData.get('transcript') ?? '').trim() || null;

  if (!title || !date) {
    throw new Error('Title and date are required');
  }

  const occurredAt = new Date(`${date}T${startTime || '09:00'}:00`);
  let durationMinutes: number | undefined;
  if (startTime && endTime) {
    const start = new Date(`${date}T${startTime}:00`);
    const end = new Date(`${date}T${endTime}:00`);
    durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  const interactionId = randomUUID();
  await db.insert(interactions).values({
    id: interactionId,
    kind: 'meeting',
    occurredAt,
    title,
    location,
    durationMinutes,
    body,
    projectId: projectId === '' ? null : projectId,
    tags,
    decisions,
    transcript,
    sensitive,
    createdBy: user.id,
  });

  // Attendee contacts
  const attendeeIds = formData.getAll('attendeeContactId').map(String).filter(Boolean);
  for (const cid of attendeeIds) {
    await db
      .insert(interactionParticipants)
      .values({ interactionId, contactId: cid, role: 'attendee' })
      .onConflictDoNothing();
  }

  // Internal attendees
  const internalIds = formData.getAll('internalUserId').map(String).filter(Boolean);
  for (const uid of internalIds) {
    await db
      .insert(interactionInternalAttendees)
      .values({ interactionId, userId: uid })
      .onConflictDoNothing();
  }
  // Always include the creator
  if (!internalIds.includes(user.id)) {
    await db
      .insert(interactionInternalAttendees)
      .values({ interactionId, userId: user.id })
      .onConflictDoNothing();
  }

  // Action items
  const actionDescriptions = formData.getAll('actionDescription').map(String);
  const actionOwners = formData.getAll('actionOwner').map(String);
  const actionDueDates = formData.getAll('actionDueDate').map(String);
  for (let i = 0; i < actionDescriptions.length; i++) {
    const desc = actionDescriptions[i].trim();
    if (!desc) continue;
    await db.insert(actionItems).values({
      id: randomUUID(),
      interactionId,
      description: desc,
      ownerUserId: actionOwners[i] || null,
      dueDate: actionDueDates[i] ? new Date(`${actionDueDates[i]}T00:00:00`) : null,
      status: 'open',
    });
  }

  await logAudit({
    actorUserId: user.id,
    action: 'meeting.created',
    entityType: 'interaction',
    entityId: interactionId,
    details: {
      title,
      attendees: attendeeIds.length,
      actions: actionDescriptions.filter(Boolean).length,
    },
  });

  redirect(`/meetings/${interactionId}`);
}

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  const user = await requireRole('member');
  const { contact: contactSlug } = await searchParams;

  const allContacts = await db
    .select({ contact: contacts, organisation: organisations })
    .from(contacts)
    .leftJoin(organisations, eq(contacts.organisationId, organisations.id))
    .orderBy(contacts.fullName);

  const allUsers = await db.select().from(users).orderBy(users.name);
  const allProjects = await db.select().from(projects).orderBy(projects.name);

  const preselectedContactIds: string[] = [];
  if (contactSlug) {
    const match = allContacts.find(({ contact }) => contact.slug === contactSlug);
    if (match) preselectedContactIds.push(match.contact.id);
  }

  return (
    <div className="p-8 max-w-4xl">
      <nav className="text-sm mb-4">
        <Link href="/meetings" className="text-slate-500 hover:text-slate-900">
          Meetings
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">New meeting</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">Log a meeting</h1>

      <MeetingForm
        formAction={saveMeeting}
        allContacts={allContacts}
        allUsers={allUsers}
        allProjects={allProjects}
        preselectedContactIds={preselectedContactIds}
        currentUserId={user.id}
      />
    </div>
  );
}
