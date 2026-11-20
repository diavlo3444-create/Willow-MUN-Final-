import type { AdminUser, Department } from '../types/admin';
import { getActorDepartmentSlug, getMediaPressSubScope } from './adminPermissions';

export const ALYA_EASTER_EGG_IMAGE_URL = '/assets/aistudio/images__1__63a869f3.jpg';
export const ALYA_INTRO_STORAGE_PREFIX = 'willow_alya_login_intro_seen_v1:';

const LEGACY_ALYA_USER_IDS = new Set([
  'usr-head-media',
  'roster:alya-ismail',
  'pending:alya-ismail',
]);
const LEGACY_ALYA_EMAILS = new Set(['alya-ismail@willowmun.org']);
const ALYA_AVATAR_PATTERN = /(?:^|\/)alya[-_]ismail(?:[-_a-z0-9]*)?\.(?:jpg|jpeg|png|webp)(?:$|\?)/i;

export type AlyaBeatMood = 'peek' | 'nervous' | 'flustered' | 'shy';

export interface AlyaDialogueBeat {
  id: string;
  text: string;
  pauseAfterMs: number;
  charIntervalMs: number;
  mood: AlyaBeatMood;
}

export const ALYA_DIALOGUE_BEATS: readonly AlyaDialogueBeat[] = [
  {
    id: 'greet',
    text: 'H-h-hi, Alya...',
    pauseAfterMs: 750,
    charIntervalMs: 44,
    mood: 'peek',
  },
  {
    id: 'speech',
    text: 'U-um... I had a whole Head of Media welcome speech ready...',
    pauseAfterMs: 850,
    charIntervalMs: 28,
    mood: 'nervous',
  },
  {
    id: 'blank',
    text: '...and my brain immediately forgot every word.',
    pauseAfterMs: 800,
    charIntervalMs: 28,
    mood: 'flustered',
  },
  {
    id: 'recover',
    text: '...anyway. H-hi.',
    pauseAfterMs: 2200,
    charIntervalMs: 40,
    mood: 'shy',
  },
] as const;

export interface AlyaIdentityOverrides {
  userIds?: string[];
  emails?: string[];
}

function readViteEnvValue(key: string): string {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return typeof meta?.env?.[key] === 'string' ? (meta.env[key] as string) : '';
  } catch {
    return '';
  }
}

function parseCsvSet(raw: string, normalize: (value: string) => string): Set<string> {
  const result = new Set<string>();
  for (const part of raw.split(',')) {
    const clean = normalize(part);
    if (clean) result.add(clean);
  }
  return result;
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Strictly identifies ONLY Alya Ismail's active Willow MUN account.
 * Never triggers on generic first names ("Alya") from unrelated departments or roles,
 * and never activates for Admins, Super Admins, HR, Security, or general Staff.
 */
export function isAlyaAccount(
  user: AdminUser | null | undefined,
  departments?: Department[],
  overrides?: AlyaIdentityOverrides,
): boolean {
  if (!user || !user.isActive || user.status !== 'active') return false;

  const configuredIds = new Set<string>([
    ...LEGACY_ALYA_USER_IDS,
    ...parseCsvSet(readViteEnvValue('VITE_ALYA_USER_ID'), (v) => v.trim()),
    ...(overrides?.userIds ?? []).map((v) => v.trim()).filter(Boolean),
  ]);
  if (user.id && configuredIds.has(user.id.trim())) {
    return true;
  }

  // Alya's live account is identified by her exact roster name. Keep this
  // identity check ahead of department-scope fallbacks so profile mapping
  // differences cannot suppress her login welcome.
  if (normalizeName(user.fullName) === 'alya ismail') {
    return true;
  }

  const configuredEmails = new Set<string>([
    ...LEGACY_ALYA_EMAILS,
    ...parseCsvSet(readViteEnvValue('VITE_ALYA_EMAIL'), normalizeEmail),
    ...(overrides?.emails ?? []).map(normalizeEmail).filter(Boolean),
  ]);
  const email = normalizeEmail(user.email);
  if (email && configuredEmails.has(email)) {
    return true;
  }

  // Fallback for live Supabase wm_profiles / wm_eb_signup_allowlist accounts
  // where Auth UUID and personal email live privately in Supabase:
  // require Media leadership role + Media department scope + roster identity anchor.
  if (user.role !== 'executive_board' && user.role !== 'department_head') {
    return false;
  }

  const deptSlug = getActorDepartmentSlug(user, departments);
  const subScope = getMediaPressSubScope(user);
  if (subScope === 'press') {
    return false;
  }
  const hasMediaScope =
    deptSlug === 'media' ||
    deptSlug === 'media-press' ||
    (!deptSlug && (!departments || departments.length === 0));
  if (!hasMediaScope) {
    return false;
  }

  const avatar = String(user.avatarUrl || '').trim();
  if (avatar && ALYA_AVATAR_PATTERN.test(avatar)) {
    return true;
  }

  return normalizeName(user.fullName) === 'alya ismail';
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  length?: number;
  key?: (index: number) => string | null;
}

function resolveSessionStorage(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAlyaIntroStorageKey(userId: string): string {
  return `${ALYA_INTRO_STORAGE_PREFIX}${userId.trim()}`;
}

export function hasSeenAlyaIntroInSession(
  userId: string | null | undefined,
  storage?: StorageLike | null,
): boolean {
  const cleanId = String(userId || '').trim();
  if (!cleanId) return false;
  const store = resolveSessionStorage(storage);
  if (!store) return false;
  try {
    return store.getItem(getAlyaIntroStorageKey(cleanId)) === '1';
  } catch {
    return false;
  }
}

export function markAlyaIntroSeenInSession(
  userId: string | null | undefined,
  storage?: StorageLike | null,
): void {
  const cleanId = String(userId || '').trim();
  if (!cleanId) return;
  const store = resolveSessionStorage(storage);
  if (!store) return;
  try {
    store.setItem(getAlyaIntroStorageKey(cleanId), '1');
  } catch {
    // Ignore storage quota/privacy mode failures cleanly
  }
}

export function clearAlyaIntroSession(
  userId?: string | null,
  storage?: StorageLike | null,
): void {
  const store = resolveSessionStorage(storage);
  if (!store) return;
  try {
    if (userId) {
      store.removeItem(getAlyaIntroStorageKey(userId));
      return;
    }
    if (typeof store.length === 'number' && typeof store.key === 'function') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && key.startsWith(ALYA_INTRO_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        store.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors cleanly
  }
}

export function shouldShowAlyaLoginEasterEgg(params: {
  user: AdminUser | null | undefined;
  testModeHeadUser?: AdminUser | null;
  departments?: Department[];
  dismissedUserId?: string | null;
  storage?: StorageLike | null;
  overrides?: AlyaIdentityOverrides;
}): boolean {
  const { user, testModeHeadUser, departments, dismissedUserId, storage, overrides } = params;
  // Allow Super Admin Department Testing Mode to preview the intro when the selected test account is Alya.
  // The preview still uses the selected account's strict identity check and session deduplication.
  const targetUser = testModeHeadUser ?? user;
  if (!targetUser || !isAlyaAccount(targetUser, departments, overrides)) return false;
  if (dismissedUserId && dismissedUserId === targetUser.id) return false;
  // Intentionally replay on every fresh page load / refresh. Dismissal only
  // applies to the current mounted login session, not the browser session.
  return true;
}
