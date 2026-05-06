'use client';

import Link from 'next/link';
import type { Contact, Organisation } from '@/db/schema';
import { DuplicateHint } from '@/components/duplicate-hint';
import { buildParentOptions } from '@/lib/org-options';

type Props = {
  action: (formData: FormData) => Promise<void>;
  organisations: Organisation[];
  contact?: Contact;
  submitLabel: string;
};

function tagsToString(raw: unknown): string {
  if (Array.isArray(raw)) return raw.join(', ');
  if (!raw) return '';
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v.join(', ') : '';
  } catch {
    return '';
  }
}

export function ContactForm({ action, organisations, contact, submitLabel }: Props) {
  const isEdit = !!contact;
  return (
    <form action={action} className="space-y-5">
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {isEdit ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                name="fullName"
                required
                defaultValue={contact?.fullName ?? ''}
                placeholder="e.g. Sandra Husbands"
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
              />
            </div>
          ) : (
            <DuplicateHint
              inputName="fullName"
              label="Full name"
              noun="person"
              placeholder="e.g. Sandra Husbands"
              required
              lookupUrl="/api/contacts/lookup"
              buildHref={(slug) => `/contacts/${slug}`}
              renderPrimary={(m) => m.fullName ?? ''}
              renderSecondary={(m) =>
                [m.title, m.organisationName].filter(Boolean).join(' · ') || null
              }
            />
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Job title</label>
            <input
              type="text"
              name="title"
              defaultValue={contact?.title ?? ''}
              placeholder="e.g. Chief Information Officer"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Organisation</label>
          <select
            name="organisationId"
            defaultValue={contact?.organisationId ?? ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
          >
            <option value="">— None —</option>
            {buildParentOptions(organisations).map((o) => (
              <option key={o.id} value={o.id}>
                {' '.repeat(o.depth * 4)}
                {o.depth > 0 ? '↳ ' : ''}
                {o.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Pick the most specific home – a department or agency if it fits, otherwise the ministry.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              name="primaryEmail"
              defaultValue={contact?.primaryEmail ?? ''}
              placeholder="name@example.gov.bb"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input
              type="tel"
              name="phone"
              defaultValue={contact?.phone ?? ''}
              placeholder="+1 246 …"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            name="notes"
            rows={4}
            defaultValue={contact?.notes ?? ''}
            placeholder="Anything worth remembering: relationship strength, role on a project, preferences…"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
            <input
              type="text"
              name="tags"
              defaultValue={tagsToString(contact?.tags)}
              placeholder="comma, separated, tags"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
            <p className="text-xs text-slate-500 mt-1.5">e.g. champion, digital-id, warm</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Sensitivity</label>
            <label className="flex items-center gap-2 text-sm pt-2">
              <input type="checkbox" name="sensitive" defaultChecked={contact?.sensitive ?? false} className="rounded border-slate-300" />
              Mark as sensitive · admins and explicit invitees only
            </label>
          </div>
        </div>
      </div>

      {isEdit && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">URL slug</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-mono">/contacts/</span>
            <input
              type="text"
              name="slug"
              defaultValue={contact!.slug}
              pattern="[a-z0-9\-]+"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm font-mono"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Lower-case letters, numbers, and hyphens only. Auto-derived from the name unless you customise it.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href={isEdit ? `/contacts/${contact!.slug}` : '/contacts'}
          className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
