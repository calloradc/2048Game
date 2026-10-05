import type { Profile } from '../game/profile';

export interface GameSave {
  version: 1;
  updatedAt: number;
  best: number;
  coins: number;
  profile?: Profile;
  settings: { muted: boolean; language?: string };
}
const keys = ['jelly-best', 'jelly-coins', 'jelly-profile', 'jelly-muted', 'jelly-language', 'jelly-save-meta'];
let storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
const memory = new Map<string, string>();
let changed: (() => void) | undefined;
export function readStorage(key: string, fallback = '') {
  if (memory.has(key)) return memory.get(key)!;
  try { return (storage ?? window.localStorage).getItem(key) ?? fallback; } catch { return fallback; }
}
function writeRaw(key: string, value: string) {
  memory.set(key, value);
  try { (storage ?? window.localStorage).setItem(key, value); } catch { /* Local storage can be unavailable in an iframe. */ }
}
export function useSafeStorage(next: Pick<Storage, 'getItem' | 'setItem'>) {
  const previous = keys.map(key => [key, readStorage(key)] as const);
  storage = next;
  memory.clear();
  for (const [key, value] of previous) if (value && !readStorage(key)) writeRaw(key, value);
}
export function writeStorage(key: string, value: string) {
  if (readStorage(key) === value) return;
  writeRaw(key, value);
  writeRaw('jelly-save-meta', JSON.stringify({ version: 1, updatedAt: Date.now() }));
  changed?.();
}
export const onStorageChanged = (listener: () => void) => { changed = listener; };
const integer = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
function validProfile(value: unknown): Profile | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Partial<Profile>;
  const strings = (list: unknown) => Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string') : [];
  const selected = { skins: 'fruit', backgrounds: 'meadow', boxes: 'glass' };
  for (const key of Object.keys(selected) as (keyof typeof selected)[]) if (typeof source.selected?.[key] === 'string') selected[key] = source.selected[key];
  const videos: Record<string, number> = {};
  if (source.videos && typeof source.videos === 'object') for (const [key, value] of Object.entries(source.videos)) videos[key] = integer(value);
  return { owned: strings(source.owned), selected, videos, daily: typeof source.daily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(source.daily) ? source.daily : '',
    dailyCount: integer(source.dailyCount), shakeTokens: integer(source.shakeTokens), bundles: strings(source.bundles), coinVideo: integer(source.coinVideo) % 2 };
}
export function validateSave(value: unknown): GameSave | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<GameSave>;
  if (data.version !== 1 || typeof data.updatedAt !== 'number' || !Number.isFinite(data.updatedAt)) return null;
  return {
    version: 1, updatedAt: Math.max(0, data.updatedAt), best: integer(data.best), coins: integer(data.coins),
    profile: validProfile(data.profile),
    settings: { muted: data.settings?.muted === true, language: typeof data.settings?.language === 'string' ? data.settings.language : undefined },
  };
}
export function localSave(): GameSave {
  let profile: Profile | undefined, updatedAt = 0;
  try { profile = validProfile(JSON.parse(readStorage('jelly-profile', 'null'))); } catch { /* Legacy/corrupt save. */ }
  try { updatedAt = integer(JSON.parse(readStorage('jelly-save-meta', '{}')).updatedAt); } catch { /* Legacy save has no timestamp. */ }
  return { version: 1, updatedAt, best: integer(Number(readStorage('jelly-best'))), coins: integer(Number(readStorage('jelly-coins'))), profile,
    settings: { muted: readStorage('jelly-muted') === 'true', language: readStorage('jelly-language') || undefined } };
}
const hasProgress = (save: GameSave) => save.best > 0 || save.coins > 0 || !!save.profile?.daily || (save.profile?.owned?.length ?? 0) > 3 || (save.profile?.shakeTokens ?? 0) > 0 || Object.values(save.profile?.videos ?? {}).some(n => n > 0) || (save.profile?.coinVideo ?? 0) > 0;
export function mergeSaves(local: GameSave, cloud: GameSave | null): GameSave {
  if (!cloud) return local;
  const newer = cloud.updatedAt > local.updatedAt ? cloud : local, older = newer === cloud ? local : cloud;
  // Empty defaults must never erase a real save, even if their timestamp is newer.
  const selected = !hasProgress(newer) && hasProgress(older) ? older : newer;
  let profile = selected.profile;
  if (local.profile && cloud.profile && profile) {
    const other = selected === local ? cloud.profile : local.profile;
    profile = { ...profile, owned: [...new Set([...(profile.owned ?? []), ...(other.owned ?? [])])], bundles: [...new Set([...(profile.bundles ?? []), ...(other.bundles ?? [])])],
      daily: [profile.daily ?? '', other.daily ?? ''].sort().at(-1)!, dailyCount: Math.max(profile.dailyCount ?? 0, other.dailyCount ?? 0),
      videos: { ...profile.videos } };
    for (const [key, value] of Object.entries(other.videos ?? {})) profile.videos[key] = Math.max(profile.videos[key] ?? 0, value);
  }
  return { ...selected, best: Math.max(local.best, cloud.best), profile };
}
export function restoreSave(save: GameSave) {
  writeRaw('jelly-best', String(save.best)); writeRaw('jelly-coins', String(save.coins));
  if (save.profile) writeRaw('jelly-profile', JSON.stringify(save.profile));
  writeRaw('jelly-muted', String(save.settings.muted));
  if (save.settings.language) writeRaw('jelly-language', save.settings.language);
  writeRaw('jelly-save-meta', JSON.stringify({ version: 1, updatedAt: save.updatedAt }));
}
