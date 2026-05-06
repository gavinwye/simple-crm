'use client';

import { useMemo, useState } from 'react';

type Turn = {
  speaker?: string;
  timestamp?: string;
  text: string;
};

// Section labels that *look* like speakers but are header text we should leave alone.
const SECTION_LABELS = new Set([
  'note', 'notes', 'action', 'actions', 'action item', 'action items',
  'decision', 'decisions', 'summary', 'date', 'time', 'topic', 'agenda',
  'subject', 'attendees', 'present', 'apologies', 'minutes', 'transcript',
]);

const SPEAKER_RE = /^(?:\*\*)?\s*([A-Z][\w'.\- ]{0,49}[A-Za-z'.])(?:\*\*)?\s*(?:[\[(]([^\])]+)[\])])?\s*[:\-—–]\s*(.*)$/;

function parseTranscript(raw: string): Turn[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const turns: Turn[] = [];
  let current: Turn | null = null;

  const finish = () => {
    if (current) {
      current.text = current.text.trim();
      if (current.text) turns.push(current);
      current = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, '');
    if (!line.trim()) {
      // Blank line — keep the current turn open so multi-paragraph turns flow.
      if (current) current.text += '\n';
      continue;
    }

    const m = line.match(SPEAKER_RE);
    const candidate = m?.[1]?.trim() ?? '';
    const looksLikeSpeaker =
      m &&
      candidate.length > 0 &&
      !SECTION_LABELS.has(candidate.toLowerCase()) &&
      // First name + something OR a single capitalised name <= 30 chars
      (candidate.includes(' ') || candidate.length <= 30);

    if (looksLikeSpeaker) {
      finish();
      current = {
        speaker: candidate,
        timestamp: m![2]?.trim(),
        text: m![3] ?? '',
      };
    } else if (current) {
      current.text += (current.text ? '\n' : '') + line;
    } else {
      current = { text: line };
    }
  }
  finish();

  // Group consecutive turns by the same speaker.
  const grouped: Turn[] = [];
  for (const t of turns) {
    const last = grouped[grouped.length - 1];
    if (last && last.speaker && last.speaker === t.speaker) {
      last.text += '\n\n' + t.text;
      // Keep earliest timestamp; ignore subsequent ones.
    } else {
      grouped.push({ ...t });
    }
  }
  return grouped;
}

const SPEAKER_COLOURS = [
  'bg-blue-50 text-blue-900 border-blue-200',
  'bg-emerald-50 text-emerald-900 border-emerald-200',
  'bg-violet-50 text-violet-900 border-violet-200',
  'bg-amber-50 text-amber-900 border-amber-200',
  'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200',
  'bg-cyan-50 text-cyan-900 border-cyan-200',
  'bg-rose-50 text-rose-900 border-rose-200',
  'bg-teal-50 text-teal-900 border-teal-200',
];

function colourFor(speaker: string, palette: Map<string, string>): string {
  const cached = palette.get(speaker);
  if (cached) return cached;
  const next = SPEAKER_COLOURS[palette.size % SPEAKER_COLOURS.length];
  palette.set(speaker, next);
  return next;
}

export function TranscriptViewer({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);
  const turns = useMemo(() => parseTranscript(transcript), [transcript]);
  const speakerCount = useMemo(() => new Set(turns.filter((t) => t.speaker).map((t) => t.speaker)).size, [turns]);

  if (!transcript.trim()) return null;

  const palette = new Map<string, string>();
  const charCount = transcript.length;
  const wordEstimate = Math.round(transcript.split(/\s+/).filter(Boolean).length / 150); // ~150 wpm

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-base">Transcript</h2>
          <span className="text-xs text-slate-500">
            {turns.length === 0 ? '' : `${turns.length} turn${turns.length === 1 ? '' : 's'}`}
            {speakerCount > 0 && ` · ${speakerCount} speaker${speakerCount === 1 ? '' : 's'}`}
            {' · '}
            {charCount.toLocaleString()} chars
            {wordEstimate > 0 && ` · ~${wordEstimate} min read`}
          </span>
        </div>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {open ? 'Hide' : 'Show'}
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-3">
          {turns.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No content.</p>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className="text-sm leading-relaxed">
                {turn.speaker ? (
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-semibold text-xs border ${colourFor(turn.speaker, palette)}`}
                    >
                      {turn.speaker}
                    </span>
                    {turn.timestamp && (
                      <span className="text-[11px] text-slate-400 font-mono">{turn.timestamp}</span>
                    )}
                  </div>
                ) : null}
                <div
                  className={`text-slate-700 whitespace-pre-wrap ${
                    turn.speaker ? 'pl-3 border-l-2 border-slate-100' : ''
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
