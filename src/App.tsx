import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { asset, FRUITS, fruitAsset } from './game/fruits';
import { BOARD, FruitWorld, initialState, SHAKE_PRICE } from './game/physics';
import { GameRenderer } from './game/renderer';
import { GameAudio } from './game/audio';

type IconName = 'sound' | 'mute' | 'pause' | 'restart' | 'help' | 'shake' | 'hand' | 'leaf' | 'trophy' | 'play' | 'close' | 'fullscreen' | 'right' | 'left' | 'sparkle';
const Icon = ({name, size = 22}: {name: IconName; size?: number}) => <img className="ui-icon" src={asset(`ui/icon-${name}.webp`)} alt="" aria-hidden="true" draggable={false} style={{width:size,height:size}} />;

const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional in embedded web games. */ } };
type Modal = 'help' | 'pause' | 'wallet' | 'restart' | null;
const readNumber = (key: string, fallback = 0) => Math.max(0, Math.floor(Number(read(key, String(fallback))) || 0));
const format = (n: number) => n.toLocaleString('ru-RU');

export default function App() {
  const [state, setState] = useState(() => initialState(readNumber('jelly-best'), readNumber('jelly-coins'), (readNumber('jelly-discovered',1) & 2047) | 1));
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const [nav, setNav] = useState({left:false,right:true});
  const [modal, setModal] = useState<Modal>(null);
  const [muted, setMuted] = useState(read('jelly-muted', 'false') === 'true');
  const [shaking, setShaking] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const previousDiscovery = useRef(state.discovered);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const worldRef = useRef<FruitWorld | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const dragRef = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBest = useRef(state.best);
  const savedCoins = useRef(state.coins);
  const savedDiscovery = useRef(state.discovered);

  const refreshNav = () => { const el=scrollerRef.current;if(el)setNav({left:el.scrollLeft>2,right:el.scrollLeft+el.clientWidth<el.scrollWidth-2}); };
  const scrollFruit = (direction: number) => scrollerRef.current?.scrollBy({left:direction*180,behavior:'smooth'});

  useEffect(() => { if(!loaded)return;const timer=setTimeout(()=>setSplashDone(true),180);return()=>clearTimeout(timer); },[loaded]);
  useEffect(() => { const frame=requestAnimationFrame(refreshNav);return()=>cancelAnimationFrame(frame); },[scale,loaded]);
  useEffect(() => {
    const newly=state.discovered&~previousDiscovery.current;previousDiscovery.current=state.discovered;
    if(newly){const level=Math.floor(Math.log2(newly));scrollerRef.current?.scrollTo({left:Math.max(0,level*90-90),behavior:'smooth'});}
  },[state.discovered]);

  useEffect(() => {
    const resize = () => {
      const viewport = window.visualViewport;
      const h = viewport?.height ?? window.innerHeight, w = viewport?.width ?? window.innerWidth;
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
    void renderer.start((done,total)=>{if(alive)setProgress(Math.round(done/total*100));}).then(() => { if (alive) setLoaded(true); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; renderer.destroy(); world.destroy(); audio.destroy(); clearTimeout(shakeTimer.current); };
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; save('jelly-muted', String(muted)); }, [muted]);
  useEffect(() => { if (rendererRef.current) rendererRef.current.paused = !!modal || !loaded; dragRef.current = null; }, [modal,loaded]);
  useEffect(() => {
    const cancel = () => { dragRef.current = null; };
    document.addEventListener('visibilitychange', cancel); window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('visibilitychange', cancel); window.removeEventListener('blur', cancel); };
  }, []);
  useEffect(() => {
    if (!modal && state.status === 'playing') return;
    dialogRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.status === 'playing') setModal(null);
      if (e.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        if (e.shiftKey && (document.activeElement === buttons[0] || document.activeElement === dialogRef.current)) { e.preventDefault(); buttons[buttons.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) { e.preventDefault(); buttons[0].focus(); }
      }
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [modal, state.status]);

  const aim = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    worldRef.current?.setAim((event.clientX - bounds.left) / bounds.width * BOARD.width);
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!loaded || modal || state.status !== 'playing' || dragRef.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); audioRef.current?.unlock();
    dragRef.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); aim(event);
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current !== event.pointerId) return;
    aim(event); dragRef.current = null;
    if (!modal && worldRef.current?.drop()) { audioRef.current?.play('drop'); if ('vibrate' in navigator) navigator.vibrate(8); }
  };
  const restart = () => { worldRef.current?.reset(); setModal(null); };
  const shake = () => {
    audioRef.current?.unlock();
    if (!worldRef.current?.shake()) return;
    audioRef.current?.play('shake'); setShaking(true);
    clearTimeout(shakeTimer.current); shakeTimer.current = setTimeout(() => setShaking(false), 500);
    if ('vibrate' in navigator) navigator.vibrate([12, 20, 12]);
  };
  const fullscreen = () => { if (!document.fullscreenElement) void shellRef.current?.requestFullscreen?.().catch(() => {}); else void document.exitFullscreen().catch(() => {}); };
  const overlay = !!modal || state.status !== 'playing';
  const discoveredCount = FRUITS.filter((_, level) => state.discovered & (1 << level)).length;

  return <main className="game-screen" ref={shellRef} aria-busy={!loaded}>
    <div className={`scene ${loaded ? 'is-ready' : ''}`} inert={!loaded} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
      <header className="header">
        <div className="brand"><span className="brand-leaf"><Icon name="leaf" size={25} /></span><div className="brand-text">jelly<span>fruit<span className="brand-dot">.</span></span></div></div>
        <button className="wallet" aria-label="Баланс монет" onClick={()=>setModal('wallet')}><img src={asset('particles/11.webp')} alt="" /><strong key={state.coins} data-testid="coins">{format(state.coins)}</strong></button>
        <div className="header-buttons">
          <button className="round-button" aria-label={muted ? 'Включить звук' : 'Выключить звук'} onClick={() => { audioRef.current?.unlock(); setMuted(!muted); }}>{muted ? <Icon name="mute" size={21} /> : <Icon name="sound" size={21} />}</button>
          <button className="round-button" aria-label="Пауза" onClick={() => setModal('pause')}><Icon name="pause" size={21} /></button>
        </div>
      </header>

      <section className="scoreboard" aria-label="Результат">
        <img className="score-sign-art" src={asset('wood-sign.webp')} alt="" draggable={false} />
        <div className="score-card"><span className="small-label">ТВОЙ СЧЁТ</span><strong data-testid="score">{format(state.score)}</strong></div>
        <div className="best-card"><span className="small-label"><Icon name="trophy" size={13} /> РЕКОРД</span><strong>{format(state.best)}</strong></div>
      </section>

      <div className={`playfield ${shaking ? 'shaking' : ''} ${state.danger ? 'danger' : ''}`}>
        <div className="drop-label"><span className="tiny-dot" /> СЛИВАЙ И РАСТИ</div>
        <div className="next-fruit"><span>ДАЛЬШЕ</span><img src={fruitAsset(state.next)} alt={`${FRUITS[state.next].name}, ${FRUITS[state.next].value}`} draggable={false} /></div>
        <canvas ref={canvasRef} aria-label="Игровой контейнер. Веди пальцем и отпусти, чтобы бросить фрукт." tabIndex={0}
          onPointerDown={pointerDown} onPointerMove={e => { if (dragRef.current === e.pointerId || e.pointerType === 'mouse') aim(e); }} onPointerUp={pointerUp}
          onPointerCancel={() => { dragRef.current = null; }} onLostPointerCapture={() => { dragRef.current = null; }}
          onKeyDown={e => { if (modal || state.status !== 'playing' || !loaded) return; const world = worldRef.current; if (!world) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); world.setAim(world.aim + (e.key === 'ArrowLeft' ? -15 : 15)); } if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); audioRef.current?.unlock(); if (world.drop()) audioRef.current?.play('drop'); } }}
        />
        {state.danger > 0 && <div className="danger-message">Осторожно, почти доверху!</div>}

      </div>

      <div className="hint"><Icon name="hand" size={15} /> Веди пальцем и отпускай</div>
      <section className="evolution" aria-label="Фруктовая семья">
        <div className="evolution-title"><span>ФРУКТОВАЯ СЕМЬЯ</span><span>{discoveredCount < 11 ? `${discoveredCount} / 11` : 'ВСЕ СОБРАНЫ'} · ЦЕЛЬ <b>2048</b></span></div>
        <button className="carousel-arrow prev" aria-label="Предыдущие фрукты" onClick={()=>scrollFruit(-1)} disabled={!nav.left}><Icon name="left" size={18} /></button>
        <div className="fruit-scroller" ref={scrollerRef} onScroll={refreshNav}>
          <div className="fruit-chain">{FRUITS.map((fruit,level)=>{
            const known=!!(state.discovered&(1<<level));
            return <div className="chain-unit" key={fruit.value}><div className={`chain-fruit ${known?'discovered':'locked'}`} data-level={level} data-discovered={known?'true':'false'} aria-label={known?fruit.name:'Неоткрытый фрукт'}><img src={fruitAsset(level)} alt="" draggable={false} /><span>{known?fruit.name:'???'}</span></div>{level<10&&<span className="chain-arrow">→</span>}</div>;
          })}</div>
        </div>
        <button className="carousel-arrow next" aria-label="Следующие фрукты" onClick={()=>scrollFruit(1)} disabled={!nav.right}><Icon name="right" size={18} /></button>
      </section>

      <footer className="controls">
        <button className="utility-button" onClick={() => setModal('help')} aria-label="Как играть"><Icon name="help" size={24} /><span>Как играть</span></button>
        <button className="shake-button" onClick={shake} disabled={(!state.shakes && state.coins < SHAKE_PRICE) || !loaded || state.status !== 'playing'}><Icon name="shake" size={28} /><span>Встряхнуть</span><b>{state.shakes>0?state.shakes:<><img src={asset('particles/11.webp')} alt="монет" />{SHAKE_PRICE}</>}</b></button>
        <button className="utility-button" onClick={() => setModal('restart')} aria-label="Начать заново"><Icon name="restart" size={23} /><span>Заново</span></button>
      </footer>
      <div className="footer-caption"><span /> НЕМНОГО ЖЕЛЕЙНОГО ВОЛШЕБСТВА <span /></div>

      {overlay && <div className="overlay" onPointerDown={e => e.stopPropagation()}>
        <div className="dialog" role="dialog" aria-modal="true" aria-label={state.status === 'gameover' ? 'Игра окончена' : state.status === 'won' ? 'Победа' : modal === 'help' ? 'Как играть' : modal === 'wallet' ? 'Монеты' : modal === 'restart' ? 'Новая игра' : 'Пауза'} tabIndex={-1} ref={dialogRef}>
          {state.status === 'playing' && <button className="dialog-close" aria-label="Закрыть" onClick={() => setModal(null)}><Icon name="close" size={21} /></button>}
          {state.status === 'gameover' ? <>
            <img className="dialog-mascot" src={fruitAsset(6)} alt="" /><span className="eyebrow">КОНТЕЙНЕР ПОЛОН</span><h1>Хороший урожай!</h1><p>Ещё один бросок — и новый рекорд.</p><div className="result-score">{format(state.score)}<span>очков за эту игру</span></div><button className="primary-button" onClick={restart}><Icon name="restart" size={19} /> Ещё разок</button>
          </> : state.status === 'won' ? <>
            <img className="dialog-mascot" src={fruitAsset(10)} alt="" /><span className="eyebrow">2048! ВОТ ЭТО АРБУЗ!</span><h1>Сочный финал!</h1><p>Ты собрал всю фруктовую семью.</p><button className="primary-button" onClick={() => worldRef.current?.continue()}>Продолжить играть</button><button className="text-button" onClick={restart}>Начать заново</button>
          </> : modal === 'wallet' ? <>
            <img className="dialog-mascot coin-mascot" src={asset('particles/11.webp')} alt="" /><span className="eyebrow">ТВОЯ КОПИЛКА</span><h1>{format(state.coins)} монет</h1><p>Сливай фрукты — за каждое слияние получаешь монеты. Чем крупнее фрукт, тем больше награда.</p><p className="help-note">Три встряски на игру бесплатно. Потом дополнительная встряска стоит {SHAKE_PRICE} монет. Монеты сохраняются между играми.</p><button className="primary-button" onClick={()=>setModal(null)}>За сочным урожаем!</button>
          </> : modal === 'help' ? <>
            <img className="dialog-mascot" src={fruitAsset(1)} alt="" /><span className="eyebrow">ПРОЩЕ ПРОСТОГО</span><h1>Устрой переполох</h1><div className="help-steps"><p><b>1</b><span><strong>Прицелься и отпусти</strong>Веди пальцем над контейнером.</span></p><p><b>2</b><span><strong>Соединяй одинаковые</strong>Два одинаковых фрукта — один побольше.</span></p><p><b>3</b><span><strong>Дойди до арбуза 2048</strong>Не заполняй контейнер выше линии.</span></p></div><p className="help-note">Три встряски бесплатно. Потом — по 25 монет, которые ты получаешь за слияния.</p><button className="primary-button" onClick={() => setModal(null)}>Понятно, играем!</button>
          </> : modal === 'restart' ? <>
            <img className="dialog-mascot" src={fruitAsset(0)} alt="" /><h1>Новый урожай?</h1><p>Начнём с пустого счёта и трёх встрясок. Рекорд, монеты и открытые фрукты сохранятся.</p><button className="primary-button" onClick={restart}>Начать заново</button><button className="text-button" onClick={() => setModal(null)}>Продолжить эту игру</button>
          </> : <>
            <img className="dialog-mascot" src={fruitAsset(3)} alt="" /><span className="eyebrow">ФРУКТЫ ОТДЫХАЮТ</span><h1>Маленькая пауза</h1><p>Твой урожай подождёт.</p><button className="primary-button" onClick={() => setModal(null)}><Icon name="play" size={18} /> Продолжить</button><button className="text-button" onClick={fullscreen}><Icon name="fullscreen" size={17} /> На весь экран</button>
          </>}
        </div>
      </div>}
    </div>
    {!splashDone&&<section className={`loading loading-screen ${loaded?'finished':''}`} aria-label="Загрузка игры">
      <div className="loading-content"><div className="loading-logo">jelly <span>fruit.</span></div>
        <div className="loading-mascots"><img className="loading-side left" src={fruitAsset(1)} alt="" /><img className="loading-hero" src={fruitAsset(0)} alt="" /><img className="loading-side right" src={fruitAsset(2)} alt="" /><span className="loading-spark s1">✦</span><span className="loading-spark s2">✦</span></div>
        <h1>{error?'Фрукты задержались':'Скоро будет сочно!'}</h1><p>{error?'Не удалось загрузить ассеты. Попробуй ещё раз.':'Собираем маленькую фруктовую семью'}</p>
        {!error?<><div className="loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{width:`${progress}%`}} /></div><span className="loading-percent">{progress}%</span></>:<button className="primary-button" onClick={()=>window.location.reload()}>Попробовать ещё</button>}
      </div><span className="loading-caption">НЕМНОГО ЖЕЛЕЙНОГО ВОЛШЕБСТВА</span>
    </section>}
    <div className="desktop-note"><Icon name="left" size={14} /><span>Наведи мышку и нажми, чтобы бросить</span><Icon name="right" size={14} /></div>
  </main>;
}
