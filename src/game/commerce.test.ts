import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { defaultProfile, parseProfile, purchase } from './profile';
import { BUNDLES, SHAKE_PACKS, bundleOffer, purchaseBundle, purchaseShakes, rewardCoinPack } from './commerce';

describe('Bundles and persistent supplies',()=>{
  it('charges once, grants every missing cosmetic and banks the advertised shakes',()=>{
    const fresh=defaultProfile(),bundle=BUNDLES[0];
    expect(bundleOffer(fresh,bundle)).toMatchObject({price:360,saving:165});
    expect(purchaseBundle(fresh,bundle,359).purchased).toBe(false);
    const result=purchaseBundle(fresh,bundle,500);expect(result.coins).toBe(140);expect(result.profile.shakeTokens).toBe(3);
    for(const key of bundle.items)expect(result.profile.owned.filter(owned=>owned===key)).toHaveLength(1);
    expect(purchaseBundle(result.profile,bundle,500).purchased).toBe(false);expect(fresh.shakeTokens).toBe(0);
  });
  it('reduces the bundle price for an already owned item and never duplicates ownership',()=>{
    const profile=purchase(defaultProfile(),CATALOG.skins[1],500).profile;
    expect(bundleOffer(profile,BUNDLES[0])).toMatchObject({price:237,saving:108});
    const result=purchaseBundle(profile,BUNDLES[0],237);
    expect(result.coins).toBe(0);expect(result.profile.owned).toHaveLength(6);expect(result.profile.shakeTokens).toBe(3);
  });
  it('banks shake packs and persists supplies across profile reloads',()=>{
    const fresh=defaultProfile();expect(purchaseShakes(fresh,SHAKE_PACKS[1],99).purchased).toBe(false);
    const result=purchaseShakes(fresh,SHAKE_PACKS[1],125);expect(result.coins).toBe(25);expect(result.profile.shakeTokens).toBe(5);
    const restored=parseProfile(JSON.stringify(result.profile));expect(restored.shakeTokens).toBe(5);expect(fresh.shakeTokens).toBe(0);
  });
  it('awards a 150 coin pack only after two completed views',()=>{
    const first=rewardCoinPack(defaultProfile());expect(first.coins).toBe(0);expect(first.profile.coinVideo).toBe(1);
    const second=rewardCoinPack(parseProfile(JSON.stringify(first.profile)));expect(second.coins).toBe(150);expect(second.profile.coinVideo).toBe(0);
    expect(rewardCoinPack(second.profile).coins).toBe(0);
  });
});
