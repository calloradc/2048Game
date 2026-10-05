// Host accessibility flags must not silently disable the game's animations.
// Motion stays enabled, including for players who used the old switch.
if (typeof document !== 'undefined') document.documentElement.dataset.motion = 'full';
export const getReducedMotion = () => false;
export const subscribeMotion = (_listener: () => void) => () => {};
export const useAnimationsEnabled = () => true;
