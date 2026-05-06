import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  interactions,
  interactionParticipants,
  interactionInternalAttendees,
  contacts,
  organisations,
  users,
  actionItems,
  projects,
} from '@/db/schema';
import { avatarClasses, initials, formatDate, formatDateTime } from '@/lib/utils';
import { ActionCheckbox } from '@/components/action-checkbox';
import { EnrichMeetingPanel } from '@/components/enrich-meeting-panel';
import { TranscriptViewer } from '@/components/transcript-viewer';
import { EditableNotes } from '@/components/editable-notes';
import { EditableDecisions } from '@/components/editable-decisions';
import { Markdown } from '@/components/markdown';
import { DeleteButton } from '@/components/delete-button';
import { deleteMeeting } from '@/lib/meetings';

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db
    .select({ interaction: interactions, project: projects })
    .from(interactions)
    .leftJoin(projects, eq(interactions.projectId, projects.id))
    .where(eq(interactions.id, id))
    .limit(1);
  if (rows.length === 0) notFound();
  const { interaction, project } = rows[0];

  const externalAttendees = await db
    .select({
      contact: contacts,
      organisation: organisations,
      role: interactionParticipants.role,
    })
    .from(interactionParticipants)
    .innerJoin(contacts, eq(contacts.id, interactionParticipants.contactId))
    .leftJoin(organisations, eq(organisations.id, contacts.organisationId))
    .where(eq(interactionParticipants.interactionId, id));

  const internalAttendees = await db
    .select({ user: users })
    .from(interactionInternalAttendees)
    .innerJoin(users, eq(users.id, interactionInternalAttendees.userId))
    .where(eq(interactionInternalAttendees.interactionId, id));

  const actions = await db
    .select({ action: actionItems, owner: users })
    .from(actionItems)
    .leftJoin(users, eq(actionItems.ownerUserId, users.id))
    .where(eq(actionItems.interactionId, id));

  const tags = parseTags(interaction.tags);
  const decisions = parseTags(interaction.decisions);
  const orgsSet = new Map<string, { id: string; slug: string; name: string; commonName: string | null }>();
  externalAttendees.forEach(({ organisation }) => {
    if (organisation) orgsSet.set(organisation.id, organisation);
  });

  // For the smart-fill enrich panel: existing attendee IDs (so we don't double-add)
  // and the full users list (so action-item owners can be matched by name).
  const existingAttendeeIds = externalAttendees.map(({ contact }) => contact.id);
  const allUsers = await db.select().from(users).orderBy(users.name);
  const isMeeting = interaction.kind === 'meeting';

  return (
    <div className="p-8 max-w-7xl">
      <nav className="text-sm mb-4">
        <Link href="/meetings" className="text-slate-500 hover:text-slate-900">
          Meetings
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">{interaction.title}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
              {interaction.kind.charAt(0).toUpperCase() + interaction.kind.slice(1)}
            </span>
            {tags.map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                {t}
              </span>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{interaction.title}</h1>
          <p className="text-sm text-slate-600 mt-1">
            {formatDateTime(interaction.occurredAt)}
            {interaction.durationMinutes && ` · ${interaction.durationMinutes} min`}
            {interaction.location && ` · ${interaction.location}`}
          </p>
        </div>
        <DeleteButton
          noun="this meeting"
          warning="Action items become orphan tasks; participants and attendees are removed."
          action={deleteMeeting.bind(null, interaction.id)}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {isMeeting && (
            <EnrichMeetingPanel
              meetingId={interaction.id}
              existingAttendeeIds={existingAttendeeIds}
              allUsers={allUsers}
            />
          )}

          {isMeeting ? (
            <EditableNotes meetingId={interaction.id} initial={interaction.body} />
          ) : (
            interaction.body && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="font-semibold text-base mb-4">Notes</h2>
                <Markdown source={interaction.body} />
              </div>
            )
          )}

          {interaction.transcript && interaction.transcript.trim().length > 0 && (
            <TranscriptViewer transcript={interaction.transcript} />
          )}

          {isMeeting ? (
            <EditableDecisions meetingId={interaction.id} initial={decisions} />
          ) : (
            decisions.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="font-semibold text-base mb-3">Decisions</h2>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                  {decisions.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              </div>
            )
          )}

          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold">Action items</h2>
              <span className="text-xs text-slate-500">
                {actions.length} action{actions.length === 1 ? '' : 's'}
                {actions.filter((a) => a.action.status === 'open').length > 0 &&
                  ` · ${actions.filter((a) => a.action.status === 'open').length} open`}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {actions.length === 0 && (
                <li className="px-6 py-8 text-sm text-slate-500 text-center">No action items.</li>
              )}
              {actions.map(({ action, owner }) => {
                const done = action.status === 'done';
                const overdue = !done && action.dueDate && action.dueDate.getTime() < Date.now();
                return (
                  <li key={action.id} className="px-6 py-3.5 flex items-center gap-3">
                    <ActionCheckbox id={action.id} done={done} size="sm" />
                    <div className="flex-1">
                      <p className={`text-sm ${done ? 'line-through text-slate-500' : ''}`}>{action.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Owner: {owner?.name ?? '—'}
                        {action.dueDate && ` · ${done ? 'Completed' : 'Due'} ${formatDate(action.dueDate)}`}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                        done
                          ? 'bg-emerald-50 text-emerald-700'
                          : overdue
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {done ? 'Done' : overdue ? 'Overdue' : 'Open'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Attendees</h3>
            {externalAttendees.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
                  External ({externalAttendees.length})
                </div>
                <ul className="space-y-2 mb-4">
                  {externalAttendees.map(({ contact, organisation }) => {
                    const c = avatarClasses(contact.avatarColour);
                    return (
                      <li key={contact.id} className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-[10px] font-semibold`}>
                          {initials(contact.fullName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/contacts/${contact.slug}`} className="text-sm hover:underline">
                            {contact.fullName}
                          </Link>
                          {organisation && (
                            <div className="text-xs text-slate-500">{organisation.commonName ?? organisation.name}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {internalAttendees.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
                  GovTech ({internalAttendees.length})
                </div>
                <ul className="space-y-2">
                  {internalAttendees.map(({ user }) => {
                    const c = avatarClasses(user.avatarColour);
                    return (
                      <li key={user.id} className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-[10px] font-semibold`}>
                          {initials(user.name)}
                        </div>
                        <span className="text-sm">{user.name}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Linked to</h3>
            <dl className="space-y-3 text-sm">
              {project && (
                <div>
                  <dt className="text-xs text-slate-500">Project</dt>
                  <dd className="mt-0.5">{project.name}</dd>
                </div>
              )}
              {orgsSet.size > 0 && (
                <div>
                  <dt className="text-xs text-slate-500">Organisations</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {[...orgsSet.values()].map((o) => (
                      <Link
                        key={o.id}
                        href={`/organisations/${o.slug}`}
                        className="text-xs px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded"
                      >
                        {o.commonName ?? o.name}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">Logged on</dt>
                <dd className="mt-0.5">{formatDateTime(interaction.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sensitivity</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${interaction.sensitive ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {interaction.sensitive ? 'Sensitive' : 'Normal'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
