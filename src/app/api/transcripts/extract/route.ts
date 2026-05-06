import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { extractFromTranscript } from '@/lib/claude';
import { findCandidatesForNames } from '@/lib/people-matching';

const Body = z.object({
  transcript: z.string().min(20).max(120_000),
});

/**
 * Runs Claude transcript extraction and matches the named attendees and
 * mentions against existing contacts. Used by the "Smart-fill from
 * transcript" button on the new-meeting form.
 */
export async function POST(req: Request) {
  await requireRole('member');

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Transcript is required (20–120,000 characters).', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const extraction = await extractFromTranscript({ transcript: parsed.data.transcript });

  // Match attendees and mentions against the contacts database.
  const [attendeeMatches, mentionedMatches] = await Promise.all([
    findCandidatesForNames(extraction.attendees),
    findCandidatesForNames(extraction.mentionedPeople),
  ]);

  return NextResponse.json({
    title: extraction.title,
    summary: extraction.summary,
    decisions: extraction.decisions,
    actionItems: extraction.actionItems,
    attendees: extraction.attendees.map((p, idx) => ({
      ...p,
      candidates: attendeeMatches[idx]?.candidates ?? [],
    })),
    mentionedPeople: extraction.mentionedPeople.map((p, idx) => ({
      ...p,
      candidates: mentionedMatches[idx]?.candidates ?? [],
    })),
  });
}
