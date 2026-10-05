import { describe,expect,it } from 'vitest';
import { CATALOG } from './catalog';
import { defaultProfile,parseProfile,purchase,rewardUnlock,selectItem } from './profile';

describe('Saved shop ownership and rewarded unlocks',()=>{
  const fuzzy=CATALOG.skins[1];
  it('deducts the price once and only equips an owned item',()=>{
    const fresh=defaultProfile();
    expect(selectItem(fresh,fuzzy)).toBe(fresh);
    expect(purchase(fresh,fuzzy,1169).purchased).toBe(false);
    const bought=purchase(fresh,fuzzy,1270);
    expect(bought.coins).toBe(100);expect(bought.profile.owned).toContain(fuzzy.key);expect(bought.profile.selected.skins).toBe('fuzzies');
    const again=purchase(bought.profile,fuzzy,1270);expect(again.purchased).toBe(false);expect(again.coins).toBe(1270);
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
    let profile=selectItem(purchase(defaultProfile(),fuzzy,1270).profile,fuzzy);
    profile=rewardUnlock(profile,CATALOG.boxes[1]).profile;
    profile.daily='2026-10-04';
    const restored=parseProfile(JSON.stringify(profile));expect(restored.selected.skins).toBe('fuzzies');expect(restored.daily).toBe(profile.daily);
    expect(restored.videos['boxes:rose']).toBe(1);
    const bad=parseProfile(JSON.stringify({owned:['invalid'],selected:{skins:'sushi'},videos:{'skins:sushi':-7,'skins:crystals':99}}));
    expect(bad.selected.skins).toBe('fruit');expect(bad.owned).toHaveLength(3);expect(bad.videos['skins:sushi']).toBe(0);expect(bad.videos['skins:crystals']).toBe(8);
    expect(parseProfile('null')).toEqual(defaultProfile());expect(parseProfile('{broken')).toEqual(defaultProfile());
  });
  it('requires more videos for premium skins and preserves saved progress and ownership',()=>{
    const crystals=CATALOG.skins.find(item=>item.id==='crystals')!,balls=CATALOG.skins.find(item=>item.id==='balls')!;
    expect(crystals.videos).toBe(8);expect(balls.price).toBe(910);expect(balls.price).toBeLessThan(fuzzy.price);
    let profile=parseProfile(JSON.stringify({videos:{[crystals.key]:3},owned:[balls.key]}));
    expect(profile.owned).toContain(balls.key);
    for(let count=4;count<=8;count++) {
      const result=rewardUnlock(profile,crystals);expect(result.unlocked).toBe(count===8);
      profile=parseProfile(JSON.stringify(result.profile));expect(profile.videos[crystals.key]).toBe(count);
    }
    expect(profile.owned).toContain(crystals.key);expect(profile.selected.skins).toBe('crystals');
  });
});
