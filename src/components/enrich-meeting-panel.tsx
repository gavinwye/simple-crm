'use client';

import { useState, useTransition } from 'react';
import type { User } from '@/db/schema';
import { SmartFillTranscript, type Extraction, type ExtractedAttendee } from '@/components/smart-fill-transcript';
import { enrichMeeting, addMeetingAttendee } from '@/lib/meetings';

type Props = {
  meetingId: string;
  /** Contact IDs already on the meeting, so we don't re-add or re-suggest. */
  existingAttendeeIds: string[];
  /** Internal users so action-item owner names can be matched. */
  allUsers: User[];
};

export function EnrichMeetingPanel({ meetingId, existingAttendeeIds, allUsers }: Props) {
  const [pending, startTransition] = useTransition();
  const [pendingMentions, setPendingMentions] = useState<ExtractedAttendee[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findUserIdByName = (name?: string): string | undefined => {
    if (!name) return undefined;
    const lower = name.toLowerCase();
    const match = allUsers.find((u) => u.name.toLowerCase().includes(lower));
    return match?.id;
  };

  const dueDateInDays = (n?: number): string | undefined => {
    if (typeof n !== 'number') return undefined;
    return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  };

  const onApply = ({
    extraction,
    autoMatchedContactIds,
    transcript,
  }: {
    extraction: Extraction;
    autoMatchedContactIds: string[];
    transcript: string;
  }) => {
    setError(null);
    setConfirmation(null);

    const attendeesToAdd = autoMatchedContactIds.filter((id) => !existingAttendeeIds.includes(id));

    startTransition(async () => {
      try {
        await enrichMeeting(meetingId, {
          summary: extraction.summary,
          decisions: extraction.decisions,
          transcript,
          actionItems: extraction.actionItems.map((a) => ({
            description: a.description,
            ownerUserId: findUserIdByName(a.ownerName),
            dueDate: dueDateInDays(a.suggestedDueInDays),
          })),
          attendeeContactIds: attendeesToAdd,
        });

        const allKnown = new Set([...existingAttendeeIds, ...autoMatchedContactIds]);
        const pending = [...extraction.attendees, ...extraction.mentionedPeople].filter((p) => {
          const exactSingle = p.candidates.length === 1 && p.candidates[0].confidence === 'exact';
          if (exactSingle && allKnown.has(p.candidates[0].contactId)) return false;
          if (exactSingle) return false; // would have been auto-added
          return true;
        });
        setPendingMentions(pending);

        const summaryParts: string[] = [];
        if (extraction.decisions.length > 0)
          summaryParts.push(`${extraction.decisions.length} decision${extraction.decisions.length === 1 ? '' : 's'}`);
        if (extraction.actionItems.length > 0)
          summaryParts.push(`${extraction.actionItems.length} action${extraction.actionItems.length === 1 ? '' : 's'}`);
        if (attendeesToAdd.length > 0)
          summaryParts.push(`${attendeesToAdd.length} attendee${attendeesToAdd.length === 1 ? '' : 's'}`);
        setConfirmation(
          summaryParts.length === 0
            ? 'Transcript added to the meeting.'
            : `Added: ${summaryParts.join(', ')}.`,
        );
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const acceptPending = (mention: ExtractedAttendee, contactId: string) => {
    startTransition(async () => {
      try {
        await addMeetingAttendee(meetingId, contactId);
        setPendingMentions((prev) => prev.filter((p) => p.name !== mention.name));
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const dismissPending = (name: string) => {
    setPendingMentions((prev) => prev.filter((p) => p.name !== name));
  };

  return (
    <div className="space-y-3">
      <SmartFillTranscript onApply={onApply} knownAttendeeIds={existingAttendeeIds} />

      {pending && (
        <p className="text-xs text-slate-500 px-1">Saving…</p>
      )}

      {confirmation && !pending && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900 flex items-center justify-between">
          <span>{confirmation}</span>
          <button
            type="button"
            onClick={() => setConfirmation(null)}
            className="text-emerald-900 hover:underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-900">
          {error}
        </div>
      )}

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
                      disabled={pending}
                      onClick={() => acceptPending(p, c.contactId)}
                      className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100 disabled:opacity-50"
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
                  >
                    Skip
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-800/80 mt-2">
            For names with no match, create the contact from the contacts page and re-attach.
          </p>
        </div>
      )}
    </div>
  );
}
