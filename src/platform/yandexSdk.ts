import { useSyncExternalStore } from 'react';
import { localSave, mergeSaves, onStorageChanged, restoreSave, useSafeStorage, validateSave } from './storage';

interface Player {
  isAuthorized(): boolean;
  getData(): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
}
export interface LeaderboardEntry {
  rank: number; score: number;
  player: { uniqueID: string; publicName: string };
}
interface YandexSDK {
  environment: { i18n: { lang: string } };
  features: { LoadingAPI?: { ready(): void }; GameplayAPI?: { start(): void; stop(): void } };
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  getPlayer(): Promise<Player>;
  getStorage?(): Promise<Storage>;
  isAvailableMethod(method: string): Promise<boolean>;
  auth: { openAuthDialog(): Promise<void> };
  leaderboards: {
    setScore(name: string, score: number): Promise<void>;
    getPlayerEntry(name: string): Promise<LeaderboardEntry>;
    getEntries(name: string, options: { quantityTop: number; includeUser: boolean; quantityAround: number }): Promise<{ entries: LeaderboardEntry[] }>;
  };
  adv: {
    showFullscreenAdv(options: { callbacks: AdCallbacks }): void | Promise<void>;
    showRewardedVideo(options: { callbacks: AdCallbacks }): void | Promise<void>;
  };
}
interface AdCallbacks { onOpen(): void; onClose(wasShown?: boolean): void; onError(error: unknown): void; onRewarded?(): void }
declare global { interface Window { YaGames?: { init(): Promise<YandexSDK> } } }

const LEADERBOARD = 'leaders';
let ysdk: YandexSDK | null = null, player: Player | null = null;
let initialization: Promise<void> | undefined, initialized = false, ready = false;
let gameplayWanted = false, gameplayReported = false;
let state = { platformPaused: false, adOpen: false };
const listeners = new Set<() => void>();
function publish(next: Partial<typeof state>) { state = { ...state, ...next }; listeners.forEach(listener => listener()); }
export const getYsdk = () => ysdk;
export const getPlayer = () => player;
export const isInitialized = () => initialized;
export const getPlatformLanguage = () => ysdk?.environment.i18n.lang;
export const getPlatformState = () => state;
export const subscribePlatform = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const usePlatformState = () => useSyncExternalStore(subscribePlatform, getPlatformState);
export const isAuthorized = () => { try { return player?.isAuthorized() ?? false; } catch { return false; } };

async function loadScript() {
  if (window.YaGames) return;
  // Standalone Pages/local development needs no platform SDK. Hosted games and
  // embedded games load the official platform route; no SDK copy is bundled.
  if (window === window.top && !/(^|\.)yandex\.(net|ru|com)$/.test(location.hostname)) return;
  await new Promise<void>(resolve => {
    const script = document.createElement('script'); script.src = '/sdk.js'; script.async = true;
    const finish = () => { clearTimeout(timer); script.onload = script.onerror = null; resolve(); };
    const timer = setTimeout(finish, 8000);
    script.onload = script.onerror = finish; document.head.append(script);
  });
}
const platformPause = () => publish({ platformPaused: true });
const platformResume = () => { publish({ platformPaused: false }); reconcileGameplay(); };
export function destroyYandexListeners() { ysdk?.off('game_api_pause', platformPause); ysdk?.off('game_api_resume', platformResume); }
export function initYandexSDK() {
  return initialization ??= (async () => {
    try {
      await loadScript();
      if (!window.YaGames) return;
      ysdk = await window.YaGames.init();
      ysdk.on('game_api_pause', platformPause); ysdk.on('game_api_resume', platformResume);
      // getStorage also protects custom-domain integrations; archive hosting
      // already wraps localStorage, so using this interface works in both cases.
      try { if (ysdk.getStorage) useSafeStorage(await ysdk.getStorage()); } catch { /* Keep existing local progress. */ }
      try { player = await ysdk.getPlayer(); } catch { /* Guest/local play remains available. */ }
      await loadCloudSave();
    } catch { /* A platform failure must not prevent local play. */ }
    finally { initialized = true; onStorageChanged(() => saveCloudData()); }
  })();
}
export function gameReady() {
  if (!initialized || ready) return;
  ready = true;
  try { ysdk?.features.LoadingAPI?.ready(); } catch { /* Optional platform metric. */ }
  reconcileGameplay();
}
function reconcileGameplay() {
  if (!ready || state.platformPaused || gameplayReported === gameplayWanted) return;
  try {
    if (gameplayWanted) ysdk?.features.GameplayAPI?.start(); else ysdk?.features.GameplayAPI?.stop();
    gameplayReported = gameplayWanted;
  } catch { /* Metrics are optional; gameplay remains usable. */ }
}
export function setGameplayActive(active: boolean) { gameplayWanted = active; reconcileGameplay(); }
export const gameplayStart = () => setGameplayActive(true);
export const gameplayStop = () => setGameplayActive(false);

let cloudLoaded = false, dirty = false, flushRequested = false, saving = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined, lastSave = -Infinity;
export async function loadCloudSave() {
  if (!player) return;
  try {
    const data = await player.getData();
    restoreSave(mergeSaves(localSave(), validateSave(data.jellySave)));
    cloudLoaded = true;
  } catch { /* Do not overwrite unknown cloud data after a failed load. */ }
}
export function saveCloudData(important = false) {
  if (!player || !cloudLoaded) return;
  dirty = true; flushRequested ||= important;
  if (saving) return;
  // Keep the first deadline: continuous merge chains must not postpone the
  // cloud save forever. Important events can promote the scheduled write.
  if (saveTimer !== undefined && !important) return;
  clearTimeout(saveTimer);
  const delay = Math.max(important ? 0 : 2000, 5000 - (Date.now() - lastSave));
  saveTimer = setTimeout(() => { saveTimer = undefined; void sendCloudSave(); }, delay);
}
async function sendCloudSave() {
  if (!player || !cloudLoaded || saving || !dirty) return;
  saving = true; dirty = false; lastSave = Date.now();
  const flush = flushRequested; flushRequested = false;
  try {
    const data = { jellySave: localSave() };
    if (new TextEncoder().encode(JSON.stringify(data)).length > 200_000) throw new Error('Save exceeds the SDK limit');
    await player.setData(data, flush);
  } catch { dirty = true; flushRequested ||= flush; }
  finally { saving = false; if (dirty) saveCloudData(flushRequested); }
}
function flushBeforeLeaving() {
  if (!dirty || !player || !cloudLoaded) return;
  clearTimeout(saveTimer); saveTimer = undefined; flushRequested = true;
  // A final best-effort write must not wait for a timer after the tab closes.
  // Regular writes are capped at 60/5min, leaving room below the SDK's 100 limit.
  void sendCloudSave();
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushBeforeLeaving);
  if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', () => { if (document.hidden) flushBeforeLeaving(); });
}

export type AdResult = 'closed' | 'unavailable' | 'error';
let adInFlight: Promise<AdResult> | undefined;
function showAd(reward?: () => void): Promise<AdResult> {
  if (!ysdk) return Promise.resolve('unavailable');
  if (adInFlight) return Promise.resolve('unavailable');
  publish({ adOpen: true });
  const sdk = ysdk;
  const request = new Promise<AdResult>(resolve => {
    let finished = false, rewarded = false;
    const finish = (result: AdResult) => { if (finished) return; finished = true; publish({ adOpen: false }); resolve(result); };
    const callbacks: AdCallbacks = {
      onOpen: () => { if (!finished) publish({ adOpen: true }); },
      onClose: () => finish('closed'),
      onError: () => finish('error'),
      onRewarded: () => { if (finished || rewarded) return; rewarded = true; reward?.(); },
    };
    try { void Promise.resolve(reward ? sdk.adv.showRewardedVideo({ callbacks }) : sdk.adv.showFullscreenAdv({ callbacks })).catch(() => finish('error')); }
    catch { finish('error'); }
  });
  adInFlight = request;
  void request.then(() => { if (adInFlight === request) adInFlight = undefined; });
  return request;
}
export const showRewardedAd = (onRewarded: () => void) => showAd(onRewarded);
export const showFullscreenAd = () => showAd();

let lastScoreAt = -Infinity;
let submittedScore = 0, previousRank: number | null = null;
let scoreRequest: Promise<boolean> | undefined;
let leaderboardCache: { at: number; data: LeaderboardData } | undefined;
export interface LeaderboardData { entries: LeaderboardEntry[]; own: LeaderboardEntry | null; previousRank: number | null }
async function playerEntry() {
  if (!ysdk || !isAuthorized()) return null;
  try {
    if (!await ysdk.isAvailableMethod('leaderboards.getPlayerEntry')) return null;
    return await ysdk.leaderboards.getPlayerEntry(LEADERBOARD);
  } catch { return null; /* Includes LEADERBOARD_PLAYER_NOT_PRESENT: a normal first result. */ }
}
export async function submitLeaderboardScore(score: number): Promise<boolean> {
  if (!ysdk || !isAuthorized() || !Number.isFinite(score) || score <= 0) return false;
  if (scoreRequest) { await scoreRequest; if (score > submittedScore) return submitLeaderboardScore(score); return true; }
  if (score <= submittedScore) return true;
  const sdk = ysdk;
  scoreRequest = (async () => {
    try {
      if (!await sdk.isAvailableMethod('leaderboards.setScore')) return false;
      const before = await playerEntry();
      // Preserve a higher result already saved from another device.
      if (before && before.score >= score) { submittedScore = before.score; return true; }
      previousRank = before?.rank ?? null;
      const wait = Math.max(0, 1100 - (Date.now() - lastScoreAt));
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      lastScoreAt = Date.now();
      await sdk.leaderboards.setScore(LEADERBOARD, Math.floor(score));
      submittedScore = score; leaderboardCache = undefined; return true;
    } catch { return false; }
  })();
  try { return await scoreRequest; } finally { scoreRequest = undefined; }
}
export async function getLeaderboard(): Promise<LeaderboardData | null> {
  if (!ysdk) return null;
  if (leaderboardCache && Date.now() - leaderboardCache.at < 30_000) return leaderboardCache.data;
  try {
    if (!await ysdk.isAvailableMethod('leaderboards.getEntries')) return null;
    const result = await ysdk.leaderboards.getEntries(LEADERBOARD, { quantityTop: 10, includeUser: isAuthorized(), quantityAround: 3 });
    const own = await playerEntry();
    const data = { entries: result.entries, own, previousRank };
    leaderboardCache = { at: Date.now(), data }; return data;
  } catch { return null; }
}
// This is called only by an explicit login button explaining the leaderboard benefit.
export async function authorizePlayer() {
  if (!ysdk) return false;
  try {
    await ysdk.auth.openAuthDialog(); player = await ysdk.getPlayer();
    leaderboardCache = undefined; submittedScore = 0; previousRank = null;
    cloudLoaded = false; await loadCloudSave();
    return isAuthorized();
  } catch { return false; }
}
