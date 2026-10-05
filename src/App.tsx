import { t, useLanguage, localeTag } from './i18n';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { asset, fruitAsset } from './game/fruits';
import { BOARD, FruitWorld, initialState, SHAKE_PRICE } from './game/physics';
import { GameRenderer } from './game/renderer';
import { GameAudio } from './game/audio';
import { backgroundAsset, wideBackgroundAsset, itemByKey, type ShopItem, type Category } from './game/catalog';
import { parseProfile, purchase, rewardUnlock, selectItem, type Profile } from './game/profile';
import { calendarDay, claimDaily, prizeName } from './game/rewards';
import { bundleOffer, purchaseBundle, purchaseShakes, rewardCoinPack, type Bundle, type SHAKE_PACKS } from './game/commerce';
import { FruitCarousel } from './ui/FruitCarousel';
import { usePresence } from './ui/usePresence';
import { Icon } from './ui/Icon';
import { Shop } from './ui/Shop';
import { Rewards } from './ui/Rewards';
import { RewardedAd, type AdReward } from './ui/RewardedAd';
import { InterstitialAd } from './ui/InterstitialAd';
import { Toast } from './ui/Toast';
import { SoftScroll } from './ui/SoftScroll';
import { AD_COINS, AD_COIN_PACK } from './game/economy';
import { compactBalance } from './ui/compactBalance';
import { useGameViewport } from './ui/useGameViewport';
import { LanguagePicker } from './ui/LanguagePicker';
import { Leaderboard } from './ui/Leaderboard';
import { roundRankProgress, type RankProgress } from './game/leaderboard';
import { uiAsset } from './ui/assets';

const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional in embedded web games. */ } };
type Modal = 'help' | 'settings' | 'wallet' | 'restart' | 'shop' | 'rewards' | 'leaderboard' | null;
const readNumber = (key: string, fallback = 0) => Math.max(0, Math.floor(Number(read(key, String(fallback))) || 0));
const format = (n: number) => n.toLocaleString(localeTag());
const dialogLabels={gameover:'Игра окончена',won:'Победа',help:'Как играть',wallet:'Монеты',restart:'Новая игра',settings:'Настройки',shop:'Магазин',rewards:'Подарки',leaderboard:'Лидерборд'};

export default function App() {
  const language=useLanguage();
  const viewport=useGameViewport();
  const [state, setState] = useState(() => initialState(readNumber('jelly-best'), readNumber('jelly-coins')));
  const [profile,setProfile]=useState(()=>parseProfile(read('jelly-profile','{}')));
  const [day,setDay]=useState(calendarDay);
  const profileRef=useRef(profile);
  const [appearance,setAppearance]=useState(profile.selected),appearanceRef=useRef(profile.selected);
  const shopOriginal=useRef<Profile['selected']|null>(null),shopFocus=useRef<Partial<Record<Category,ShopItem>>>({});
  const appearanceVersion=useRef(0);
  const [scale, setScale] = useState(1),[loaded, setLoaded] = useState(false),[error, setError] = useState(false),[progress, setProgress] = useState(0),[splashDone, setSplashDone] = useState(false);
  const [landscape,setLandscape]=useState(false),[interstitial,setInterstitial]=useState(false);
  useEffect(()=>{if(state.status==='gameover')setInterstitial(true);},[state.status]);
  const [modal, setModal] = useState<Modal>(null);
  const {rendered:dialogKind,leaving:dialogLeaving}=usePresence(modal??(state.status==='playing'?null:state.status));
  const overlay=dialogKind!==null;
  const [muted, setMuted] = useState(read('jelly-muted', 'false') === 'true');
  const [shaking, setShaking] = useState(false),[appearanceBusy,setAppearanceBusy]=useState(false);
  const [restartReady,setRestartReady]=useState(false);
  useEffect(()=>{setRestartReady(false);if(interstitial||dialogKind!=='gameover'&&dialogKind!=='won')return;const timer=setTimeout(()=>setRestartReady(true),1000);return()=>clearTimeout(timer);},[dialogKind,interstitial]);
  const [ad,setAd]=useState<{id:number;reward:AdReward}|null>(null),adRef=useRef<typeof ad>(null),adId=useRef(0);
  const {rendered:renderedAd,leaving:adLeaving}=usePresence(ad,180);
  const [toast,setToast]=useState<string|null>(null),toastTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null),rendererRef = useRef<GameRenderer | null>(null),worldRef = useRef<FruitWorld | null>(null),audioRef = useRef<GameAudio | null>(null),dragRef = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null),dialogRef = useRef<HTMLDivElement>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBest = useRef(state.best),savedCoins = useRef(state.coins);
  const roundStartingBest=useRef(state.best);
  const [rankProgress,setRankProgress]=useState<RankProgress|null>(null);
  const notify=(text:string)=>{setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),2600);};
  const commitProfile=(next:Profile)=>{profileRef.current=next;setProfile(next);save('jelly-profile',JSON.stringify(next));};
  useEffect(()=>{
    const update=()=>setDay(calendarDay()),timer=setInterval(update,60_000);
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[]);

  useEffect(() => { if(!loaded)return;const timer=setTimeout(()=>setSplashDone(true),300);return()=>clearTimeout(timer); },[loaded]);
  useEffect(() => {
    const resize = () => {
      const h=viewport.height,w=viewport.width;
      const safe = window.getComputedStyle(shellRef.current ?? document.documentElement);
      const insets = (parseFloat(safe.paddingTop) || 0) + (parseFloat(safe.paddingBottom) || 0);
      const wide=w>h&&w>=600;setLandscape(wide);
      setScale(Math.min(w / (wide?860:420), (h - insets - 12) / (wide?580:864), 1.12));
    };
    resize(); window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
    const context = (e: Event) => e.preventDefault(); document.addEventListener('contextmenu', context);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); document.removeEventListener('contextmenu', context); };
  }, [viewport]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let alive = true;
    const world = new FruitWorld(lastBest.current,savedCoins.current), audio = new GameAudio(muted), renderer = new GameRenderer(canvas, world);
    worldRef.current = world; audioRef.current = audio; rendererRef.current = renderer;
    world.onChange = snapshot => {
      if (!alive) return;
      setState(snapshot);
      if (snapshot.best > lastBest.current) { lastBest.current = snapshot.best; save('jelly-best', String(snapshot.best)); }
      if(snapshot.coins!==savedCoins.current){savedCoins.current=snapshot.coins;save('jelly-coins',String(snapshot.coins));}
    };
    world.onMerge = event => { renderer.merge(event); audio.play('merge'); };
    const unlockAudio = () => audio.unlock();
    const buttonAudio = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (button && !button.disabled && !button.closest('[inert]')) audio.play('button');
    };
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('click', buttonAudio, true);
    world.emit();
    const appearance=profileRef.current.selected;
    void renderer.start((done,total)=>{if(alive)setProgress(Math.round(done/total*100));},appearance.skins,appearance.boxes,appearance.backgrounds).then(() => { if (alive) setLoaded(true); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; document.removeEventListener('pointerdown', unlockAudio, true); document.removeEventListener('click', buttonAudio, true); renderer.destroy(); world.destroy(); audio.destroy(); clearTimeout(shakeTimer.current);clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; save('jelly-muted', String(muted)); }, [muted]);
  useEffect(() => { if (rendererRef.current) rendererRef.current.paused = overlay || !loaded; dragRef.current = null; }, [overlay,loaded]);
  useEffect(() => {
    const cancel = () => { dragRef.current = null; };
    document.addEventListener('visibilitychange', cancel); window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('visibilitychange', cancel); window.removeEventListener('blur', cancel); };
  }, []);
  useEffect(() => {
    if (!overlay||renderedAd||interstitial||dialogLeaving) return;
    dialogRef.current?.focus({preventScroll:true});
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        if (e.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialogRef.current)) { e.preventDefault(); buttons[buttons.length - 1].focus({preventScroll:true}); }
        else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus({preventScroll:true}); }
      }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [dialogKind, overlay, renderedAd, interstitial, dialogLeaving]);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => { const bounds = event.currentTarget.getBoundingClientRect();worldRef.current?.setAim((event.clientX - bounds.left) / bounds.width * BOARD.width); };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!loaded || overlay || state.status !== 'playing' || dragRef.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); audioRef.current?.unlock();dragRef.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); aim(event);
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current !== event.pointerId) return;
    aim(event); dragRef.current = null;
    if (!overlay) worldRef.current?.drop();
  };
  const restart = () => {
    const world=worldRef.current;if(!world)return;
    const progress=roundRankProgress(world.state.status,world.state.score,roundStartingBest.current);
    roundStartingBest.current=world.state.best;
    world.reset();
    if(progress)setRankProgress(progress);
    setModal(progress?'leaderboard':null);
  };
  const shake = () => {
    const world=worldRef.current;if(!world||world.state.status!=='playing')return;
    if(world.state.shakes===0&&profileRef.current.shakeTokens>0){world.grantShake();commitProfile({...profileRef.current,shakeTokens:profileRef.current.shakeTokens-1});}
    const coinsBefore = world.state.coins;
    audioRef.current?.unlock();if (!world.shake()) return;
    if (world.state.coins < coinsBefore) audioRef.current?.play('purchase');
    setShaking(true);clearTimeout(shakeTimer.current); shakeTimer.current = setTimeout(() => setShaking(false), 500);
  };
  const fullscreen = () => { if (!document.fullscreenElement) void shellRef.current?.requestFullscreen?.().catch(() => {}); else void document.exitFullscreen().catch(() => {}); };
  const buy=(item:ShopItem)=>{
    const world=worldRef.current;if(!world)return;
    const result=purchase(profileRef.current,item,world.state.coins);
    if(!result.purchased||!world.spendCoins(item.price))return;
    audioRef.current?.play('purchase');
    commitProfile(result.profile);void showAppearance({...appearanceRef.current,[item.category]:item.id});notify(t("{item} теперь в коллекции!",{item:item.name}));
  };
  const buyBundle=(bundle:Bundle)=>{
    const world=worldRef.current;if(!world)return;
    const cost=bundleOffer(profileRef.current,bundle).price,result=purchaseBundle(profileRef.current,bundle,world.state.coins);
    if(!result.purchased||!world.spendCoins(cost))return;
    audioRef.current?.play('purchase');
    commitProfile(result.profile);
    bundle.items.forEach(key=>{const item=itemByKey(key)!;shopFocus.current[item.category]=item;});
    void showAppearance(result.profile.selected);notify(t("{item} в коллекции! +{n} встряски",{item:bundle.name,n:bundle.shakes}));
  };
  const buyShakes=(pack:typeof SHAKE_PACKS[number])=>{
    const world=worldRef.current;if(!world)return;
    const result=purchaseShakes(profileRef.current,pack,world.state.coins);
    if(!result.purchased||!world.spendCoins(pack.price))return;
    audioRef.current?.play('purchase');
    commitProfile(result.profile);notify(t("+{n} встрясок в запасе!",{n:pack.amount}));
  };
  const showAppearance=async(selected:Profile['selected'])=>{
    const version=++appearanceVersion.current;
    appearanceRef.current=selected;setAppearanceBusy(true);
    try {
      if(await rendererRef.current?.setAppearance(selected.skins,selected.boxes,selected.backgrounds))setAppearance(selected);
    } catch {if(version===appearanceVersion.current)notify(t("Не удалось загрузить оформление. Попробуй ещё раз."));}
    finally {if(version===appearanceVersion.current)setAppearanceBusy(false);}
  };
  const apply=(item:ShopItem)=>{
    if(!profileRef.current.owned.includes(item.key))return;
    const next=selectItem(profileRef.current,item);commitProfile(next);void showAppearance(next.selected);
  };
  const focusItem=(item:ShopItem)=>{
    shopFocus.current[item.category]=item;
    if(profileRef.current.owned.includes(item.key))commitProfile(selectItem(profileRef.current,item));
    void showAppearance({...appearanceRef.current,[item.category]:item.id});
  };
  useEffect(()=>{
    if(modal==='shop'){
      shopOriginal.current={...profileRef.current.selected};shopFocus.current={};return;
    }
    const original=shopOriginal.current;if(!original)return;
    shopOriginal.current=null;
    let next=profileRef.current;
    for(const category of Object.keys(original) as Category[]){
      const focused=shopFocus.current[category];
      if(focused&&!next.owned.includes(focused.key))next=selectItem(next,itemByKey(`${category}:${original[category]}`)!);
    }
    commitProfile(next);void showAppearance(next.selected);shopFocus.current={};
  },[modal]);
  const watch=(reward:AdReward)=>{if(adRef.current)return;const request={id:++adId.current,reward};adRef.current=request;setAd(request);};
  const cancelAd=()=>{adRef.current=null;setAd(null);};
  const completeAd=(id:number)=>{
    const request=adRef.current,world=worldRef.current;if(!request||request.id!==id||!world)return;
    cancelAd();const reward=request.reward,coinsBefore=world.state.coins;
    if(reward.type==='coins'){world.grantCoins(AD_COINS);notify(t("+{n} монет в копилку!",{n:AD_COINS}));}
    else if(reward.type==='coin-pack'){const result=rewardCoinPack(profileRef.current);commitProfile(result.profile);if(result.coins){world.grantCoins(result.coins);notify(t("+{n} монет в копилку!",{n:AD_COIN_PACK}));}else notify(t("Ещё одно видео до +{n} монет",{n:AD_COIN_PACK}));}
    else if(reward.type==='shake'){commitProfile({...profileRef.current,shakeTokens:profileRef.current.shakeTokens+1});notify(t("+1 встряска в запасе!"));}
    else if(reward.type==='revive'){if(world.revive()){setModal(null);notify(t("Верхние кубики убраны. Продолжаем!"));}}
    else if(reward.type==='double'){if(world.doubleEarnings())notify(t("Монеты за игру удвоены!"));}
    else {const item=itemByKey(reward.key);if(!item)return;const result=rewardUnlock(profileRef.current,item);commitProfile(result.profile);if(result.unlocked)void showAppearance({...appearanceRef.current,[item.category]:item.id});notify(result.unlocked?t("{item} открыт!",{item:item.name}):t("Ещё {n} видео до открытия",{n:item.videos-(result.profile.videos[item.key]??0)}));}
    if(world.state.coins>coinsBefore)audioRef.current?.play('purchase');
  };
  const daily=()=>{const world=worldRef.current;if(!world)return;const result=claimDaily(profileRef.current,calendarDay());if(!result.prize)return;commitProfile(result.profile);if(result.coins)world.grantCoins(result.coins);setDay(calendarDay());notify(t("Твой подарок: {item}!",{item:prizeName(result.prize)}));};
  const skin=appearance.skins;
  const dialog=overlay&&<div key={dialogKind} className={`overlay ${dialogKind==='shop'?'shop-fullscreen':dialogKind==='rewards'?'rewards-fullscreen':''} ${dialogLeaving?'is-leaving':''}`} onPointerDown={e=>e.stopPropagation()}>
        <div className={`dialog ${dialogKind==='shop'?'shop-dialog':dialogKind==='rewards'?'rewards-dialog':dialogKind==='leaderboard'?'leaderboard-dialog':''}`} role="dialog" aria-modal="true" aria-label={dialogKind?t(dialogLabels[dialogKind]):''} tabIndex={-1} ref={dialogRef}>
          <div className="dialog-content" inert={!!renderedAd||interstitial||dialogLeaving}>
            {dialogKind!=='gameover'&&dialogKind!=='won'&&<button className="dialog-close" aria-label={t("Закрыть")} onClick={()=>setModal(null)}><Icon name="close" size={21}/></button>}
            <SoftScroll enabled={dialogKind!=='shop'&&dialogKind!=='rewards'}>{dialogKind==='shop'?<Shop profile={profile} coins={state.coins} busy={appearanceBusy} onBuy={buy} onFocus={focusItem} onVideo={item=>watch({type:'unlock',key:item.key})} onCoins={()=>watch({type:'coins'})} onCoinPack={()=>watch({type:'coin-pack'})} onShakeVideo={()=>watch({type:'shake'})} onShakes={buyShakes} onBundle={buyBundle} onRewards={()=>setModal('rewards')} onClose={()=>setModal(null)}/>:dialogKind==='settings'?<>
              <Icon name="settings" size={65}/><span className="eyebrow settings-caption">{t("УСТРОИМ ВСЁ ПО-ТВОЕМУ")}</span><h1>{t("Настройки")}</h1>
              <div className="settings-list">
                <button className="setting-row" role="switch" aria-checked={!muted} onClick={()=>{audioRef.current?.unlock();setMuted(!muted);}}><Icon name={muted?'mute':'sound'} size={27}/><span>{t("Звук")}</span><i className={!muted?'on':''}/></button>
                <button className="setting-row" onClick={fullscreen}><Icon name="fullscreen" size={27}/><span>{t("На весь экран")}</span><Icon name="right" size={17}/></button>
                <button className="setting-row" onClick={()=>setModal('restart')}><Icon name="restart" size={27}/><span>{t("Начать заново")}</span><Icon name="right" size={17}/></button>
                <LanguagePicker language={language}/>
              </div><button className="primary-button" onClick={()=>setModal(null)}><Icon name="play" size={19}/> {t("Вернуться в игру")}</button>
            </>:dialogKind==='rewards'?<Rewards profile={profile} day={day} busy={appearanceBusy} onClaim={daily} onSelect={item=>void apply(item)} onClose={()=>setModal(null)}/>:dialogKind==='leaderboard'&&rankProgress?<Leaderboard progress={rankProgress} onContinue={()=>setModal(null)}/>:dialogKind==='gameover'||dialogKind==='won'?<>
              <img className="dialog-mascot" src={fruitAsset(dialogKind==='won'?10:6,skin)} alt=""/><span className="eyebrow">{dialogKind==='won'?t("2048! ВСЯ СЕМЬЯ В СБОРЕ!"):t("КОНТЕЙНЕР ПОЛОН")}</span><h1>{dialogKind==='won'?t("Сочный финал!"):t("Хороший урожай!")}</h1>
              <div className="result-score">{format(state.score)}<span>{t("очков за эту игру")}</span></div><div className="round-earnings"><img src={asset("particles/11.webp")} alt=""/>{t("+{n} монет",{n:state.earned+state.bonusCoins})}{state.doubled&&<Icon name="check" size={18}/>}</div>
              {dialogKind==='gameover'&&state.revives===0&&<button className="reward-button" onClick={()=>watch({type:'revive'})}><Icon name="video" size={27}/><span>{t("Спасти урожай")}<small>{t("Убрать верхние кубики · 1 раз за игру")}</small></span><Icon name="rescue" size={27}/></button>}
              {state.earned>0&&!state.doubled&&<button className="reward-button" onClick={()=>watch({type:'double'})}><Icon name="video" size={27}/><span>{t("Монеты за игру ×2")}<small>{t("Ещё +{n} монет",{n:state.earned})}</small></span><Icon name="double" size={27}/></button>}
              {(dialogKind==='won'||restartReady)&&<button className="primary-button restart-delayed" onClick={dialogKind==='won'?()=>worldRef.current?.continue():restart}><Icon name={dialogKind==='won'?'play':'restart'} size={19}/>{dialogKind==='won'?t("Продолжить играть"):t("Ещё разок")}</button>}
              {dialogKind==='won'&&<button className="text-button" onClick={restart}>{t("Начать заново")}</button>}
            </>:dialogKind==='wallet'?<>
              <img className="dialog-mascot coin-mascot" src={asset("particles/11.webp")} alt=""/><span className="eyebrow">{t("ТВОЯ КОПИЛКА")}</span><h1>{t("{n} монет",{n:compactBalance(state.coins)})}</h1><p>{t("Получай монеты за слияния и выбирай новые образы в магазине.")}</p><p className="help-note">{t("Три встряски на игру бесплатно. Потом — по {n} монет. Покупки и монеты сохраняются.",{n:SHAKE_PRICE})}</p>
              <button className="reward-button" onClick={()=>watch({type:'coins'})}><Icon name="video" size={27}/><span>{t("+{n} монет",{n:AD_COINS})}<small>{t("За короткое видео")}</small></span><img className="button-coin" src={asset("particles/11.webp")} alt=""/></button><button className="primary-button" onClick={()=>setModal('shop')}><Icon name="shop" size={21}/> {t("В магазин")}</button><button className="text-button" onClick={()=>setModal(null)}>{t("За сочным урожаем!")}</button>
            </>:dialogKind==='help'?<>
              <img className="dialog-mascot" src={fruitAsset(1,skin)} alt=""/><span className="eyebrow">{t("ПРОЩЕ ПРОСТОГО")}</span><h1>{t("Устрой переполох")}</h1><div className="help-steps"><p><b>1</b><span><strong>{t("Прицелься и отпусти")}</strong>{t("Веди пальцем над контейнером.")}</span></p><p><b>2</b><span><strong>{t("Соединяй одинаковые")}</strong>{t("Два одинаковых кубика — один побольше.")}</span></p><p><b>3</b><span><strong>{t("Собери всю семью")}</strong>{t("Переполнение выше линии ведёт к проигрышу.")}</span></p></div><p className="help-note">{t("Три встряски бесплатно. Если кубики остаются выше линии, красная полоска заполняется — освободи место!")}</p><button className="primary-button" onClick={()=>setModal(null)}>{t("Понятно, играем!")}</button>
            </>:dialogKind==='restart'?<>
              <img className="dialog-mascot" src={fruitAsset(0,skin)} alt=""/><h1>{t("Новый урожай?")}</h1><p>{t("Начнём с пустого счёта и трёх встрясок. Рекорд, монеты и покупки сохранятся. Желешки будем открывать снова.")}</p><button className="primary-button" onClick={restart}><Icon name="restart" size={20}/>{t("Начать заново")}</button><button className="text-button" onClick={()=>setModal(null)}>{t("Продолжить эту игру")}</button>
            </>:null}</SoftScroll>
          </div>
          {renderedAd&&<RewardedAd key={renderedAd.id} reward={renderedAd.reward} leaving={adLeaving} onComplete={()=>completeAd(renderedAd.id)} onCancel={cancelAd}/>}
        </div>
      </div>;

  return <main className={`game-screen ${landscape?'landscape':''}`} ref={shellRef} aria-busy={!loaded} style={{width:viewport.width,height:viewport.height,zoom:1/viewport.zoom,'--viewport-height':`${viewport.height}px`,'--viewport-width':`${viewport.width}px`,'--scenery':`url("${new URL(backgroundAsset(appearance.backgrounds),document.baseURI).href}")`,'--scenery-wide':`url("${new URL(wideBackgroundAsset(appearance.backgrounds),document.baseURI).href}")`,'--cover':`url("${new URL(asset("cover.webp"),document.baseURI).href}")`,'--cover-wide':`url("${new URL(asset("cover-wide.webp"),document.baseURI).href}")`} as CSSProperties}>
    <div className="ambient-background" aria-hidden="true" />
    <div className={`scene ${loaded ? 'is-ready' : ''}`} inert={!loaded||overlay} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
      <header className="header">
        <div className="brand"><span className="brand-leaf"><Icon name="leaf" size={25} /></span><div className="brand-text">jelly<span>fruit<span className="brand-dot">.</span></span></div></div>
        <button className="wallet" aria-label={t("Баланс монет")} onClick={()=>setModal('wallet')}><img src={asset("particles/11.webp")} alt="" /><strong key={state.coins} data-testid="coins" data-coins={state.coins}>{compactBalance(state.coins)}</strong></button>
        <div className="header-buttons"><button className="round-button sound-button" aria-label={muted?t("Включить звук"):t("Выключить звук")} onClick={()=>{audioRef.current?.unlock();setMuted(!muted);}}><Icon name={muted?'mute':'sound'} size={26}/></button><button className="round-button" aria-label={t("Настройки")} onClick={()=>setModal('settings')}><Icon name="settings" size={23}/></button></div>
      </header>
      <section className="scoreboard" aria-label={t("Результат")}>
        <div className="score-card"><span className="small-label">{t("ТВОЙ СЧЁТ")}</span><strong key={state.score} data-testid="score">{format(state.score)}</strong></div>
        <div className="best-card"><span className="small-label"><Icon name="trophy" size={13}/> {t("РЕКОРД")}</span><strong key={state.best}>{format(state.best)}</strong></div>
      </section>
      <div className="game-toolbar">
        <button className="shop-launch" aria-label={t("Магазин")} onClick={()=>setModal('shop')}><span className="shop-launch-art"><Icon name="shop" size={64}/></span><span className="shop-launch-label">{t("МАГАЗИН")}</span></button>
        <div className="next-fruit"><span>{t("ДАЛЬШЕ")}</span><img key={`${skin}-${state.drops}`} src={fruitAsset(state.next,skin)} alt={t("Следующий кубик")} draggable={false}/></div>
      </div>
      <div className={`playfield ${shaking?'shaking':''} ${state.danger?'danger':''}`}>
        <canvas ref={canvasRef} aria-label={t("Игровой контейнер. Веди пальцем и отпусти, чтобы бросить фрукт.")} tabIndex={0}
          onPointerDown={pointerDown} onPointerMove={e=>{if(dragRef.current===e.pointerId||e.pointerType==='mouse')aim(e);}} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;}} onLostPointerCapture={()=>{dragRef.current=null;}}
          onKeyDown={e=>{if(overlay||state.status!=='playing'||!loaded)return;const world=worldRef.current;if(!world)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();world.setAim(world.aim+(e.key==='ArrowLeft'?-15:15));}if(e.key===' '||e.key==='Enter'){e.preventDefault();audioRef.current?.unlock();world.drop();}}}/>
        {state.danger>0&&<div className="danger-message">{t("Контейнер почти полон!")} {state.status==='playing'?t("Освободи место"):''}</div>}
      </div>
      <FruitCarousel discovered={state.discovered} skin={skin}/>
      <footer className="controls">
        <button className="utility-button" onClick={()=>setModal('help')} aria-label={t("Как играть")}><Icon name="help" size={34}/></button>
        <button className="shake-button" onClick={shake} disabled={(!state.shakes&&!profile.shakeTokens&&state.coins<SHAKE_PRICE)||!loaded||state.status!=='playing'}><Icon name="shake" size={28}/><span>{t("Встряхнуть")}</span><b>{state.shakes+profile.shakeTokens>0?state.shakes+profile.shakeTokens:<><img src={asset("particles/11.webp")} alt={t("монет")}/>{SHAKE_PRICE}</>}</b></button>
        <button className="utility-button gift-button" onClick={()=>setModal('rewards')} aria-label={t("Подарки")} aria-description={profile.daily<day?t('Доступен ежедневный подарок'):undefined}><Icon name="gift" size={34}/>{profile.daily<day&&<img className="gift-alert" src={uiAsset('icon-gift-alert')} alt="" aria-hidden="true"/>}</button>
      </footer>
    </div>
    {shellRef.current&&createPortal(dialog,shellRef.current)}
    {interstitial&&<InterstitialAd onComplete={()=>setInterstitial(false)}/>}
    <Toast text={toast} onDismiss={()=>{clearTimeout(toastTimer.current);setToast(null);}}/>
    {!splashDone&&<section className={`loading loading-screen ${loaded?'finished':''}`} aria-label={t("Загрузка игры")}><div className="loading-content"><div className="loading-logo">jelly <span>fruit.</span></div><div className="loading-status"><h1>{error?t("Фрукты задержались"):t("Скоро будет сочно!")}</h1><p>{error?t("Не удалось загрузить ассеты. Попробуй ещё раз."):t("Собираем маленькую фруктовую семью")}</p>{!error?<><div className="loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div><span className="loading-percent">{progress}%</span></>:<button className="primary-button" onClick={()=>window.location.reload()}>{t("Попробовать ещё")}</button>}</div></div><span className="loading-caption">{t("НЕМНОГО ЖЕЛЕЙНОГО ВОЛШЕБСТВА")}</span></section>}
    <div className="desktop-note"><Icon name="left" size={14}/><span>{t("Наведи мышку и нажми, чтобы бросить")}</span><Icon name="right" size={14}/></div>
  </main>;
}
