import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  contacts,
  organisations,
  interactions,
  interactionParticipants,
  actionItems,
  contactConnectors,
  users,
} from '@/db/schema';
import { avatarClasses, initials, formatDate, formatDateTime, relativeDays } from '@/lib/utils';
import { ActionCheckbox } from '@/components/action-checkbox';
import { getOrgAncestry } from '@/lib/org-tree';
import { DeleteButton } from '@/components/delete-button';
import { deleteContact } from '@/lib/contacts';
import { ConnectorsPanel, type ConnectorRow } from '@/components/connectors-panel';
import { getCurrentUser } from '@/lib/auth';

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slugOrId } = await params;
  const rows = await db
    .select({
      contact: contacts,
      organisation: organisations,
    })
    .from(contacts)
    .leftJoin(organisations, eq(contacts.organisationId, organisations.id))
    .where(eq(contacts.slug, slugOrId))
    .limit(1);

  if (rows.length === 0) notFound();
  const { contact, organisation } = rows[0];
  const c = avatarClasses(contact.avatarColour);
  const tags = parseTags(contact.tags);

  // Walk the parent chain so we can show "CIO · Digital Government · MIST".
  const orgChain = organisation ? await getOrgAncestry(organisation.id) : [];

  // Activity timeline – meetings, emails, notes the contact participated in
  const activity = await db
    .select({ interaction: interactions })
    .from(interactionParticipants)
    .innerJoin(interactions, eq(interactions.id, interactionParticipants.interactionId))
    .where(eq(interactionParticipants.contactId, contact.id))
    .orderBy(desc(interactions.occurredAt))
    .limit(20);

  // Open actions targeting this contact
  const openActions = await db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.ownerContactId, contact.id), eq(actionItems.status, 'open')));

  // Connectors: GovTech members who say they have a relationship with this contact.
  const connectorRows = await db
    .select({
      id: contactConnectors.id,
      userId: contactConnectors.userId,
      strength: contactConnectors.strength,
      notes: contactConnectors.notes,
      userName: users.name,
      userAvatarColour: users.avatarColour,
    })
    .from(contactConnectors)
    .innerJoin(users, eq(users.id, contactConnectors.userId))
    .where(eq(contactConnectors.contactId, contact.id))
    .orderBy(users.name);
  const connectors: ConnectorRow[] = connectorRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    userAvatarColour: r.userAvatarColour,
    strength: r.strength,
    notes: r.notes,
  }));

  const teamRows = await db
    .select({ id: users.id, name: users.name, avatarColour: users.avatarColour })
    .from(users)
    .orderBy(users.name);

  const me = await getCurrentUser();

  return (
    <div className="p-8 max-w-7xl">
      <nav className="text-sm mb-4">
        <Link href="/contacts" className="text-slate-500 hover:text-slate-900">
          Contacts
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">{contact.fullName}</span>
      </nav>

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-full ${c.bg} ${c.text} flex items-center justify-center font-semibold text-xl flex-shrink-0`}>
            {initials(contact.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight">{contact.fullName}</h1>
              {contact.sensitive && (
                <span className="text-[11px] px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-medium">Sensitive</span>
              )}
              {tags.map((t) => (
                <span key={t} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                  {t}
                </span>
              ))}
            </div>
            {(contact.title || orgChain.length > 0) && (
              <p className="text-sm text-slate-700 mt-1">
                {contact.title}
                {contact.title && orgChain.length > 0 && ' · '}
                {orgChain.map((node, idx) => (
                  <span key={node.id}>
                    <Link href={`/organisations/${node.slug}`} className="hover:underline">
                      {node.commonName ?? node.name}
                    </Link>
                    {idx < orgChain.length - 1 && <span className="text-slate-400"> · </span>}
                  </span>
                ))}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
              {contact.primaryEmail && (
                <a href={`mailto:${contact.primaryEmail}`} className="flex items-center gap-1.5 hover:text-slate-900">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25" />
                  </svg>
                  {contact.primaryEmail}
                </a>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {contact.phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeleteButton
              noun={`${contact.fullName}`}
              warning="Action items they own become unassigned. This can't be undone."
              action={deleteContact.bind(null, contact.id)}
            />
            <Link
              href={`/contacts/${contact.slug}/edit`}
              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
            <Link
              href={`/meetings/new?contact=${contact.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Log meeting
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold">Activity ({activity.length})</h2>
            </div>
            <div className="p-5 space-y-5">
              {activity.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No activity recorded yet.</p>
              )}
              {activity.map(({ interaction }, idx) => {
                const isLast = idx === activity.length - 1;
                return (
                  <div key={interaction.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <TimelineDot kind={interaction.kind} />
                      {!isLast && <div className="w-px flex-1 bg-slate-200 my-2" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={interaction.kind === 'email' && interaction.reviewStatus === 'pending' ? `/emails/${interaction.id}/review` : `/meetings/${interaction.id}`}
                          className="font-medium hover:underline"
                        >
                          {interaction.title}
                        </Link>
                        <span className={kindBadge(interaction.kind)}>{labelFor(interaction.kind)}</span>
                        {interaction.reviewStatus === 'pending' && (
                          <span className="text-[11px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Needs review</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(interaction.occurredAt)}</p>
                      {interaction.summary && (
                        <div className="mt-2 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Summary:</span> {interaction.summary}
                        </div>
                      )}
                      {!interaction.summary && interaction.body && (
                        <p className="text-sm text-slate-700 mt-2 line-clamp-3">{interaction.body.replace(/^#+\s.+/gm, '').trim()}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">About</h3>
            <dl className="space-y-3 text-sm">
              {organisation && (
                <div>
                  <dt className="text-xs text-slate-500">Organisation</dt>
                  <dd className="mt-0.5">
                    <Link href={`/organisations/${organisation.slug}`} className="text-slate-900 hover:underline">
                      {organisation.name}
                    </Link>
                  </dd>
                </div>
              )}
              {contact.title && (
                <div>
                  <dt className="text-xs text-slate-500">Title</dt>
                  <dd className="mt-0.5">{contact.title}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">Sensitivity</dt>
                <dd className="mt-0.5 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${contact.sensitive ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {contact.sensitive ? 'Sensitive' : 'Normal'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">First met</dt>
                <dd className="mt-0.5">{formatDate(contact.createdAt)}</dd>
              </div>
              {activity[0] && (
                <div>
                  <dt className="text-xs text-slate-500">Last contact</dt>
                  <dd className="mt-0.5">{relativeDays(activity[0].interaction.occurredAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          <ConnectorsPanel
            contactId={contact.id}
            connectors={connectors}
            allUsers={teamRows}
            currentUserId={me?.id ?? null}
          />

          {openActions.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Open actions ({openActions.length})
              </h3>
              <ul className="space-y-2.5">
                {openActions.map((a) => {
                  const overdue = a.dueDate && a.dueDate.getTime() < Date.now();
                  return (
                    <li key={a.id} className="flex items-start gap-2.5 text-sm">
                      <ActionCheckbox id={a.id} done={a.status === 'done'} />
                      <div className="flex-1">
                        <p>{a.description}</p>
                        <p className={`text-xs mt-0.5 ${overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                          {overdue ? 'Overdue · ' : 'Due '} {a.dueDate ? formatDate(a.dueDate) : '—'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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

function TimelineDot({ kind }: { kind: string }) {
  if (kind === 'email') {
    return (
      <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25" />
        </svg>
      </div>
    );
  }
  if (kind === 'note') {
    return (
      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07" />
      </svg>
    </div>
  );
}

function kindBadge(kind: string) {
  if (kind === 'email') return 'text-[11px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded';
  return 'text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded';
}

function labelFor(kind: string) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
