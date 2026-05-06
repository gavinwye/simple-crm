'use client';

import { useState } from 'react';

export type ExtractedAttendee = {
  name: string;
  role?: string;
  candidates: Array<{
    contactId: string;
    contactSlug: string;
    fullName: string;
    title: string | null;
    organisationName: string | null;
    confidence: 'exact' | 'partial';
  }>;
};

export type Extraction = {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{ description: string; ownerName?: string; suggestedDueInDays?: number }>;
  attendees: ExtractedAttendee[];
  mentionedPeople: ExtractedAttendee[];
};

type ApplyPayload = {
  extraction: Extraction;
  /** Contact IDs to auto-add (exact, single-candidate matches). */
  autoMatchedContactIds: string[];
  /** The original transcript text — included so the parent can stash it in body. */
  transcript: string;
};

export function SmartFillTranscript({
  onApply,
  knownAttendeeIds,
}: {
  onApply: (payload: ApplyPayload) => void;
  /** IDs already in the attendees picker so we don't double-count them. */
  knownAttendeeIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runExtract = async () => {
    setLoading(true);
    setError(null);
    setExtraction(null);
    try {
      const res = await fetch('/api/transcripts/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      const data = (await res.json()) as Extraction;
      setExtraction(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!extraction) return;
    // Auto-add exact, single-candidate matches.
    const autoMatched: string[] = [];
    const seen = new Set(knownAttendeeIds);
    for (const a of extraction.attendees) {
      const exact = a.candidates.filter((c) => c.confidence === 'exact');
      if (exact.length === 1 && !seen.has(exact[0].contactId)) {
        autoMatched.push(exact[0].contactId);
        seen.add(exact[0].contactId);
      }
    }
    onApply({ extraction, autoMatchedContactIds: autoMatched, transcript });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI
          </span>
          <span className="font-medium text-sm">Smart-fill from transcript</span>
          <span className="text-xs text-slate-500">
            Paste a Krisp / Granola / Otter transcript to pre-fill the form
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 pt-1 space-y-3 border-t border-slate-100">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
            placeholder="Paste your meeting transcript here…"
            className="w-full px-3 py-2 border border-dashed border-slate-300 rounded-md text-sm font-mono leading-relaxed bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={runExtract}
              disabled={loading || transcript.trim().length < 20}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Extracting…' : 'Extract'}
            </button>
            {transcript.trim().length > 0 && transcript.trim().length < 20 && (
              <span className="text-xs text-slate-500">Paste at least 20 characters.</span>
            )}
            {error && <span className="text-xs text-rose-600">{error}</span>}
          </div>

          {extraction && (
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-md space-y-3">
              <div className="text-xs font-medium text-slate-700 uppercase tracking-wider">Extracted</div>

              <ResultRow label="Title">{extraction.title || <em className="text-slate-400">(none)</em>}</ResultRow>
              <ResultRow label="Summary">
                <span className="text-slate-700">
                  {truncate(extraction.summary, 220) || <em className="text-slate-400">(none)</em>}
                </span>
              </ResultRow>
              <ResultRow label="Decisions">
                {extraction.decisions.length === 0 ? (
                  <em className="text-slate-400">none</em>
                ) : (
                  <ul className="list-disc pl-4 space-y-0.5">
                    {extraction.decisions.map((d, i) => (
                      <li key={i} className="text-slate-700">{d}</li>
                    ))}
                  </ul>
                )}
              </ResultRow>
              <ResultRow label="Actions">
                {extraction.actionItems.length === 0 ? (
                  <em className="text-slate-400">none</em>
                ) : (
                  <span className="text-slate-700">{extraction.actionItems.length} item{extraction.actionItems.length === 1 ? '' : 's'}</span>
                )}
              </ResultRow>
              <ResultRow label="Attendees">
                <AttendeeSummary list={extraction.attendees} />
              </ResultRow>
              {extraction.mentionedPeople.length > 0 && (
                <ResultRow label="Mentioned">
                  <AttendeeSummary list={extraction.mentionedPeople} />
                </ResultRow>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={apply}
                  className="px-3 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
                >
                  Apply to form
                </button>
                <button
                  type="button"
                  onClick={() => setExtraction(null)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Discard
                </button>
                <span className="text-xs text-slate-500 ml-auto">
                  Existing form values won't be overwritten unless empty.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function AttendeeSummary({ list }: { list: ExtractedAttendee[] }) {
  if (list.length === 0) return <em className="text-slate-400">none</em>;
  return (
    <ul className="space-y-0.5">
      {list.map((a, i) => {
        const exactSingle = a.candidates.length === 1 && a.candidates[0].confidence === 'exact';
        const ambiguous = a.candidates.length > 1;
        const noMatch = a.candidates.length === 0;
        return (
          <li key={i} className="text-slate-700">
            <span className="font-medium">{a.name}</span>
            {a.role && <span className="text-slate-500"> · {a.role}</span>}
            {exactSingle && (
              <span className="text-emerald-700 text-xs ml-2">→ {a.candidates[0].fullName} ✓</span>
            )}
            {ambiguous && (
              <span className="text-amber-700 text-xs ml-2">{a.candidates.length} candidates – review after applying</span>
            )}
            {noMatch && <span className="text-slate-500 text-xs ml-2">no match – create after applying</span>}
          </li>
        );
      })}
    </ul>
  );
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n) + '…';
}
