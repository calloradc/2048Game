export const PRICE_MULTIPLIER = 6.5;
export const shopPrice = (base: number) => Math.round(base * PRICE_MULTIPLIER);
export const unlockVideos = (price: number) => price > 0 ? Math.max(2, Math.ceil(price / 400)) : 0;
// Accumulate before rounding so small merges still earn coins over time.
export const mergeCoins = (totalLevels: number) => Math.floor(totalLevels * 3 / 5);
export const AD_COINS = 150;
export const AD_COIN_PACK = 300;
