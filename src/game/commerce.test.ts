import { describe, expect, it } from 'vitest';
import { CATALOG, itemByKey } from './catalog';
import { defaultProfile, parseProfile, purchase, rewardUnlock } from './profile';
import { BUNDLES, SHAKE_PACKS, bundleOffer, purchaseBundle, purchaseShakes, rewardCoinPack } from './commerce';

describe('Bundles and persistent supplies',()=>{
  it('keeps cosmic cosmetics exclusive to their bundle and restores its purchase',()=>{
    const fresh=defaultProfile(),bundle=BUNDLES.find(b=>b.id==='cosmic')!;
    for(const key of bundle.items){
      const item=itemByKey(key)!;
      expect(purchase(fresh,item,10000).purchased).toBe(false);
      expect(rewardUnlock(fresh,item).unlocked).toBe(false);
    }
    expect(bundleOffer(fresh,bundle)).toMatchObject({price:5720,saving:3871});
    const bought=purchaseBundle(fresh,bundle,6500);
    const restored=parseProfile(JSON.stringify(bought.profile));
    expect(bought.coins).toBe(780);expect(restored.bundles).toContain('cosmic');
    expect(restored.selected).toEqual({skins:'cosmos',backgrounds:'cosmos',boxes:'cosmos'});
    expect(restored.shakeTokens).toBe(7);
    expect(purchaseBundle(restored,bundle,6500).purchased).toBe(false);
  });
  it('charges once, grants every missing cosmetic and banks the advertised shakes',()=>{
    const fresh=defaultProfile(),bundle=BUNDLES[0];
    expect(bundleOffer(fresh,bundle)).toMatchObject({price:2340,saving:1074});
    expect(purchaseBundle(fresh,bundle,2339).purchased).toBe(false);
    const result=purchaseBundle(fresh,bundle,2500);expect(result.coins).toBe(160);expect(result.profile.shakeTokens).toBe(3);
    for(const key of bundle.items)expect(result.profile.owned.filter(owned=>owned===key)).toHaveLength(1);
    expect(purchaseBundle(result.profile,bundle,2500).purchased).toBe(false);expect(fresh.shakeTokens).toBe(0);expect(result.profile.selected).toEqual({skins:'fuzzies',backgrounds:'sunset',boxes:'rose'});
  });
  it('reduces the bundle price for an already owned item and never duplicates ownership',()=>{
    const profile=purchase(defaultProfile(),CATALOG.skins[1],2500).profile;
    expect(bundleOffer(profile,BUNDLES[0])).toMatchObject({price:1539,saving:705});
    const result=purchaseBundle(profile,BUNDLES[0],1539);
    expect(result.coins).toBe(0);expect(result.profile.owned).toHaveLength(6);expect(result.profile.shakeTokens).toBe(3);
  });
  it('banks shake packs and persists supplies across profile reloads',()=>{
    const fresh=defaultProfile();expect(purchaseShakes(fresh,SHAKE_PACKS[1],649).purchased).toBe(false);
    const result=purchaseShakes(fresh,SHAKE_PACKS[1],775);expect(result.coins).toBe(125);expect(result.profile.shakeTokens).toBe(5);
    const restored=parseProfile(JSON.stringify(result.profile));expect(restored.shakeTokens).toBe(5);expect(fresh.shakeTokens).toBe(0);
  });
  it('awards a 300 coin pack only after two completed views',()=>{
    const first=rewardCoinPack(defaultProfile());expect(first.coins).toBe(0);expect(first.profile.coinVideo).toBe(1);
    const second=rewardCoinPack(parseProfile(JSON.stringify(first.profile)));expect(second.coins).toBe(300);expect(second.profile.coinVideo).toBe(0);
    expect(rewardCoinPack(second.profile).coins).toBe(0);
  });
});
