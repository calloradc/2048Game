import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, Hand, Leaf, Maximize, Pause, Play, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import { FRUITS, fruitAsset } from './game/fruits';
import { BOARD, FruitWorld, initialState } from './game/physics';
import { GameRenderer } from './game/renderer';
import { GameAudio } from './game/audio';

const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional in embedded web games. */ } };
type Modal = 'help' | 'pause' | 'collection' | 'restart' | null;
const format = (n: number) => n.toLocaleString('ru-RU');

export default function App() {
  const [state, setState] = useState(() => initialState(Number(read('jelly-best', '0')) || 0));
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [muted, setMuted] = useState(read('jelly-muted', 'false') === 'true');
  const [shaking, setShaking] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const worldRef = useRef<FruitWorld | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const dragRef = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBest = useRef(state.best);

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
    const world = new FruitWorld(lastBest.current), audio = new GameAudio(), renderer = new GameRenderer(canvas, world);
    worldRef.current = world; audioRef.current = audio; rendererRef.current = renderer;
    world.onChange = snapshot => {
      if (!alive) return;
      setState(snapshot);
      if (snapshot.best > lastBest.current) { lastBest.current = snapshot.best; save('jelly-best', String(snapshot.best)); }
    };
    world.onMerge = event => { renderer.merge(event); audio.play('merge', event.level); };
    world.emit();
    void renderer.start().then(() => { if (alive) setLoaded(true); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; renderer.destroy(); world.destroy(); audio.destroy(); clearTimeout(shakeTimer.current); };
  }, []);

  useEffect(() => { if (audioRef.current) audioRef.current.muted = muted; save('jelly-muted', String(muted)); }, [muted]);
  useEffect(() => { if (rendererRef.current) rendererRef.current.paused = !!modal; dragRef.current = null; }, [modal]);
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

  return <main className="game-screen" ref={shellRef}>
    <div className="scene" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
      <header className="header">
        <div className="brand"><span className="brand-leaf"><Leaf size={25} strokeWidth={3} /></span><div className="brand-text">jelly<span>fruit<span className="brand-dot">.</span></span></div></div>
        <div className="header-buttons">
          <button className="round-button" aria-label={muted ? 'Включить звук' : 'Выключить звук'} onClick={() => { audioRef.current?.unlock(); setMuted(!muted); }}>{muted ? <VolumeX size={21} /> : <Volume2 size={21} />}</button>
          <button className="round-button" aria-label="Пауза" onClick={() => setModal('pause')}><Pause size={21} fill="currentColor" /></button>
        </div>
      </header>

      <section className="scoreboard" aria-label="Результат">
        <div className="score-card"><span className="small-label">ТВОЙ СЧЁТ</span><strong data-testid="score">{format(state.score)}</strong><span className="score-spark"><Sparkles size={27} /></span></div>
        <div className="best-card"><span className="small-label"><Trophy size={13} fill="currentColor" /> РЕКОРД</span><strong>{format(state.best)}</strong></div>
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
        {!loaded && <div className="loading">{error ? <><span>Не получилось загрузить фрукты</span><button className="primary-button" onClick={() => window.location.reload()}>Попробовать ещё</button></> : <><img src={fruitAsset(0)} alt="" /><span>Созреваем…</span></>}</div>}
      </div>

      <div className="hint"><Hand size={15} /> Веди пальцем и отпускай</div>
      <button className="evolution" onClick={() => setModal('collection')} aria-label="Посмотреть все 11 фруктов">
        <div className="evolution-title"><span>ОТ ВИШНИ ДО АРБУЗА</span><span>ЦЕЛЬ <b>2048</b> <ArrowRight size={12} /></span></div>
        <div className="fruit-chain">{FRUITS.map((fruit, level) => <div className={`chain-fruit ${level <= state.highest ? 'discovered' : ''}`} key={fruit.value}><img src={fruitAsset(level)} alt={fruit.name} draggable={false} />{level === state.highest && <span className="chain-marker" />}</div>)}</div>
      </button>

      <footer className="controls">
        <button className="utility-button" onClick={() => setModal('help')} aria-label="Как играть"><CircleHelp size={24} /><span>Как играть</span></button>
        <button className="shake-button" onClick={shake} disabled={!state.shakes || !loaded || state.status !== 'playing'}><span className="shake-icon">↔</span><span>Встряхнуть</span><b>{state.shakes}</b></button>
        <button className="utility-button" onClick={() => setModal('restart')} aria-label="Начать заново"><RotateCcw size={23} /><span>Заново</span></button>
      </footer>
      <div className="footer-caption"><span /> НЕМНОГО ЖЕЛЕЙНОГО ВОЛШЕБСТВА <span /></div>

      {overlay && <div className="overlay" onPointerDown={e => e.stopPropagation()}>
        <div className={`dialog ${modal === 'collection' ? 'collection-dialog' : ''}`} role="dialog" aria-modal="true" aria-label={state.status === 'gameover' ? 'Игра окончена' : state.status === 'won' ? 'Победа' : modal === 'help' ? 'Как играть' : modal === 'collection' ? 'Все фрукты' : modal === 'restart' ? 'Новая игра' : 'Пауза'} tabIndex={-1} ref={dialogRef}>
          {state.status === 'playing' && <button className="dialog-close" aria-label="Закрыть" onClick={() => setModal(null)}><X size={21} /></button>}
          {state.status === 'gameover' ? <>
            <img className="dialog-mascot" src={fruitAsset(6)} alt="" /><span className="eyebrow">КОНТЕЙНЕР ПОЛОН</span><h1>Хороший урожай!</h1><p>Ещё один бросок — и новый рекорд.</p><div className="result-score">{format(state.score)}<span>очков за эту игру</span></div><button className="primary-button" onClick={restart}><RotateCcw size={19} /> Ещё разок</button>
          </> : state.status === 'won' ? <>
            <img className="dialog-mascot" src={fruitAsset(10)} alt="" /><span className="eyebrow">2048! ВОТ ЭТО АРБУЗ!</span><h1>Сочный финал!</h1><p>Ты собрал всю фруктовую семью.</p><button className="primary-button" onClick={() => worldRef.current?.continue()}>Продолжить играть</button><button className="text-button" onClick={restart}>Начать заново</button>
          </> : modal === 'collection' ? <>
            <span className="eyebrow">11 МАЛЕНЬКИХ ДРУЗЕЙ</span><h1>Фруктовая семья</h1><p>Два одинаковых — один побольше!</p><div className="collection-grid">{FRUITS.map((fruit, i) => <div key={fruit.value}><img src={fruitAsset(i)} alt="" draggable={false} /><b>{fruit.value}</b><span>{fruit.name}</span></div>)}</div><button className="primary-button" onClick={() => setModal(null)}>За арбузом!</button>
          </> : modal === 'help' ? <>
            <img className="dialog-mascot" src={fruitAsset(1)} alt="" /><span className="eyebrow">ПРОЩЕ ПРОСТОГО</span><h1>Устрой переполох</h1><div className="help-steps"><p><b>1</b><span><strong>Прицелься и отпусти</strong>Веди пальцем над контейнером.</span></p><p><b>2</b><span><strong>Соединяй одинаковые</strong>Кубики касаются и растут: 2 → 4 → 8.</span></p><p><b>3</b><span><strong>Дойди до арбуза 2048</strong>Не заполняй контейнер выше линии.</span></p></div><p className="help-note">Застряли? Три встряски на игру помогут кубикам найти друг друга.</p><button className="primary-button" onClick={() => setModal(null)}>Понятно, играем!</button>
          </> : modal === 'restart' ? <>
            <img className="dialog-mascot" src={fruitAsset(0)} alt="" /><h1>Новый урожай?</h1><p>Начнём с пустого счёта и трёх встрясок. Твой рекорд сохранится.</p><button className="primary-button" onClick={restart}>Начать заново</button><button className="text-button" onClick={() => setModal(null)}>Продолжить эту игру</button>
          </> : <>
            <img className="dialog-mascot" src={fruitAsset(3)} alt="" /><span className="eyebrow">ФРУКТЫ ОТДЫХАЮТ</span><h1>Маленькая пауза</h1><p>Твой урожай подождёт.</p><button className="primary-button" onClick={() => setModal(null)}><Play size={18} fill="currentColor" /> Продолжить</button><button className="text-button" onClick={fullscreen}><Maximize size={17} /> На весь экран</button>
          </>}
        </div>
      </div>}
    </div>
    <div className="desktop-note"><ArrowLeft size={14} /><span>Наведи мышку и нажми, чтобы бросить</span><ArrowRight size={14} /></div>
  </main>;
}
