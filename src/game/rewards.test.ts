import { describe, expect, it } from 'vitest';
import { CATALOG } from './catalog';
import { defaultProfile, parseProfile, purchase, rewardUnlock, selectItem } from './profile';
import { claimDaily } from './rewards';

const date=(n:number)=>`2026-10-${String(n).padStart(2,'0')}`;
describe('Daily prize collection',()=>{
  it('allows one prize per local calendar day, without resetting after a gap',()=>{
    const fresh=defaultProfile(),first=claimDaily(fresh,date(1));
    expect(first.coins).toBe(25);expect(first.profile.dailyCount).toBe(1);expect(fresh.dailyCount).toBe(0);
    expect(claimDaily(first.profile,date(1))).toEqual({profile:first.profile,prize:null,coins:0});
    expect(claimDaily(first.profile,'2026-09-30').prize).toBeNull();
    const next=claimDaily(first.profile,date(8));expect(next.profile.dailyCount).toBe(2);expect(next.profile.shakeTokens).toBe(2);
  });
  it('unlocks real exclusive cosmetics over seven claims and restores equipped prizes',()=>{
    let profile=defaultProfile(),coins=0;
    for(let day=1;day<=7;day++){const result=claimDaily(profile,date(day));profile=result.profile;coins+=result.coins;}
    expect(coins).toBe(205);expect(profile.shakeTokens).toBe(2);
    for(const key of ['boxes:lunar','backgrounds:aurora','skins:mochi'])expect(profile.owned).toContain(key);
    const mochi=CATALOG.skins.find(item=>item.id==='mochi')!;
    const restored=parseProfile(JSON.stringify(selectItem(profile,mochi)));
    expect(restored.selected.skins).toBe('mochi');expect(restored.dailyCount).toBe(7);expect(restored.shakeTokens).toBe(2);
  });
  it('replaces duplicate exclusive cosmetics with coins in the next cycle',()=>{
    let profile=defaultProfile();for(let day=1;day<=14;day++)profile=claimDaily(profile,date(day)).profile;
    let coins=0;for(let day=15;day<=28;day++){const result=claimDaily(profile,date(day));profile=result.profile;coins+=result.coins;}
    expect(coins).toBe(1605);expect(profile.owned).toHaveLength(7);expect(profile.shakeTokens).toBe(28);
  });
  it('extends saved seven-day progress through the second week and starts a new cycle on day fifteen',()=>{
    let profile=defaultProfile();for(let day=1;day<=7;day++)profile=claimDaily(profile,date(day)).profile;
    profile=parseProfile(JSON.stringify(profile));
    const eighth=claimDaily(profile,date(8));expect(eighth.coins).toBe(80);expect(eighth.profile.dailyCount).toBe(8);
    profile=eighth.profile;let coins=eighth.coins;
    for(let day=9;day<=14;day++){const result=claimDaily(profile,date(day));profile=result.profile;coins+=result.coins;}
    expect(coins).toBe(450);expect(profile.shakeTokens).toBe(14);expect(profile.owned).toContain('skins:crystals');
    expect(claimDaily(profile,date(14)).prize).toBeNull();
    const fifteenth=claimDaily(parseProfile(JSON.stringify(profile)),date(15));
    expect(fifteenth.coins).toBe(25);expect(fifteenth.profile.dailyCount).toBe(15);
  });
  it('keeps daily exclusives out of coin and video purchases',()=>{
    const fresh=defaultProfile();
    for(const list of Object.values(CATALOG))for(const item of list.filter(item=>item.exclusive)){
      expect(purchase(fresh,item,9999).purchased).toBe(false);expect(rewardUnlock(fresh,item)).toEqual({profile:fresh,unlocked:false});
    }
  });
  it('migrates the previous daily gift and rejects invalid bank values',()=>{
    const profile=parseProfile(JSON.stringify({daily:date(1),shakeTokens:-2,coinVideo:Infinity,bundles:['cozy','bad','cozy']}));
    expect(profile.dailyCount).toBe(1);expect(profile.shakeTokens).toBe(0);expect(profile.coinVideo).toBe(0);expect(profile.bundles).toEqual(['cozy']);
  });
});
