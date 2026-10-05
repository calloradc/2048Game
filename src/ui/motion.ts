import { useSyncExternalStore } from 'react';

// Keep game motion consistent in standalone and embedded browsers. The player
// can explicitly disable it instead of silently inheriting a host's media flag.
const key = 'jelly-animations';
let enabled = true;
try { enabled = localStorage.getItem(key) !== 'false'; } catch { /* Optional storage. */ }
const listeners = new Set<() => void>();
const sync = () => {
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = enabled ? 'full' : 'reduced';
};
sync();

export const getReducedMotion = () => !enabled;
export const subscribeMotion = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function setAnimationsEnabled(value: boolean) {
  if (value === enabled) return;
  enabled = value;
  try { localStorage.setItem(key, String(value)); } catch { /* Optional storage. */ }
  sync();
  listeners.forEach(listener => listener());
}
export const useAnimationsEnabled = () => useSyncExternalStore(subscribeMotion, () => enabled, () => true);
