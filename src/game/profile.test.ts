import { describe,expect,it } from 'vitest';
import { CATALOG } from './catalog';
import { defaultProfile,parseProfile,purchase,rewardUnlock,selectItem } from './profile';

describe('Saved shop ownership and rewarded unlocks',()=>{
  const fuzzy=CATALOG.skins[1];
  it('deducts the price once and only equips an owned item',()=>{
    const fresh=defaultProfile();
    expect(selectItem(fresh,fuzzy)).toBe(fresh);
    expect(purchase(fresh,fuzzy,179).purchased).toBe(false);
    const bought=purchase(fresh,fuzzy,200);
    expect(bought.coins).toBe(20);expect(bought.profile.owned).toContain(fuzzy.key);
    const again=purchase(bought.profile,fuzzy,200);expect(again.purchased).toBe(false);expect(again.coins).toBe(200);
    expect(selectItem(bought.profile,fuzzy).selected.skins).toBe('fuzzies');
    expect(fresh.owned).not.toContain(fuzzy.key);
  });
  it('opens a collection after all video rewards and caps progress',()=>{
    const first=rewardUnlock(defaultProfile(),fuzzy);
    expect(first.unlocked).toBe(false);expect(first.profile.videos[fuzzy.key]).toBe(1);
    const second=rewardUnlock(first.profile,fuzzy);expect(second.unlocked).toBe(false);
    const third=rewardUnlock(second.profile,fuzzy);expect(third.unlocked).toBe(true);
    expect(third.profile.owned.filter(key=>key===fuzzy.key)).toHaveLength(1);
    const fourth=rewardUnlock(third.profile,fuzzy);expect(fourth.profile).toBe(third.profile);expect(fourth.unlocked).toBe(false);
    expect(fourth.profile.videos[fuzzy.key]).toBe(3);
  });
  it('restores purchases, selections and video progress and rejects invalid selections',()=>{
    let profile=selectItem(purchase(defaultProfile(),fuzzy,500).profile,fuzzy);
    profile=rewardUnlock(profile,CATALOG.boxes[1]).profile;
    profile.daily='2026-10-04';
    const restored=parseProfile(JSON.stringify(profile));expect(restored.selected.skins).toBe('fuzzies');expect(restored.daily).toBe(profile.daily);
    expect(restored.videos['boxes:rose']).toBe(1);
    const bad=parseProfile(JSON.stringify({owned:['invalid'],selected:{skins:'sushi'},videos:{'skins:sushi':-7,'skins:crystals':99}}));
    expect(bad.selected.skins).toBe('fruit');expect(bad.owned).toHaveLength(3);expect(bad.videos['skins:sushi']).toBe(0);expect(bad.videos['skins:crystals']).toBe(4);
    expect(parseProfile('null')).toEqual(defaultProfile());expect(parseProfile('{broken')).toEqual(defaultProfile());
  });
});
