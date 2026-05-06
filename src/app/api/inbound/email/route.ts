import { NextResponse } from 'next/server';
import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { contacts, interactions, interactionParticipants, users } from '@/db/schema';
import { extractFromEmail } from '@/lib/claude';
import { findCandidatesForNames } from '@/lib/people-matching';
import { logAudit } from '@/lib/audit';

/**
 * Inbound email webhook.
 *
 * Accepts a normalised payload (Postmark-style fields supported via aliases).
 * Verifies the optional shared secret, matches participants to existing contacts,
 * runs Claude extraction, and creates an interaction with reviewStatus = "pending".
 *
 * Expected payload (Postmark Inbound shape; many fields optional):
 *  {
 *    "From": "sandra.husbands@mist.gov.bb",
 *    "FromName": "Sandra Husbands",
 *    "To": "abisola@govtech.bb",
 *    "Cc": "marcus.bynoe@finance.gov.bb",
 *    "Subject": "Re: TridentID rollout",
 *    "TextBody": "...",
 *    "MessageID": "...",
 *    "OriginalRecipient": "crm@inbound.govtech.bb"
 *  }
 *
 * For SES inbound, normalise the payload upstream (Lambda) before posting here.
 */

const InboundSchema = z
  .object({
    From: z.string().email().optional(),
    from: z.string().email().optional(),
    FromName: z.string().optional(),
    To: z.string().optional(),
    to: z.string().optional(),
    Cc: z.string().optional(),
    cc: z.string().optional(),
    Subject: z.string().optional(),
    subject: z.string().optional(),
    TextBody: z.string().optional(),
    textBody: z.string().optional(),
    text: z.string().optional(),
    HtmlBody: z.string().optional(),
    htmlBody: z.string().optional(),
    MessageID: z.string().optional(),
    messageId: z.string().optional(),
    OriginalRecipient: z.string().optional(),
    Date: z.string().optional(),
  })
  .passthrough();

export async function POST(req: Request) {
  const expectedToken = process.env.INBOUND_EMAIL_TOKEN;
  if (expectedToken) {
    const provided = req.headers.get('x-inbound-token');
    if (provided !== expectedToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = InboundSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;
  const fromEmail = data.From ?? data.from ?? '';
  const subject = data.Subject ?? data.subject ?? '(no subject)';
  const body = data.TextBody ?? data.textBody ?? data.text ?? stripHtml(data.HtmlBody ?? data.htmlBody ?? '') ?? '';
  const messageId = data.MessageID ?? data.messageId ?? null;
  const to = data.To ?? data.to ?? '';
  const cc = data.Cc ?? data.cc ?? '';
  const occurredAt = data.Date ? new Date(data.Date) : new Date();

  if (!fromEmail) {
    return NextResponse.json({ error: 'Missing From address' }, { status: 400 });
  }

  // The forwarder/BCC sender must be a known GovTech user (the original sender on emails
  // forwarded inbound is a real GovTech Workspace address; on auto-BCC, the sender is the
  // GovTech user whose mail has been BCC'd in).
  const allEmails = uniq([
    fromEmail,
    ...splitAddresses(to),
    ...splitAddresses(cc),
  ]);
  const userMatches = await db
    .select()
    .from(users)
    .where(inArray(users.email, allEmails));
  if (userMatches.length === 0) {
    return NextResponse.json(
      { error: 'No GovTech user found in From/To/Cc; refusing to ingest.' },
      { status: 403 },
    );
  }

  // External participants — match against contacts.primary_email
  const externalEmails = allEmails.filter(
    (e) => !userMatches.some((u) => u.email.toLowerCase() === e.toLowerCase()),
  );
  const matchedContacts = externalEmails.length
    ? await db
        .select()
        .from(contacts)
        .where(inArray(contacts.primaryEmail, externalEmails))
    : [];

  // Run Claude extraction (or stub fallback)
  const extraction = await extractFromEmail({
    from: fromEmail,
    to,
    cc,
    subject,
    body,
  });

  // Match any people the model spotted in the body against existing contacts,
  // excluding contacts already linked via headers.
  const suggestedParticipants = await findCandidatesForNames(
    extraction.mentionedPeople,
    matchedContacts.map((c) => c.id),
  );

  const interactionId = randomUUID();
  await db.insert(interactions).values({
    id: interactionId,
    kind: 'email',
    occurredAt,
    title: subject,
    summary: extraction.summary,
    body,
    emailMessageId: messageId,
    emailFromAddress: fromEmail,
    decisions: extraction.decisions,
    suggestedParticipants,
    reviewStatus: 'pending',
    createdBy: userMatches[0].id,
  });

  for (const c of matchedContacts) {
    const role: 'sender' | 'recipient' | 'cc' =
      c.primaryEmail?.toLowerCase() === fromEmail.toLowerCase()
        ? 'sender'
        : splitAddresses(cc).map((a) => a.toLowerCase()).includes(c.primaryEmail?.toLowerCase() ?? '')
        ? 'cc'
        : 'recipient';
    await db.insert(interactionParticipants).values({
      interactionId,
      contactId: c.id,
      role,
    });
  }

  await logAudit({
    actorUserId: userMatches[0].id,
    action: 'email.ingested',
    entityType: 'interaction',
    entityId: interactionId,
    details: {
      from: fromEmail,
      subject,
      matchedContacts: matchedContacts.length,
      unmatched: externalEmails.length - matchedContacts.length,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      interactionId,
      reviewUrl: `/emails/${interactionId}/review`,
      matchedContacts: matchedContacts.length,
    },
    { status: 201 },
  );
}

function splitAddresses(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map((s) => {
      const m = s.match(/<([^>]+)>/);
      return (m ? m[1] : s).trim();
    })
    .filter(Boolean);
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.toLowerCase();
    if (!seen.has(k) && k) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
