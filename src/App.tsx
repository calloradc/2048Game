import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { asset, fruitAsset } from './game/fruits';
import { BOARD, FruitWorld, initialState, SHAKE_PRICE } from './game/physics';
import { GameRenderer } from './game/renderer';
import { GameAudio } from './game/audio';
import { backgroundAsset, itemByKey, type ShopItem } from './game/catalog';
import { parseProfile, purchase, rewardUnlock, selectItem, type Profile } from './game/profile';
import { FruitCarousel } from './ui/FruitCarousel';
import { usePresence } from './ui/usePresence';
import { Icon } from './ui/Icon';
import { Shop } from './ui/Shop';
import { RewardedAd, type AdReward } from './ui/RewardedAd';
import { UI_TEXTURES } from './ui/assets';

const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional in embedded web games. */ } };
type Modal = 'help' | 'settings' | 'wallet' | 'restart' | 'shop' | 'rewards' | null;
const readNumber = (key: string, fallback = 0) => Math.max(0, Math.floor(Number(read(key, String(fallback))) || 0));
const format = (n: number) => n.toLocaleString('ru-RU');
const today=()=>new Date().toISOString().slice(0,10);
const dialogLabels={gameover:'Игра окончена',won:'Победа',help:'Как играть',wallet:'Монеты',restart:'Новая игра',settings:'Настройки',shop:'Магазин',rewards:'Подарки'};

export default function App() {
  const [state, setState] = useState(() => initialState(readNumber('jelly-best'), readNumber('jelly-coins'), (readNumber('jelly-discovered',1) & 2047) | 1));
  const [profile,setProfile]=useState(()=>parseProfile(read('jelly-profile','{}')));
  const profileRef=useRef(profile);
  const [scale, setScale] = useState(1),[loaded, setLoaded] = useState(false),[error, setError] = useState(false),[progress, setProgress] = useState(0),[splashDone, setSplashDone] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const {rendered:dialogKind,leaving:dialogLeaving}=usePresence(modal??(state.status==='playing'?null:state.status));
  const overlay=dialogKind!==null;
  const [muted, setMuted] = useState(read('jelly-muted', 'false') === 'true');
  const [vibration,setVibration]=useState(read('jelly-vibration','true')==='true');
  const [shaking, setShaking] = useState(false),[appearanceBusy,setAppearanceBusy]=useState(false);
  const appearanceLock=useRef(false);
  const [ad,setAd]=useState<{id:number;reward:AdReward}|null>(null),adRef=useRef<typeof ad>(null),adId=useRef(0);
  const [toast,setToast]=useState<string|null>(null),toastTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null),rendererRef = useRef<GameRenderer | null>(null),worldRef = useRef<FruitWorld | null>(null),audioRef = useRef<GameAudio | null>(null),dragRef = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null),dialogRef = useRef<HTMLDivElement>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBest = useRef(state.best),savedCoins = useRef(state.coins),savedDiscovery = useRef(state.discovered);
  const notify=(text:string)=>{setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),2600);};
  const commitProfile=(next:Profile)=>{profileRef.current=next;setProfile(next);save('jelly-profile',JSON.stringify(next));};

  useEffect(() => { if(!loaded)return;const timer=setTimeout(()=>setSplashDone(true),300);return()=>clearTimeout(timer); },[loaded]);
  useEffect(() => {
    const resize = () => {
      const viewport = window.visualViewport,h=viewport?.height??window.innerHeight,w=viewport?.width??window.innerWidth;
      const safe = window.getComputedStyle(shellRef.current ?? document.documentElement);
      const insets = (parseFloat(safe.paddingTop) || 0) + (parseFloat(safe.paddingBottom) || 0);
      setScale(Math.min(w / 420, (h - insets - 12) / 864, 1.12));
    };
    resize(); window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
    const context = (e: Event) => e.preventDefault(); document.addEventListener('contextmenu', context);
    return () => { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); document.removeEventListener('contextmenu', context); };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let alive = true;
    const world = new FruitWorld(lastBest.current,savedCoins.current,savedDiscovery.current), audio = new GameAudio(), renderer = new GameRenderer(canvas, world);
    worldRef.current = world; audioRef.current = audio; rendererRef.current = renderer;
    world.onChange = snapshot => {
      if (!alive) return;
      setState(snapshot);
      if (snapshot.best > lastBest.current) { lastBest.current = snapshot.best; save('jelly-best', String(snapshot.best)); }
      if(snapshot.coins!==savedCoins.current){savedCoins.current=snapshot.coins;save('jelly-coins',String(snapshot.coins));}
      if(snapshot.discovered!==savedDiscovery.current){savedDiscovery.current=snapshot.discovered;save('jelly-discovered',String(snapshot.discovered));}
    };
    world.onMerge = event => { renderer.merge(event); audio.play('merge', event.level); };
    world.emit();
    const appearance=profileRef.current.selected;
    void renderer.start((done,total)=>{if(alive)setProgress(Math.round(done/total*100));},appearance.skins,appearance.boxes,appearance.backgrounds).then(() => { if (alive) setLoaded(true); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; renderer.destroy(); world.destroy(); audio.destroy(); clearTimeout(shakeTimer.current);clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; save('jelly-muted', String(muted)); }, [muted]);
  useEffect(()=>save('jelly-vibration',String(vibration)),[vibration]);
  useEffect(() => { if (rendererRef.current) rendererRef.current.paused = overlay || !loaded; dragRef.current = null; }, [overlay,loaded]);
  useEffect(() => {
    const cancel = () => { dragRef.current = null; };
    document.addEventListener('visibilitychange', cancel); window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('visibilitychange', cancel); window.removeEventListener('blur', cancel); };
  }, []);
  useEffect(() => {
    if (!overlay||ad) return;
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
  }, [dialogKind, overlay, ad]);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => { const bounds = event.currentTarget.getBoundingClientRect();worldRef.current?.setAim((event.clientX - bounds.left) / bounds.width * BOARD.width); };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!loaded || overlay || state.status !== 'playing' || dragRef.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); audioRef.current?.unlock();dragRef.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); aim(event);
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current !== event.pointerId) return;
    aim(event); dragRef.current = null;
    if (!overlay && worldRef.current?.drop()) { audioRef.current?.play('drop'); if (vibration&&'vibrate' in navigator) navigator.vibrate(8); }
  };
  const restart = () => { worldRef.current?.reset(); setModal(null); };
  const shake = () => {
    audioRef.current?.unlock();if (!worldRef.current?.shake()) return;
    audioRef.current?.play('shake'); setShaking(true);clearTimeout(shakeTimer.current); shakeTimer.current = setTimeout(() => setShaking(false), 500);
    if (vibration&&'vibrate' in navigator) navigator.vibrate([12, 20, 12]);
  };
  const fullscreen = () => { if (!document.fullscreenElement) void shellRef.current?.requestFullscreen?.().catch(() => {}); else void document.exitFullscreen().catch(() => {}); };
  const buy=(item:ShopItem)=>{
    const world=worldRef.current;if(!world)return;
    const result=purchase(profileRef.current,item,world.state.coins);
    if(!result.purchased||!world.spendCoins(item.price))return;
    commitProfile(result.profile);notify(`${item.name} теперь в коллекции!`);
  };
  const apply=async(item:ShopItem)=>{
    if(appearanceLock.current||!profileRef.current.owned.includes(item.key))return;
    appearanceLock.current=true;setAppearanceBusy(true);
    const next=selectItem(profileRef.current,item),selected=next.selected;
    try {
      if(await rendererRef.current?.setAppearance(selected.skins,selected.boxes,selected.backgrounds)){
        commitProfile(selectItem(profileRef.current,item));notify('Новый образ готов!');
      }
    } catch {notify('Не удалось загрузить оформление. Попробуй ещё раз.');}
    finally {appearanceLock.current=false;setAppearanceBusy(false);}
  };
  const watch=(reward:AdReward)=>{if(adRef.current)return;const request={id:++adId.current,reward};adRef.current=request;setAd(request);};
  const cancelAd=()=>{adRef.current=null;setAd(null);};
  const completeAd=(id:number)=>{
    const request=adRef.current,world=worldRef.current;if(!request||request.id!==id||!world)return;
    cancelAd();const reward=request.reward;
    if(reward.type==='coins'){world.grantCoins(75);notify('+75 монет в копилку!');}
    else if(reward.type==='shake'){world.grantShake();notify('+1 встряска готова!');}
    else if(reward.type==='revive'){if(world.revive()){setModal(null);notify('Верхние кубики убраны. Продолжаем!');}}
    else if(reward.type==='double'){if(world.doubleEarnings())notify('Монеты за игру удвоены!');}
    else {const item=itemByKey(reward.key);if(!item)return;const result=rewardUnlock(profileRef.current,item);commitProfile(result.profile);notify(result.unlocked?`${item.name} открыт!`:`Ещё ${item.videos-(result.profile.videos[item.key]??0)} видео до открытия`);}
  };
  const daily=()=>{if(profileRef.current.daily===today())return;commitProfile({...profileRef.current,daily:today()});worldRef.current?.grantCoins(25);notify('Ежедневный подарок: +25 монет!');};
  const skin=profile.selected.skins;
  const dialog=overlay&&<div className={`overlay ${dialogKind==='shop'?'shop-fullscreen':''} ${dialogLeaving?'is-leaving':''}`} onPointerDown={e=>e.stopPropagation()}>
        <div className={`dialog ${dialogKind==='shop'?'shop-dialog':''}`} role="dialog" aria-modal="true" aria-label={dialogKind?dialogLabels[dialogKind]:''} tabIndex={-1} ref={dialogRef}>
          <div className="dialog-content" inert={!!ad}>
            {dialogKind!=='gameover'&&dialogKind!=='won'&&<button className="dialog-close" aria-label="Закрыть" onClick={()=>setModal(null)}><Icon name="close" size={21}/></button>}
            {dialogKind==='shop'?<Shop profile={profile} coins={state.coins} busy={appearanceBusy} onBuy={buy} onSelect={item=>void apply(item)} onVideo={item=>watch({type:'unlock',key:item.key})} onCoins={()=>watch({type:'coins'})} onClose={()=>setModal(null)}/>:dialogKind==='settings'?<>
              <Icon name="settings" size={65}/><span className="eyebrow">УСТРОИМ ВСЁ ПО-ТВОЕМУ</span><h1>Настройки</h1>
              <div className="settings-list">
                <button className="setting-row" role="switch" aria-checked={!muted} onClick={()=>{audioRef.current?.unlock();setMuted(!muted);}}><Icon name={muted?'mute':'sound'} size={27}/><span>Звук</span><i className={!muted?'on':''}/></button>
                <button className="setting-row" role="switch" aria-checked={vibration} onClick={()=>setVibration(!vibration)}><Icon name="vibrate" size={27}/><span>Вибрация</span><i className={vibration?'on':''}/></button>
                <button className="setting-row" onClick={fullscreen}><Icon name="fullscreen" size={27}/><span>На весь экран</span><Icon name="right" size={17}/></button>
                <button className="setting-row" onClick={()=>setModal('restart')}><Icon name="restart" size={27}/><span>Начать заново</span><Icon name="right" size={17}/></button>
              </div><button className="primary-button" onClick={()=>setModal(null)}><Icon name="play" size={19}/> Вернуться в игру</button>
            </>:dialogKind==='rewards'?<>
              <Icon name="gift" size={78}/><span className="eyebrow">ПРИЯТНОСТИ ДЛЯ УРОЖАЯ</span><h1>Забирай подарки</h1><p>Больше образов, больше сочных слияний.</p>
              <button className="reward-button daily-button" disabled={profile.daily===today()} onClick={daily}><Icon name="gift" size={31}/><span>{profile.daily===today()?'До завтра!':'Ежедневный подарок'}<small>{profile.daily===today()?'Подарок уже в копилке':'+25 монет бесплатно'}</small></span><Icon name={profile.daily===today()?'check':'right'} size={22}/></button>
              <button className="reward-button" onClick={()=>watch({type:'coins'})}><Icon name="video" size={31}/><span>Пополнить копилку<small>+75 монет за видео</small></span><Icon name="double" size={28}/></button>
              <button className="reward-button" onClick={()=>watch({type:'shake'})}><Icon name="video" size={31}/><span>Добавить встряску<small>+1 встряска за видео</small></span><Icon name="shake" size={28}/></button>
              <button className="primary-button" onClick={()=>setModal('shop')}><Icon name="shop" size={22}/> Выбрать новый образ</button>
            </>:dialogKind==='gameover'||dialogKind==='won'?<>
              <img className="dialog-mascot" src={fruitAsset(dialogKind==='won'?10:6,skin)} alt=""/><span className="eyebrow">{dialogKind==='won'?'2048! ВСЯ СЕМЬЯ В СБОРЕ!':'КОНТЕЙНЕР ПОЛОН'}</span><h1>{dialogKind==='won'?'Сочный финал!':'Хороший урожай!'}</h1>
              <div className="result-score">{format(state.score)}<span>очков за эту игру</span></div><div className="round-earnings"><img src={asset('particles/11.webp')} alt=""/>+{state.earned+state.bonusCoins} монет{state.doubled&&<Icon name="check" size={18}/>}</div>
              {dialogKind==='gameover'&&state.revives===0&&<button className="reward-button" onClick={()=>watch({type:'revive'})}><Icon name="video" size={27}/><span>Спасти урожай<small>Убрать верхние кубики · 1 раз за игру</small></span><Icon name="rescue" size={27}/></button>}
              {state.earned>0&&!state.doubled&&<button className="reward-button" onClick={()=>watch({type:'double'})}><Icon name="video" size={27}/><span>Монеты за игру ×2<small>Ещё +{state.earned} монет</small></span><Icon name="double" size={27}/></button>}
              <button className="primary-button" onClick={dialogKind==='won'?()=>worldRef.current?.continue():restart}><Icon name={dialogKind==='won'?'play':'restart'} size={19}/>{dialogKind==='won'?'Продолжить играть':'Ещё разок'}</button>
              {dialogKind==='won'&&<button className="text-button" onClick={restart}>Начать заново</button>}
            </>:dialogKind==='wallet'?<>
              <img className="dialog-mascot coin-mascot" src={asset('particles/11.webp')} alt=""/><span className="eyebrow">ТВОЯ КОПИЛКА</span><h1>{format(state.coins)} монет</h1><p>Получай монеты за слияния и выбирай новые образы в магазине.</p><p className="help-note">Три встряски на игру бесплатно. Потом — по {SHAKE_PRICE} монет. Покупки и монеты сохраняются.</p>
              <button className="reward-button" onClick={()=>watch({type:'coins'})}><Icon name="video" size={27}/><span>+75 монет<small>За короткое видео</small></span><Icon name="double" size={27}/></button><button className="primary-button" onClick={()=>setModal('shop')}><Icon name="shop" size={21}/> В магазин</button><button className="text-button" onClick={()=>setModal(null)}>За сочным урожаем!</button>
            </>:dialogKind==='help'?<>
              <img className="dialog-mascot" src={fruitAsset(1,skin)} alt=""/><span className="eyebrow">ПРОЩЕ ПРОСТОГО</span><h1>Устрой переполох</h1><div className="help-steps"><p><b>1</b><span><strong>Прицелься и отпусти</strong>Веди пальцем над контейнером.</span></p><p><b>2</b><span><strong>Соединяй одинаковые</strong>Два одинаковых кубика — один побольше.</span></p><p><b>3</b><span><strong>Собери всю семью</strong>Переполнение выше линии ведёт к проигрышу.</span></p></div><p className="help-note">Три встряски бесплатно. Если кубики остаются выше линии, красная полоска заполняется — освободи место!</p><button className="primary-button" onClick={()=>setModal(null)}>Понятно, играем!</button>
            </>:dialogKind==='restart'?<>
              <img className="dialog-mascot" src={fruitAsset(0,skin)} alt=""/><h1>Новый урожай?</h1><p>Начнём с пустого счёта и трёх встрясок. Рекорд, монеты и коллекция сохранятся.</p><button className="primary-button" onClick={restart}><Icon name="restart" size={20}/>Начать заново</button><button className="text-button" onClick={()=>setModal(null)}>Продолжить эту игру</button>
            </>:null}
          </div>
          {ad&&<RewardedAd key={ad.id} reward={ad.reward} onComplete={()=>completeAd(ad.id)} onCancel={cancelAd}/>}
        </div>
      </div>;

  return <main className="game-screen" ref={shellRef} aria-busy={!loaded} style={{...UI_TEXTURES,'--scenery':`url("${new URL(backgroundAsset(profile.selected.backgrounds),document.baseURI).href}")`} as CSSProperties}>
    <div className="ambient-background" aria-hidden="true" />
    <div className={`scene ${loaded ? 'is-ready' : ''}`} inert={!loaded||overlay} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
      <header className="header">
        <div className="brand"><span className="brand-leaf"><Icon name="leaf" size={25} /></span><div className="brand-text">jelly<span>fruit<span className="brand-dot">.</span></span></div></div>
        <button className="wallet" aria-label="Баланс монет" onClick={()=>setModal('wallet')}><img src={asset('particles/11.webp')} alt="" /><strong key={state.coins} data-testid="coins">{format(state.coins)}</strong></button>
        <div className="header-buttons"><button className="round-button sound-button" aria-label={muted?'Включить звук':'Выключить звук'} onClick={()=>{audioRef.current?.unlock();setMuted(!muted);}}><Icon name={muted?'mute':'sound'} size={26}/></button><button className="round-button" aria-label="Настройки" onClick={()=>setModal('settings')}><Icon name="settings" size={23}/></button></div>
      </header>
      <section className="scoreboard" aria-label="Результат">
        <img className="score-sign-art" src={asset('wood-sign.webp')} alt="" draggable={false}/>
        <div className="score-card"><span className="small-label">ТВОЙ СЧЁТ</span><strong key={state.score} data-testid="score">{format(state.score)}</strong></div>
        <div className="best-card"><span className="small-label"><Icon name="trophy" size={13}/> РЕКОРД</span><strong key={state.best}>{format(state.best)}</strong></div>
      </section>
      <div className={`playfield ${shaking?'shaking':''} ${state.danger?'danger':''}`}>
        <button className="shop-launch" aria-label="Магазин" onClick={()=>setModal('shop')}><Icon name="shop" size={35}/><span>Магазин<small>Образы и фоны</small></span></button>
        <div className="next-fruit"><span>ДАЛЬШЕ</span><img key={`${skin}-${state.drops}`} src={fruitAsset(state.next,skin)} alt="Следующий кубик" draggable={false}/></div>
        <canvas ref={canvasRef} aria-label="Игровой контейнер. Веди пальцем и отпусти, чтобы бросить фрукт." tabIndex={0}
          onPointerDown={pointerDown} onPointerMove={e=>{if(dragRef.current===e.pointerId||e.pointerType==='mouse')aim(e);}} onPointerUp={pointerUp} onPointerCancel={()=>{dragRef.current=null;}} onLostPointerCapture={()=>{dragRef.current=null;}}
          onKeyDown={e=>{if(overlay||state.status!=='playing'||!loaded)return;const world=worldRef.current;if(!world)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();world.setAim(world.aim+(e.key==='ArrowLeft'?-15:15));}if(e.key===' '||e.key==='Enter'){e.preventDefault();audioRef.current?.unlock();if(world.drop())audioRef.current?.play('drop');}}}/>
        {state.danger>0&&<div className="danger-message">Контейнер почти полон! {state.status==='playing'?'Освободи место':''}</div>}
      </div>
      <div className="hint"><Icon name="hand" size={15}/> Веди пальцем и отпускай</div>
      <FruitCarousel discovered={state.discovered} skin={skin}/>
      <footer className="controls">
        <button className="utility-button" onClick={()=>setModal('help')} aria-label="Как играть"><Icon name="help" size={24}/><span>Как играть</span></button>
        <button className="shake-button" onClick={shake} disabled={(!state.shakes&&state.coins<SHAKE_PRICE)||!loaded||state.status!=='playing'}><Icon name="shake" size={28}/><span>Встряхнуть</span><b>{state.shakes>0?state.shakes:<><img src={asset('particles/11.webp')} alt="монет"/>{SHAKE_PRICE}</>}</b></button>
        <button className="utility-button" onClick={()=>setModal('rewards')} aria-label="Подарки"><Icon name="gift" size={24}/><span>Подарки</span></button>
      </footer>
    </div>
    {shellRef.current&&createPortal(dialog,shellRef.current)}
    {toast&&<div className="toast" role="status"><Icon name="check" size={19}/>{toast}</div>}
    {!splashDone&&<section className={`loading loading-screen ${loaded?'finished':''}`} aria-label="Загрузка игры"><div className="loading-content"><div className="loading-logo">jelly <span>fruit.</span></div><div className="loading-mascots"><img className="loading-side left" src={fruitAsset(1)} alt=""/><img className="loading-hero" src={fruitAsset(0)} alt=""/><img className="loading-side right" src={fruitAsset(2)} alt=""/><span className="loading-spark s1">✦</span><span className="loading-spark s2">✦</span></div><h1>{error?'Фрукты задержались':'Скоро будет сочно!'}</h1><p>{error?'Не удалось загрузить ассеты. Попробуй ещё раз.':'Собираем маленькую фруктовую семью'}</p>{!error?<><div className="loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}}/></div><span className="loading-percent">{progress}%</span></>:<button className="primary-button" onClick={()=>window.location.reload()}>Попробовать ещё</button>}</div><span className="loading-caption">НЕМНОГО ЖЕЛЕЙНОГО ВОЛШЕБСТВА</span></section>}
    <div className="desktop-note"><Icon name="left" size={14}/><span>Наведи мышку и нажми, чтобы бросить</span><Icon name="right" size={14}/></div>
  </main>;
}
