'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Contact, Organisation, User, Project } from '@/db/schema';
import { MultiPicker } from '@/components/multi-picker';
import { SmartFillTranscript, type Extraction } from '@/components/smart-fill-transcript';
import { disambiguateContacts } from '@/lib/display';

type ActionRow = { description: string; ownerUserId: string; dueDate: string };

type Props = {
  formAction: (formData: FormData) => Promise<void>;
  allContacts: Array<{ contact: Contact; organisation: Organisation | null }>;
  allUsers: User[];
  allProjects: Project[];
  preselectedContactIds: string[];
  currentUserId: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function MeetingForm({
  formAction,
  allContacts,
  allUsers,
  allProjects,
  preselectedContactIds,
  currentUserId,
}: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [projectId, setProjectId] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [actions, setActions] = useState<ActionRow[]>(() =>
    Array.from({ length: 3 }, () => ({ description: '', ownerUserId: '', dueDate: '' })),
  );
  const [attendeeIds, setAttendeeIds] = useState<string[]>(preselectedContactIds);
  const [internalUserIds, setInternalUserIds] = useState<string[]>([]);
  // Decisions are a first-class field – users can type them, and smart-fill pushes
  // additional ones into this state.
  const [decisions, setDecisions] = useState<string[]>([]);
  // The transcript is still hidden – it can be very long and lives on the
  // meeting page once saved.
  const [appliedTranscript, setAppliedTranscript] = useState<string>('');

  // After smart-fill, surface anything that didn't auto-match.
  const [pendingMentions, setPendingMentions] = useState<Extraction['attendees']>([]);

  // Build picker options with name disambiguation.
  const contactDisplay = disambiguateContacts(
    allContacts.map(({ contact, organisation }) => ({
      id: contact.id,
      fullName: contact.fullName,
      title: contact.title,
      email: contact.primaryEmail,
      organisationName: organisation?.commonName ?? organisation?.name ?? null,
    })),
  );
  const contactOptions = allContacts.map(({ contact }) => {
    const d = contactDisplay.get(contact.id)!;
    return {
      id: contact.id,
      label: d.primary,
      secondary: d.secondary,
      searchable: contact.primaryEmail ?? undefined,
    };
  });

  const userOptions = allUsers.map((u) => ({
    id: u.id,
    label: u.name,
    secondary: u.role.charAt(0).toUpperCase() + u.role.slice(1),
    searchable: u.email,
  }));

  const updateAction = (idx: number, patch: Partial<ActionRow>) => {
    setActions((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addActionRow = () =>
    setActions((rows) => [...rows, { description: '', ownerUserId: '', dueDate: '' }]);

  const handleSmartFillApply = ({
    extraction,
    autoMatchedContactIds,
    transcript,
  }: {
    extraction: Extraction;
    autoMatchedContactIds: string[];
    transcript: string;
  }) => {
    if (!title.trim() && extraction.title) setTitle(extraction.title);

    // Body gets just the summary (notes-style); decisions and transcript are
    // posted as hidden fields and stored in their own columns.
    if (extraction.summary) {
      const block = `## Summary\n\n${extraction.summary}`;
      setBody((existing) => (existing.trim() ? `${existing}\n\n${block}` : block));
    }
    if (extraction.decisions.length > 0) {
      setDecisions((prev) => [...prev, ...extraction.decisions]);
    }
    if (transcript.trim()) {
      setAppliedTranscript(transcript);
    }

    // Map extracted action items into the action rows. Any existing rows that
    // are still empty get filled first; otherwise append new rows.
    if (extraction.actionItems.length > 0) {
      setActions((rows) => {
        const next = [...rows];
        const inDays = (n?: number) =>
          typeof n === 'number'
            ? new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
            : '';
        const findUserIdByName = (name?: string): string => {
          if (!name) return '';
          const lower = name.toLowerCase();
          const match = allUsers.find((u) => u.name.toLowerCase().includes(lower));
          return match?.id ?? '';
        };
        for (const item of extraction.actionItems) {
          const empty = next.findIndex((r) => !r.description.trim());
          const row: ActionRow = {
            description: item.description,
            ownerUserId: findUserIdByName(item.ownerName),
            dueDate: inDays(item.suggestedDueInDays),
          };
          if (empty >= 0) next[empty] = row;
          else next.push(row);
        }
        return next;
      });
    }

    // Add auto-matched contacts to the attendee picker.
    if (autoMatchedContactIds.length > 0) {
      setAttendeeIds((prev) => {
        const set = new Set(prev);
        for (const id of autoMatchedContactIds) set.add(id);
        return Array.from(set);
      });
    }

    // Anything that didn't auto-match becomes a "pending review" chip below.
    const pending = [...extraction.attendees, ...extraction.mentionedPeople].filter((p) => {
      const exactSingle = p.candidates.length === 1 && p.candidates[0].confidence === 'exact';
      if (!exactSingle) return true;
      // Was already a known attendee or just got auto-added — don't surface.
      return !attendeeIds.includes(p.candidates[0].contactId) &&
        !autoMatchedContactIds.includes(p.candidates[0].contactId);
    });
    setPendingMentions(pending);
  };

  const acceptPending = (contactId: string) => {
    setAttendeeIds((prev) => (prev.includes(contactId) ? prev : [...prev, contactId]));
    setPendingMentions((prev) =>
      prev.filter((p) => !p.candidates.some((c) => c.contactId === contactId)),
    );
  };

  const dismissPending = (name: string) => {
    setPendingMentions((prev) => prev.filter((p) => p.name !== name));
  };

  return (
    <form action={formAction} className="space-y-5">
      <SmartFillTranscript onApply={handleSmartFillApply} knownAttendeeIds={attendeeIds} />

      {pendingMentions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-900 mb-2">Names from the transcript still to handle</p>
          <ul className="space-y-2">
            {pendingMentions.map((p) => (
              <li key={p.name} className="text-sm flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{p.name}</span>
                  {p.role && <span className="text-amber-800/70"> · {p.role}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {p.candidates.slice(0, 3).map((c) => (
                    <button
                      key={c.contactId}
                      type="button"
                      onClick={() => acceptPending(c.contactId)}
                      className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100"
                    >
                      Add {c.fullName}
                      {c.organisationName ? ` · ${c.organisationName}` : ''}
                    </button>
                  ))}
                  {p.candidates.length === 0 && (
                    <span className="text-xs text-amber-800/70">no match in your contacts</span>
                  )}
                  <button
                    type="button"
                    onClick={() => dismissPending(p.name)}
                    className="text-xs text-amber-900 hover:underline"
                    title="Dismiss this name"
                  >
                    Skip
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-800/80 mt-2">
            For names with no match, save the meeting first, then create the contact from the contacts page and re-attach.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
          <input
            type="text"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Quarterly review with MIST"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              type="date"
              name="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Start</label>
            <input
              type="time"
              name="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">End</label>
            <input
              type="time"
              name="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Location</label>
            <input
              type="text"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Office, video, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Project (optional)</label>
            <select
              name="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            >
              <option value="">—</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">External attendees</label>
          <MultiPicker
            name="attendeeContactId"
            placeholder="Type a name, email, or organisation…"
            emptyLabel="No matching contacts."
            options={contactOptions}
            value={attendeeIds}
            onChange={setAttendeeIds}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">GovTech attendees</label>
          <MultiPicker
            name="internalUserId"
            placeholder="Add team members…"
            emptyLabel="No matching team members."
            options={userOptions}
            value={internalUserIds}
            onChange={setInternalUserIds}
          />
          <p className="text-xs text-slate-500 mt-1.5">You will be added automatically as the creator.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes &amp; discussion</label>
        <p className="text-xs text-slate-500 mb-2">Markdown supported. Capture what was discussed and decided.</p>
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
        />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-slate-700">Decisions</label>
          <button
            type="button"
            onClick={() => setDecisions((prev) => [...prev, ''])}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            + Add decision
          </button>
        </div>
        {decisions.length === 0 ? (
          <p className="text-xs text-slate-500">
            No decisions yet. Add one above, or use Smart-fill from a transcript to extract them.
          </p>
        ) : (
          <div className="space-y-2">
            {decisions.map((value, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  name="decision"
                  value={value}
                  onChange={(e) =>
                    setDecisions((rows) => rows.map((r, i) => (i === idx ? e.target.value : r)))
                  }
                  placeholder="Describe the decision…"
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDecisions((rows) =>
                      rows.length === 1 ? [] : rows.filter((_, i) => i !== idx),
                    )
                  }
                  className="text-slate-400 hover:text-rose-600"
                  aria-label="Remove decision"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-slate-700">Action items</label>
          <button
            type="button"
            onClick={addActionRow}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            + Add action
          </button>
        </div>
        <div className="space-y-2">
          {actions.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-md">
              <input
                type="text"
                name="actionDescription"
                value={row.description}
                onChange={(e) => updateAction(idx, { description: e.target.value })}
                placeholder="Description (leave blank to skip)"
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <select
                name="actionOwner"
                value={row.ownerUserId}
                onChange={(e) => updateAction(idx, { ownerUserId: e.target.value })}
                className="text-xs bg-white border border-slate-200 rounded px-2 py-1"
              >
                <option value="">—</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="actionDueDate"
                value={row.dueDate}
                onChange={(e) => updateAction(idx, { dueDate: e.target.value })}
                className="text-xs bg-white border border-slate-200 rounded px-2 py-1"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
          <input
            type="text"
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="comma, separated, tags"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Sensitivity</label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sensitive"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Mark as sensitive · admins and explicit invitees only
          </label>
        </div>
      </div>

      {/* Hidden fields posted to the server action. The transcript is hidden
          because it can be very long; it's saved separately and shown on the
          meeting page in a collapsible viewer. */}
      <input type="hidden" name="creatorUserId" value={currentUserId} />
      <input type="hidden" name="transcript" value={appliedTranscript} />

      {appliedTranscript && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-900">
            Smart-fill will save a transcript ({appliedTranscript.length.toLocaleString()} chars) with this meeting.
          </span>
          <button
            type="button"
            onClick={() => setAppliedTranscript('')}
            className="text-xs text-blue-900 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href="/meetings"
          className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
        >
          Save meeting
        </button>
      </div>
    </form>
  );
}
