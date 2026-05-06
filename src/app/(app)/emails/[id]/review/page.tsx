import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { interactions, interactionParticipants, contacts, organisations, actionItems } from '@/db/schema';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { formatDateTime } from '@/lib/utils';
import { slugify, uniqueSlug } from '@/lib/slug';
import { SuggestedParticipantsForm } from '@/components/suggested-participants';
import { DecisionsList } from '@/components/decisions-list';

async function confirm(formData: FormData) {
  'use server';
  const user = await requireRole('member');
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const summary = String(formData.get('summary') ?? '').trim();
  const decisions = formData.getAll('decision').map(String).filter(Boolean);
  const actionDescriptions = formData.getAll('actionDescription').map(String);
  const actionDueDates = formData.getAll('actionDueDate').map(String);
  const acceptAction = formData.getAll('acceptAction').map(String);

  await db
    .update(interactions)
    .set({ summary, decisions, reviewStatus: 'confirmed', suggestedParticipants: [] })
    .where(eq(interactions.id, id));

  for (let i = 0; i < actionDescriptions.length; i++) {
    if (!acceptAction.includes(String(i))) continue;
    const desc = actionDescriptions[i].trim();
    if (!desc) continue;
    await db.insert(actionItems).values({
      id: randomUUID(),
      interactionId: id,
      description: desc,
      ownerUserId: user.id,
      dueDate: actionDueDates[i] ? new Date(`${actionDueDates[i]}T00:00:00`) : null,
      status: 'open',
    });
  }

  // Process suggested-participant choices. Form fields are indexed:
  //   mention_<i>_name, mention_<i>_action, mention_<i>_matchContactId,
  //   mention_<i>_newEmail, mention_<i>_newOrganisationId.
  let mentionIdx = 0;
  let linked = 0;
  let created = 0;
  while (true) {
    const name = String(formData.get(`mention_${mentionIdx}_name`) ?? '');
    if (!name) break;
    const action = String(formData.get(`mention_${mentionIdx}_action`) ?? 'skip');

    if (action === 'match') {
      const cid = String(formData.get(`mention_${mentionIdx}_matchContactId`) ?? '');
      if (cid) {
        await db
          .insert(interactionParticipants)
          .values({ interactionId: id, contactId: cid, role: 'mentioned' })
          .onConflictDoNothing();
        linked++;
      }
    } else if (action === 'create') {
      const email = String(formData.get(`mention_${mentionIdx}_newEmail`) ?? '').trim() || null;
      const organisationId =
        String(formData.get(`mention_${mentionIdx}_newOrganisationId`) ?? '') || null;
      const newId = randomUUID();
      const slug = await uniqueSlug(name, async (s) => {
        const existing = await db
          .select({ id: contacts.id })
          .from(contacts)
          .where(eq(contacts.slug, s))
          .limit(1);
        return existing.length > 0;
      });
      await db.insert(contacts).values({
        id: newId,
        slug,
        fullName: name,
        primaryEmail: email,
        organisationId,
        createdBy: user.id,
      });
      await db.insert(interactionParticipants).values({
        interactionId: id,
        contactId: newId,
        role: 'mentioned',
      });
      created++;
    }
    mentionIdx++;
  }

  await logAudit({
    actorUserId: user.id,
    action: 'email.confirmed',
    entityType: 'interaction',
    entityId: id,
    details: {
      decisions: decisions.length,
      actions: acceptAction.length,
      linkedMentions: linked,
      createdContacts: created,
    },
  });
  redirect(`/meetings/${id}`);
}

async function reject(formData: FormData) {
  'use server';
  const user = await requireRole('member');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await db.update(interactions).set({ reviewStatus: 'rejected' }).where(eq(interactions.id, id));
  await logAudit({
    actorUserId: user.id,
    action: 'email.rejected',
    entityType: 'interaction',
    entityId: id,
  });
  redirect(`/dashboard`);
}

export default async function EmailReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(interactions).where(eq(interactions.id, id)).limit(1);
  if (rows.length === 0) notFound();
  const i = rows[0];
  if (i.kind !== 'email') redirect(`/meetings/${id}`);

  const participants = await db
    .select({
      contact: contacts,
      organisation: organisations,
      role: interactionParticipants.role,
    })
    .from(interactionParticipants)
    .innerJoin(contacts, eq(contacts.id, interactionParticipants.contactId))
    .leftJoin(organisations, eq(organisations.id, contacts.organisationId))
    .where(eq(interactionParticipants.interactionId, id));

  const decisions = parseTags(i.decisions);

  // Synthesise suggested actions from the body. In production these would come from Claude
  // via the inbound webhook and be persisted on the row; here we use a simple heuristic
  // for unedited seed data.
  const suggestedActions = suggestActionsFromBody(i.body ?? '', i.title);

  const suggestedParticipants = Array.isArray(i.suggestedParticipants) ? i.suggestedParticipants : [];
  const allOrgs = await db
    .select({ id: organisations.id, name: organisations.name, commonName: organisations.commonName })
    .from(organisations)
    .orderBy(organisations.name);

  return (
    <div className="p-8 max-w-7xl">
      <nav className="text-sm mb-4">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-900">
          Dashboard
        </Link>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-500">Email review</span>
        <span className="text-slate-400 mx-2">/</span>
        <span className="text-slate-900">{i.title}</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 bg-violet-50 text-violet-700 rounded">Email</span>
            {i.reviewStatus === 'pending' && (
              <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium">Needs review</span>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              AI extracted
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{i.title}</h1>
          <p className="text-sm text-slate-600 mt-1">{formatDateTime(i.occurredAt)}</p>
        </div>
      </div>

      <form action={confirm}>
        <input type="hidden" name="id" value={i.id} />

        <div className="grid grid-cols-2 gap-6">
          {/* Original */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold">Original email</h2>
              <span className="text-xs text-slate-500">Read-only</span>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="w-12 text-slate-500">From</span>
                  <span className="font-medium">{i.emailFromAddress ?? '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-12 text-slate-500">Subject</span>
                  <span>{i.title}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-12 text-slate-500">Date</span>
                  <span>{formatDateTime(i.occurredAt)}</span>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3 text-slate-700 leading-relaxed font-serif whitespace-pre-wrap">
                {i.body ?? '(no body)'}
              </div>
            </div>
          </div>

          {/* Extraction */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="font-semibold">Suggested record</h2>
                <p className="text-xs text-slate-500 mt-0.5">Review and edit before saving.</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Summary</label>
                  <textarea
                    name="summary"
                    rows={4}
                    defaultValue={i.summary ?? ''}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Linked contacts</label>
                  <div className="flex flex-wrap gap-2">
                    {participants.length === 0 ? (
                      <span className="text-xs text-slate-500">No matched contacts.</span>
                    ) : (
                      participants.map(({ contact, organisation }) => (
                        <span key={contact.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-900 rounded-full text-sm">
                          {contact.fullName}
                          {organisation && ` · ${organisation.commonName ?? organisation.name}`}
                          <span className="text-[10px] text-emerald-700 font-medium ml-1">matched</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <SuggestedParticipantsForm
                  suggestions={suggestedParticipants}
                  organisations={allOrgs}
                />

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Decisions</label>
                  <DecisionsList initial={decisions} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Suggested actions</label>
                  <ul className="space-y-2">
                    {suggestedActions.length === 0 && (
                      <li className="text-xs text-slate-500">No actions extracted.</li>
                    )}
                    {suggestedActions.map((a, idx) => (
                      <li key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
                        <input type="checkbox" name="acceptAction" value={String(idx)} defaultChecked className="rounded border-slate-300" />
                        <input
                          type="text"
                          name="actionDescription"
                          defaultValue={a.description}
                          className="flex-1 bg-transparent text-sm focus:outline-none"
                        />
                        <input
                          type="date"
                          name="actionDueDate"
                          defaultValue={a.dueDate}
                          className="text-xs bg-white border border-slate-200 rounded px-2 py-1"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="submit"
                formAction={reject}
                className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reject
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
              >
                Confirm and save
              </button>
            </div>
          </div>
        </div>
      </form>
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

function suggestActionsFromBody(body: string, subject: string): Array<{ description: string; dueDate: string }> {
  const lower = body.toLowerCase();
  const out: Array<{ description: string; dueDate: string }> = [];
  const inDays = (n: number) => {
    const d = new Date(Date.now() + n * 86400000);
    return d.toISOString().slice(0, 10);
  };
  if (lower.includes('risk register')) {
    out.push({ description: 'Refresh risk register', dueDate: inDays(7) });
  }
  if (lower.includes('comms plan') || lower.includes('communications plan')) {
    out.push({ description: 'Draft comms plan with press team', dueDate: inDays(10) });
  }
  if (out.length === 0 && (lower.includes('please') || lower.includes('could you'))) {
    out.push({ description: `Follow up on "${subject}"`, dueDate: inDays(7) });
  }
  return out;
}
