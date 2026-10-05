/** SDK contract fixture: never shipped in dist. Platform UI lives outside React. */
export async function installYandexMock(page, options = {}) {
  await page.addInitScript(options => {
    const calls = [], listeners = new Map();
    let data = options.cloud ?? {}, authorized = options.authorized ?? true, score = options.score ?? 0, activeAd;
    const record = (method, ...args) => calls.push({ method, args, time: Date.now() });
    const emit = event => { record(event); for (const listener of listeners.get(event) ?? []) listener(); };
    const player = { isAuthorized: () => authorized,
      getData: async () => { record('getData'); if(options.cloudDelay)await new Promise(resolve=>setTimeout(resolve,options.cloudDelay)); if(options.cloudError)throw Error('cloud unavailable'); return data; },
      setData: async (next,flush) => { record('setData',next,flush); data=next; },
    };
    const entry = () => ({ rank: Math.max(1,100000-score),score,player:{uniqueID:'self',publicName:'SDK player'} });
    const ad = (kind,{callbacks}) => {
      record(kind); activeAd={callbacks,kind};
      emit('game_api_pause');callbacks.onOpen();
      const element=document.createElement('div');element.className='mock-platform-ad';element.setAttribute('role','dialog');element.setAttribute('aria-label','Platform ad');
      element.style.cssText='position:fixed;inset:0;z-index:1000;background:white;display:grid;place-content:center';
      const close=document.createElement('button');close.dataset.testAdClose='';close.textContent='Close ad';element.append(close);document.body.append(element);
      let finished=false,timer;
      const finish=reward=>{if(finished)return;finished=true;clearTimeout(timer);if(reward){callbacks.onRewarded?.();callbacks.onRewarded?.();}element.remove();callbacks.onClose(kind==='fullscreen');emit('game_api_resume');activeAd=undefined;};
      close.onclick=()=>finish(false);activeAd.finish=finish;
      if(!options.manualAds)timer=setTimeout(()=>finish(kind==='rewarded'),3000);
    };
    const sdk = {
      environment:{i18n:{lang:options.language??navigator.language.split('-')[0]}},
      features:{LoadingAPI:{ready:()=>record('ready',{loading:!!document.querySelector('.loading'),inert:document.querySelector('.scene')?.inert,canvas:!!document.querySelector('canvas')})},GameplayAPI:{start:()=>record('start'),stop:()=>record('stop')}},
      on:(event,callback)=>{record('on',event);if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(callback);if(options.startPaused&&event==='game_api_pause')callback();},
      off:(event,callback)=>{record('off',event);listeners.get(event)?.delete(callback);},
      getStorage:async()=>localStorage,getPlayer:async()=>{record('getPlayer');return player;},
      isAvailableMethod:async method=>{record('isAvailableMethod',method);return !method.includes('PlayerEntry')&&!method.includes('setScore')||authorized;},
      auth:{openAuthDialog:async()=>{record('auth');authorized=true;}},
      adv:{showRewardedVideo:options=>ad('rewarded',options),showFullscreenAdv:options=>ad('fullscreen',options)},
      leaderboards:{
        setScore:async(name,next)=>{record('setScore',name,next);score=next;},
        getPlayerEntry:async name=>{record('getPlayerEntry',name);return entry();},
        getEntries:async(name,params)=>{record('getEntries',name,params);return {entries:[{rank:1,score:50000,player:{uniqueID:'rival',publicName:'Real SDK rival'}},...(authorized?[entry()]:[])]};},
      },
    };
    window.__sdkMock={calls,emit,sdk,get ad(){return activeAd;},get data(){return data;}};
    window.YaGames={init:async()=>{record('init');return sdk;}};
  }, options);
}
