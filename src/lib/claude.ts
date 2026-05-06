import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export type EmailExtraction = {
  summary: string;
  decisions: string[];
  actionItems: Array<{ description: string; suggestedDueInDays?: number }>;
  /**
   * People mentioned in the email body but NOT in the From/To/Cc headers.
   * Surfaced to the user during review for matching against existing
   * contacts (or creating new ones).
   */
  mentionedPeople: Array<{ name: string; role?: string }>;
};

const SYSTEM_PROMPT = `You extract structured information from a single email exchange forwarded into a government CRM. You return:

1. A one-paragraph plain-English summary (40-80 words). British English.
2. A list of decisions explicitly stated in the email. Empty array if none.
3. A list of action items implied by the email. Each is a short sentence in imperative form, with an optional suggested due-date in days from now (1-60).
4. A list of people MENTIONED IN THE BODY but who are NOT in the From, To, or Cc headers. For each, return the name as written and (if stated) a short role/title hint. Skip generic team references ("the press team", "MIST"). Only include named individuals. Empty array if no extra people are mentioned.

Be conservative: do not invent decisions, actions, or people. If the email is purely informational, return empty lists.

Output strict JSON matching the schema.`;

export async function extractFromEmail(input: {
  from: string;
  to?: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<EmailExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return stubExtraction(input);
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

  const userPrompt = `Email metadata:
From: ${input.from}
To: ${input.to ?? ''}
Cc: ${input.cc ?? ''}
Subject: ${input.subject}

Email body:
"""
${input.body}
"""

Return JSON of the form:
{
  "summary": "string",
  "decisions": ["string"],
  "actionItems": [{"description": "string", "suggestedDueInDays": number}],
  "mentionedPeople": [{"name": "string", "role": "string"}]
}`;

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = res.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return stubExtraction(input);

    const json = parseJsonFromText(textBlock.text);
    if (!json) return stubExtraction(input);

    return {
      summary: String(json.summary ?? ''),
      decisions: Array.isArray(json.decisions) ? json.decisions.map(String) : [],
      actionItems: Array.isArray(json.actionItems)
        ? json.actionItems.map((a: { description?: unknown; suggestedDueInDays?: unknown }) => ({
            description: String(a.description ?? ''),
            suggestedDueInDays:
              typeof a.suggestedDueInDays === 'number' ? a.suggestedDueInDays : undefined,
          }))
        : [],
      mentionedPeople: Array.isArray(json.mentionedPeople)
        ? json.mentionedPeople
            .map((p: { name?: unknown; role?: unknown }) => ({
              name: String(p.name ?? '').trim(),
              role: typeof p.role === 'string' ? p.role.trim() || undefined : undefined,
            }))
            .filter((p: { name: string }) => p.name.length > 0)
        : [],
    };
  } catch (err) {
    console.error('Claude extraction failed, falling back to stub:', err);
    return stubExtraction(input);
  }
}

// ============================================================================
// Transcript extraction
// ============================================================================

export type TranscriptExtraction = {
  /** Short title inferred from the transcript. */
  title: string;
  /** One-paragraph summary of the meeting (40-100 words). */
  summary: string;
  /** Decisions made during the meeting. */
  decisions: string[];
  /** Action items captured. */
  actionItems: Array<{
    description: string;
    ownerName?: string;
    suggestedDueInDays?: number;
  }>;
  /** Named attendees Claude could identify from the transcript. */
  attendees: Array<{ name: string; role?: string }>;
  /** Other named people mentioned but not clearly attendees. */
  mentionedPeople: Array<{ name: string; role?: string }>;
};

const TRANSCRIPT_SYSTEM_PROMPT = `You extract structured information from a meeting transcript pasted into a government CRM. Transcripts may include speaker labels, timestamps, and chat messages. You return:

1. A short title for the meeting (8 words or fewer). British English. If a title is obvious from the transcript opener, use it; otherwise infer from the topic.
2. A one-paragraph plain-English summary (40-100 words). British English.
3. A list of decisions explicitly made or confirmed. Empty if none.
4. A list of action items in imperative form. Each may include the owner's name (if clearly assigned) and an optional suggested due-date in days from now (1-60).
5. A list of attendees — people who spoke, were addressed by name, or were clearly present. Use the names as written.
6. A list of OTHER people who were merely mentioned in the discussion but were not present.

Be conservative. Do not invent decisions, actions, or people. Output strict JSON.`;

export async function extractFromTranscript(input: {
  transcript: string;
}): Promise<TranscriptExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return stubTranscriptExtraction(input);
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';

  const userPrompt = `Meeting transcript:
"""
${input.transcript}
"""

Return JSON of the form:
{
  "title": "string",
  "summary": "string",
  "decisions": ["string"],
  "actionItems": [{"description": "string", "ownerName": "string", "suggestedDueInDays": number}],
  "attendees": [{"name": "string", "role": "string"}],
  "mentionedPeople": [{"name": "string", "role": "string"}]
}`;

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 2048,
      system: TRANSCRIPT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = res.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return stubTranscriptExtraction(input);

    const json = parseJsonFromText(textBlock.text);
    if (!json) return stubTranscriptExtraction(input);

    return {
      title: String(json.title ?? '').trim(),
      summary: String(json.summary ?? '').trim(),
      decisions: Array.isArray(json.decisions) ? json.decisions.map(String) : [],
      actionItems: Array.isArray(json.actionItems)
        ? json.actionItems.map((a: { description?: unknown; ownerName?: unknown; suggestedDueInDays?: unknown }) => ({
            description: String(a.description ?? '').trim(),
            ownerName: typeof a.ownerName === 'string' ? a.ownerName.trim() || undefined : undefined,
            suggestedDueInDays:
              typeof a.suggestedDueInDays === 'number' ? a.suggestedDueInDays : undefined,
          }))
        : [],
      attendees: namesFromArray(json.attendees),
      mentionedPeople: namesFromArray(json.mentionedPeople),
    };
  } catch (err) {
    console.error('Claude transcript extraction failed, using stub:', err);
    return stubTranscriptExtraction(input);
  }
}

function namesFromArray(raw: unknown): Array<{ name: string; role?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: { name?: unknown; role?: unknown }) => ({
      name: String(p.name ?? '').trim(),
      role: typeof p.role === 'string' ? p.role.trim() || undefined : undefined,
    }))
    .filter((p) => p.name.length > 0);
}

function stubTranscriptExtraction(input: { transcript: string }): TranscriptExtraction {
  const trimmed = input.transcript.replace(/\s+/g, ' ').trim();
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 220);

  // Crude attendee detection: names at the start of lines (speaker labels).
  const attendees = new Set<string>();
  const speakerRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*[:\-]/gm;
  let m;
  while ((m = speakerRegex.exec(input.transcript)) !== null) {
    attendees.add(m[1]);
    if (attendees.size >= 8) break;
  }
  // If speaker labels not found, fall back to proper-noun pairs.
  if (attendees.size === 0) {
    const nameRegex = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
    while ((m = nameRegex.exec(input.transcript)) !== null) {
      attendees.add(m[1]);
      if (attendees.size >= 5) break;
    }
  }

  const lower = input.transcript.toLowerCase();
  const decisions: string[] = [];
  if (lower.includes('agreed') || lower.includes('decided') || lower.includes('approved')) {
    decisions.push(`Decision implied: ${firstSentence.slice(0, 140)}`);
  }

  const actionItems: TranscriptExtraction['actionItems'] = [];
  if (lower.includes('action item') || lower.includes('next step') || lower.includes('to-do')) {
    actionItems.push({ description: 'Review the meeting transcript and add action items', suggestedDueInDays: 7 });
  }

  return {
    title: firstSentence.slice(0, 60) || 'Pasted meeting transcript',
    summary: firstSentence || 'A meeting transcript was pasted.',
    decisions,
    actionItems,
    attendees: [...attendees].map((name) => ({ name })),
    mentionedPeople: [],
  };
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  // Tolerate models that wrap JSON in code fences or add prose.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Fallback when no API key is configured. Produces a deterministic,
 * believable extraction so the demo flows still work.
 */
function stubExtraction(input: {
  from: string;
  subject: string;
  body: string;
}): EmailExtraction {
  const trimmed = input.body.replace(/\s+/g, ' ').trim();
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 220);

  const summary = firstSentence
    ? `${input.from.split('@')[0].replace(/\./g, ' ')} writes about "${input.subject}". ${firstSentence}`
    : `Email from ${input.from} about "${input.subject}".`;

  const lower = input.body.toLowerCase();
  const decisions: string[] = [];
  if (lower.includes('approved') || lower.includes('agreed')) {
    decisions.push(`Decision implied: ${firstSentence.slice(0, 120)}`);
  }

  const actionItems: EmailExtraction['actionItems'] = [];
  if (lower.includes('please') || lower.includes('could you') || lower.includes('can you')) {
    actionItems.push({ description: `Follow up on "${input.subject}"`, suggestedDueInDays: 7 });
  }
  if (lower.includes('schedule') || lower.includes('meeting')) {
    actionItems.push({ description: 'Schedule a follow-up meeting', suggestedDueInDays: 5 });
  }

  // Cheap proper-noun-pair finder so the stub still surfaces names for
  // the matching flow during demos.
  const mentionedPeople: EmailExtraction['mentionedPeople'] = [];
  const seen = new Set<string>();
  const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
  let m;
  while ((m = nameRegex.exec(input.body)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    if (name.split(/\s+/).length < 2) continue;
    mentionedPeople.push({ name });
    if (mentionedPeople.length >= 5) break;
  }

  return { summary, decisions, actionItems, mentionedPeople };
}
