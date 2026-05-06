import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db, dbAll } from '@/db';
import { requireRole } from '@/lib/auth';
import { CopyButton } from '@/components/copy-button';
import { formatDateTime } from '@/lib/utils';

export default async function EmailSettingsPage() {
  await requireRole('admin');

  const inboundAddress = process.env.INBOUND_EMAIL_ADDRESS ?? 'crm@inbound.govtech.gov.bb';
  const tokenSet = !!process.env.INBOUND_EMAIL_TOKEN;
  const claudeKeySet = !!process.env.ANTHROPIC_API_KEY;
  const allowedHd = process.env.ALLOWED_HD ?? '';

  // Build the absolute webhook URL using the request host.
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const webhookUrl = `${proto}://${host}/api/inbound/email`;

  // Recent ingest activity
  const recent = await dbAll<{
    id: string;
    occurred_at: number;
    title: string;
    email_from_address: string | null;
    review_status: string;
    actor_email: string | null;
  }>(sql`
    SELECT i.id, i.occurred_at, i.title, i.email_from_address, i.review_status,
      u.email AS actor_email
    FROM interactions i
    LEFT JOIN users u ON u.id = i.created_by
    WHERE i.kind = 'email'
    ORDER BY i.created_at DESC
    LIMIT 10
  `);

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div>
          <h2 className="font-semibold mb-1">Inbound email address</h2>
          <p className="text-xs text-slate-500 mb-3">
            The address team members forward or BCC meeting summaries to. Configure this on your
            email provider (Postmark Inbound or AWS SES) to forward to the webhook URL below.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono">
              {inboundAddress}
            </code>
            <CopyButton text={inboundAddress} label="Copy address" />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-1.5">Webhook URL</h3>
          <p className="text-xs text-slate-500 mb-2">
            Point your inbound-email provider at this endpoint. It accepts a Postmark-shaped JSON
            payload (From, To, Cc, Subject, TextBody, MessageID).
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono break-all">
              {webhookUrl}
            </code>
            <CopyButton text={webhookUrl} label="Copy URL" />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-1.5">Webhook security</h3>
          <p className="text-xs text-slate-500 mb-2">
            When set, the webhook requires the header <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">X-Inbound-Token</code> to match the configured shared secret.
          </p>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${tokenSet ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tokenSet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {tokenSet
              ? 'Shared secret is set (INBOUND_EMAIL_TOKEN).'
              : 'No shared secret. Set INBOUND_EMAIL_TOKEN in your environment for production.'}
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-3">
        <h2 className="font-semibold mb-1">AI extraction</h2>
        <p className="text-xs text-slate-500 mb-2">
          Anthropic Claude is used to summarise inbound emails and extract decisions, action items,
          and people mentioned in the body.
        </p>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm ${claudeKeySet ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${claudeKeySet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {claudeKeySet
            ? `Live extraction enabled (model: ${process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5'}).`
            : 'No ANTHROPIC_API_KEY. Using deterministic stub extractor — fine for demos, switch on for real use.'}
        </div>
      </section>

      {allowedHd && (
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="font-semibold mb-1">Sign-in domain restriction</h2>
          <p className="text-xs text-slate-500 mb-2">
            Google Workspace sign-in is restricted to one hosted domain.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono">
            @{allowedHd}
          </div>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold">Recent inbound emails</h2>
          <p className="text-xs text-slate-500 mt-0.5">Last 10 messages ingested via the webhook.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {recent.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-slate-500">No emails ingested yet.</li>
          )}
          {recent.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.title}</div>
                <div className="text-xs text-slate-500">
                  From {r.email_from_address ?? '—'} · forwarded by {r.actor_email ?? '—'}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    r.review_status === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : r.review_status === 'rejected'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {r.review_status}
                </span>
                <span className="text-slate-500 whitespace-nowrap">
                  {formatDateTime(new Date(r.occurred_at * 1000))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
