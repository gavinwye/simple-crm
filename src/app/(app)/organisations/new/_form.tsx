'use client';

import Link from 'next/link';
import type { Organisation } from '@/db/schema';
import { DuplicateHint } from '@/components/duplicate-hint';

const TYPES: Array<{ value: string; label: string; group: string }> = [
  { value: 'ministry', label: 'Ministry', group: 'Government' },
  { value: 'department', label: 'Department (under a ministry)', group: 'Government' },
  { value: 'agency', label: 'Agency', group: 'Government' },
  { value: 'statutory_body', label: 'Statutory body', group: 'Government' },
  { value: 'soe', label: 'State-owned enterprise', group: 'Government' },
  { value: 'vendor', label: 'Vendor', group: 'External' },
  { value: 'partner', label: 'Partner', group: 'External' },
  { value: 'multilateral', label: 'Multilateral organisation', group: 'External' },
  { value: 'civil_society', label: 'Civil society', group: 'External' },
  { value: 'media', label: 'Media', group: 'External' },
  { value: 'other', label: 'Other', group: 'External' },
];

import type { OrgPickerOption } from '@/lib/org-options';

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

type Props = {
  action: (formData: FormData) => Promise<void>;
  organisation?: Organisation;
  submitLabel: string;
  /** Hierarchical list of orgs that can be picked as parents (excludes self when editing). */
  parentOptions: OrgPickerOption[];
};

export function OrganisationForm({ action, organisation, submitLabel, parentOptions }: Props) {
  const isEdit = !!organisation;
  return (
    <form action={action} className="space-y-5">
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        {isEdit ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              required
              defaultValue={organisation?.name ?? ''}
              placeholder="e.g. Ministry of Innovation, Science and Smart Technology"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            />
          </div>
        ) : (
          <DuplicateHint
            inputName="name"
            label="Name"
            noun="organisation"
            placeholder="e.g. Ministry of Innovation, Science and Smart Technology"
            required
            lookupUrl="/api/organisations/lookup"
            buildHref={(slug) => `/organisations/${slug}`}
            renderPrimary={(m) => m.commonName || m.name || ''}
            renderSecondary={(m) =>
              [m.commonName ? m.name : null, m.typeLabel].filter(Boolean).join(' · ') || null
            }
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Common name</label>
            <input
              type="text"
              name="commonName"
              defaultValue={organisation?.commonName ?? ''}
              placeholder="e.g. MIST"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
            <select
              name="type"
              defaultValue={organisation?.type ?? 'ministry'}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            >
              {(['Government', 'External'] as const).map((groupName) => (
                <optgroup key={groupName} label={groupName}>
                  {TYPES.filter((t) => t.group === groupName).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Parent organisation <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            name="parentId"
            defaultValue={organisation?.parentId ?? ''}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
          >
            <option value="">— No parent (top-level) —</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {' '.repeat(p.depth * 4)}
                {p.depth > 0 ? '↳ ' : ''}
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Use this to nest a department under its ministry, or an agency under the ministry that
            oversees it. Leave blank for ministries and standalone agencies.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
          <input
            type="text"
            name="website"
            defaultValue={organisation?.website ?? ''}
            placeholder="example.gov.bb"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            name="notes"
            rows={4}
            defaultValue={organisation?.notes ?? ''}
            placeholder="Brief context: what they do, why we're engaged, key relationships…"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
          <input
            type="text"
            name="tags"
            defaultValue={tagsToString(organisation?.tags)}
            placeholder="comma, separated, tags"
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
          />
        </div>
      </div>

      {isEdit && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">URL slug</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-mono">/organisations/</span>
            <input
              type="text"
              name="slug"
              defaultValue={organisation!.slug}
              pattern="[a-z0-9\-]+"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm font-mono"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Lower-case letters, numbers, and hyphens only. Auto-derived from the common name unless you customise it.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Link
          href={isEdit ? `/organisations/${organisation!.slug}` : '/organisations'}
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
