import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings } from '@/db/schema';

/**
 * Typed defaults for settings the app cares about. Add new settings here
 * with their default value; the rest of the app uses `getSetting(KEYS.x)`
 * and gets typed back the right shape.
 */
export const SETTING_KEYS = {
  pilotBanner: 'pilot_banner',
} as const;

export type PilotBanner = {
  enabled: boolean;
  text: string;
};

export const DEFAULT_PILOT_BANNER: PilotBanner = {
  enabled: true,
  text: 'This is the GovTech Stakeholders pilot. Please report any issues to the digital team.',
};

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.pilotBanner]: DEFAULT_PILOT_BANNER,
};

/**
 * Read a setting from the DB, falling back to the default registered above.
 * The generic lets callers narrow the return type at the call site.
 */
export async function getSetting<T>(key: string): Promise<T> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (rows.length === 0) return DEFAULTS[key] as T;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return DEFAULTS[key] as T;
  }
}

export async function setSetting(key: string, value: unknown, actorUserId: string | null) {
  const json = JSON.stringify(value);
  // SQLite upsert via INSERT ... ON CONFLICT
  await db
    .insert(appSettings)
    .values({ key, value: json, updatedBy: actorUserId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: json, updatedBy: actorUserId, updatedAt: new Date() },
    });
}
