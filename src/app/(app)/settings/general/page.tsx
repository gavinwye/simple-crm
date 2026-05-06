import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import {
  getSetting,
  setSetting,
  SETTING_KEYS,
  DEFAULT_PILOT_BANNER,
  type PilotBanner,
} from '@/lib/settings';
import { logAudit } from '@/lib/audit';

async function savePilotBanner(formData: FormData) {
  'use server';
  const user = await requireRole('admin');

  const enabled = formData.get('pilotBannerEnabled') === 'on';
  const text = String(formData.get('pilotBannerText') ?? '').trim() || DEFAULT_PILOT_BANNER.text;

  const next: PilotBanner = { enabled, text };
  await setSetting(SETTING_KEYS.pilotBanner, next, user.id);

  await logAudit({
    actorUserId: user.id,
    action: 'settings.updated',
    entityType: 'app_setting',
    entityId: SETTING_KEYS.pilotBanner,
    details: { enabled, textLength: text.length },
  });

  revalidatePath('/dashboard');
  revalidatePath('/settings/general');
  redirect('/settings/general?saved=1');
}

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireRole('admin');
  const { saved } = await searchParams;
  const banner = await getSetting<PilotBanner>(SETTING_KEYS.pilotBanner);

  return (
    <div className="space-y-8">
      {saved && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
          Settings saved.
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="font-semibold mb-1">Pilot banner</h2>
        <p className="text-xs text-slate-500 mb-4">
          The amber banner that sits above the dashboard. Turn it off when the pilot ends, or rewrite
          the text to reflect a different phase of the rollout.
        </p>

        <form action={savePilotBanner} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="pilotBannerEnabled"
              defaultChecked={banner.enabled}
              className="mt-1 rounded border-slate-300"
            />
            <div>
              <div className="text-sm font-medium">Show the pilot banner on the dashboard</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Off hides the banner everywhere it currently appears.
              </p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Banner text</label>
            <textarea
              name="pilotBannerText"
              rows={3}
              defaultValue={banner.text}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Plain text. The "Pilot · v0.1" prefix is added automatically.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-amber-800/80 mb-1">Preview</div>
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <div className="flex-1">
                <span className="font-medium text-amber-900">Pilot · v0.1</span>
                <span className="text-amber-800"> · {banner.text}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
