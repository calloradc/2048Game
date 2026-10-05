import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fixture(cloud:Record<string,unknown>={}, authorized=true) {
  const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
  const events=new Map<string,()=>void>();
  const player={isAuthorized:()=>authorized,getData:vi.fn(async()=>cloud),setData:vi.fn(async()=>{})};
  const sdk={environment:{i18n:{lang:'tr'}},features:{LoadingAPI:{ready:vi.fn()},GameplayAPI:{start:vi.fn(),stop:vi.fn()}},
    on:vi.fn((name:string,listener:()=>void)=>events.set(name,listener)),off:vi.fn(),getPlayer:vi.fn(async()=>player),getStorage:vi.fn(async()=>storage),
    isAvailableMethod:vi.fn(async()=>true),auth:{openAuthDialog:vi.fn(async()=>{})},
    leaderboards:{setScore:vi.fn(async()=>{}),getPlayerEntry:vi.fn(async()=>{throw Error('LEADERBOARD_PLAYER_NOT_PRESENT');}),getEntries:vi.fn(async()=>({entries:[]}))},
    adv:{showRewardedVideo:vi.fn(),showFullscreenAdv:vi.fn()},
  };
  const init=vi.fn(async()=>sdk),windowStub={YaGames:{init},localStorage:storage,addEventListener:vi.fn()};
  vi.stubGlobal('window',windowStub);
  return {sdk,player,init,values,events};
}
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
describe('Yandex singleton and lifecycle',()=>{
  it('loads the official script route before initializing an embedded game',async()=>{
    const f=fixture(),script={src:'',async:false,onload:null as (()=>void)|null,onerror:null as (()=>void)|null};
    const windowStub={YaGames:undefined as unknown,top:{},localStorage:{getItem:()=>null,setItem:()=>{}},addEventListener:vi.fn()};
    vi.stubGlobal('window',windowStub);
    vi.stubGlobal('document',{createElement:()=>script,head:{append:()=>{expect(f.init).not.toHaveBeenCalled();windowStub.YaGames={init:f.init};script.onload!();}}});
    const service=await import('./yandexSdk');await service.initYandexSDK();
    expect(script.src).toBe('/sdk.js');expect(f.init).toHaveBeenCalledTimes(1);
  });
  it('initializes once, subscribes once and emits ready/gameplay only on transitions',async()=>{
    const f=fixture(),service=await import('./yandexSdk');
    const one=service.initYandexSDK(),two=service.initYandexSDK();expect(one).toBe(two);await one;
    expect(f.init).toHaveBeenCalledTimes(1);expect(f.sdk.on).toHaveBeenCalledTimes(2);expect(f.sdk.features.LoadingAPI.ready).not.toHaveBeenCalled();
    service.gameplayStart();expect(f.sdk.features.GameplayAPI.start).not.toHaveBeenCalled();
    service.gameReady();service.gameReady();service.gameplayStart();expect(f.sdk.features.LoadingAPI.ready).toHaveBeenCalledTimes(1);expect(f.sdk.features.GameplayAPI.start).toHaveBeenCalledTimes(1);
    f.events.get('game_api_pause')!();f.events.get('game_api_resume')!();expect(f.sdk.features.GameplayAPI.start).toHaveBeenCalledTimes(1);expect(f.sdk.features.GameplayAPI.stop).not.toHaveBeenCalled();
    service.gameplayStop();service.gameplayStop();expect(f.sdk.features.GameplayAPI.stop).toHaveBeenCalledTimes(1);
    f.events.get('game_api_pause')!();f.events.get('game_api_resume')!();expect(f.sdk.features.GameplayAPI.start).toHaveBeenCalledTimes(1);
    service.destroyYandexListeners();expect(f.sdk.off).toHaveBeenCalledTimes(2);
  });
  it('does not start during the startup advertisement or resume an internal menu',async()=>{
    const f=fixture(),service=await import('./yandexSdk');await service.initYandexSDK();
    f.events.get('game_api_pause')!();service.gameReady();service.gameplayStart();expect(f.sdk.features.GameplayAPI.start).not.toHaveBeenCalled();
    f.events.get('game_api_resume')!();expect(f.sdk.features.GameplayAPI.start).toHaveBeenCalledTimes(1);
    f.events.get('game_api_pause')!();service.gameplayStop();expect(f.sdk.features.GameplayAPI.stop).not.toHaveBeenCalled();
    f.events.get('game_api_resume')!();expect(f.sdk.features.GameplayAPI.stop).toHaveBeenCalledTimes(1);
  });
  it('starts outside the platform with local storage and no ads/rewards',async()=>{
    const windowStub={addEventListener:vi.fn(),top:null as unknown,localStorage:{getItem:()=>null,setItem:()=>{}}};windowStub.top=windowStub;
    vi.stubGlobal('window',windowStub);vi.stubGlobal('location',{hostname:'localhost'});
    const service=await import('./yandexSdk');await service.initYandexSDK();expect(service.isInitialized()).toBe(true);expect(service.getYsdk()).toBeNull();
    const reward=vi.fn();expect(await service.showRewardedAd(reward)).toBe('unavailable');expect(reward).not.toHaveBeenCalled();expect(await service.getLeaderboard()).toBeNull();
  });
  it('falls back safely after an SDK initialization failure',async()=>{
    const f=fixture();f.init.mockRejectedValueOnce(Error('platform offline'));
    const service=await import('./yandexSdk');await service.initYandexSDK();
    expect(service.isInitialized()).toBe(true);expect(service.getYsdk()).toBeNull();expect(await service.showFullscreenAd()).toBe('unavailable');
  });
});
describe('Yandex cloud, ads and current leaderboard contract',()=>{
  it('loads cloud before any writes, coalesces saves and throttles important flushes',async()=>{
    const f=fixture(),service=await import('./yandexSdk');
    let release!:(data:Record<string,unknown>)=>void;
    f.player.getData.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
    const initialization=service.initYandexSDK();await vi.advanceTimersByTimeAsync(0);
    service.saveCloudData(true);expect(f.player.setData).not.toHaveBeenCalled();
    release({jellySave:{version:1,updatedAt:100,best:200,coins:10,settings:{muted:true}}});await initialization;
    expect(f.values.get('jelly-coins')).toBe('10');expect(f.player.setData).not.toHaveBeenCalled();
    const storage=await import('./storage');storage.writeStorage('jelly-coins','20');storage.writeStorage('jelly-best','300');
    await vi.advanceTimersByTimeAsync(1999);expect(f.player.setData).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(f.player.setData).toHaveBeenCalledTimes(1);
    storage.writeStorage('jelly-coins','15');service.saveCloudData(true);await vi.advanceTimersByTimeAsync(4999);expect(f.player.setData).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);expect(f.player.setData).toHaveBeenLastCalledWith(expect.objectContaining({jellySave:expect.objectContaining({coins:15,best:300})}),true);
  });
  it('preserves local progress and never overwrites unknown cloud data after a read error',async()=>{
    const f=fixture();f.values.set('jelly-coins','777');f.player.getData.mockRejectedValueOnce(Error('network'));
    const service=await import('./yandexSdk');await service.initYandexSDK();service.saveCloudData(true);await vi.runAllTimersAsync();
    expect(f.values.get('jelly-coins')).toBe('777');expect(f.player.setData).not.toHaveBeenCalled();
  });
  it('rewards only once in onRewarded, never onClose, and excludes concurrent ads',async()=>{
    const f=fixture(),service=await import('./yandexSdk');await service.initYandexSDK();
    const reward=vi.fn(),request=service.showRewardedAd(reward);
    expect(await service.showRewardedAd(reward)).toBe('unavailable');expect(service.getPlatformState().adOpen).toBe(true);
    const callbacks=f.sdk.adv.showRewardedVideo.mock.calls[0][0].callbacks;
    callbacks.onOpen();expect(reward).not.toHaveBeenCalled();callbacks.onClose();await request;expect(reward).not.toHaveBeenCalled();
    const second=service.showRewardedAd(reward),cb=f.sdk.adv.showRewardedVideo.mock.calls[1][0].callbacks;
    cb.onRewarded();cb.onRewarded();expect(reward).toHaveBeenCalledTimes(1);cb.onClose();cb.onRewarded();await second;expect(reward).toHaveBeenCalledTimes(1);expect(service.getPlatformState().adOpen).toBe(false);
  });
  it('uses leaders and direct leaderboard methods; anonymous players are not forced to sign in',async()=>{
    const f=fixture(),service=await import('./yandexSdk');await service.initYandexSDK();
    expect(await service.submitLeaderboardScore(300)).toBe(true);expect(f.sdk.leaderboards.setScore).toHaveBeenCalledWith('leaders',300);
    expect(f.sdk.isAvailableMethod).toHaveBeenCalledWith('leaderboards.setScore');await service.getLeaderboard();await service.getLeaderboard();
    expect(f.sdk.leaderboards.getEntries).toHaveBeenCalledTimes(1);expect(f.sdk.leaderboards.getEntries).toHaveBeenCalledWith('leaders',{quantityTop:10,includeUser:true,quantityAround:3});expect(f.sdk.auth.openAuthDialog).not.toHaveBeenCalled();
  });
  it('skips anonymous score submission but still reads public top entries',async()=>{
    const f=fixture({},false),service=await import('./yandexSdk');await service.initYandexSDK();
    expect(await service.submitLeaderboardScore(300)).toBe(false);await service.getLeaderboard();expect(f.sdk.leaderboards.setScore).not.toHaveBeenCalled();expect(f.sdk.auth.openAuthDialog).not.toHaveBeenCalled();
  });
  it('finishes failed ad requests without rewards and allows another request',async()=>{
    const f=fixture(),service=await import('./yandexSdk');await service.initYandexSDK();
    const reward=vi.fn(),request=service.showRewardedAd(reward);
    f.sdk.adv.showRewardedVideo.mock.calls[0][0].callbacks.onError(Error('no inventory'));
    expect(await request).toBe('error');expect(reward).not.toHaveBeenCalled();expect(service.getPlatformState().adOpen).toBe(false);
    const second=service.showFullscreenAd();f.sdk.adv.showFullscreenAdv.mock.calls[0][0].callbacks.onClose(false);expect(await second).toBe('closed');
  });
});
