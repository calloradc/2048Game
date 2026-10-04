import { asset, FRUITS, fruitAsset } from './fruits';
import { BOARD, type Cube, type FruitWorld, type MergeEvent, REST_POINTS } from './physics';

interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number }
interface Float { x: number; y: number; text: string; age: number; combo: number }
type Point = { x: number; y: number };
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Не удалось загрузить ${src}`)); image.src = src;
});

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private sprites: HTMLImageElement[] = [];
  private glass?: HTMLImageElement;
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private destroyed = false;
  private particles: Particle[] = [];
  private sleepingSprites = new Map<number, {canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number}>();
  private floats: Float[] = [];
  private resizeObserver: ResizeObserver;
  paused = false;

  constructor(private canvas: HTMLCanvasElement, public world: FruitWorld) {
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas недоступен');
    this.ctx = context;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  async start() {
    const images = await Promise.all([...FRUITS.map((_, level) => loadImage(fruitAsset(level))), loadImage(asset('glass.webp'))]);
    if (this.destroyed) return;
    this.sprites = images.slice(0, 11); this.glass = images[11];
    this.frame = requestAnimationFrame(this.tick);
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.getBoundingClientRect().width * dpr));
    this.sleepingSprites.clear();
    this.canvas.width = width; this.canvas.height = Math.round(width * BOARD.height / BOARD.width);
  }

  private tick = (now: number) => {
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 1 / 60;
    this.last = now;
    if (!this.paused && !document.hidden) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= 1 / 60 && steps < 3) {
        this.world.step(1 / 60); this.accumulator -= 1 / 60; steps++;
      }
      if (steps === 3) this.accumulator = 0;
      for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 210 * dt; }
      this.particles = this.particles.filter(p => p.age < p.life);
      for (const f of this.floats) f.age += dt;
      this.floats = this.floats.filter(f => f.age < 1.1);
    } else this.accumulator = 0;
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  merge(event: MergeEvent) {
    const { x, y, level, combo } = event;
    this.floats.push({ x, y: y - FRUITS[level].size / 2, text: combo > 1 ? 'КОМБО!' : 'СОЧНО!', age: 0, combo });
    const count = Math.min(18, 9 + level);
    for (let i = 0; i < count && this.particles.length < 140; i++) {
      const a = Math.random() * Math.PI * 2, speed = 45 + Math.random() * 100;
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 35, age: 0, life: 0.45 + Math.random() * 0.4, color: i % 3 ? FRUITS[level].color : '#fff5a6', size: 2 + Math.random() * 3 });
    }
  }

  private draw() {
    const ctx = this.ctx, scale = this.canvas.width / BOARD.width;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, BOARD.width, BOARD.height);
    // Use the original glass image once; no drawn tint, duplicate rim or wash.
    if (this.glass) ctx.drawImage(this.glass, 25, 130, 370, 370);
    for (const id of this.sleepingSprites.keys()) if (!this.world.cubes.has(id)) this.sleepingSprites.delete(id);

    const { state, aim } = this.world;
    if (state.status === 'playing' && !this.paused) {
      const size = FRUITS[state.current].size;
      let ghostY = BOARD.floor - size / 2;
      for (const cube of this.world.cubes.values()) {
        if (aim + size / 2 > cube.bounds.min.x && aim - size / 2 < cube.bounds.max.x) {
          ghostY = Math.min(ghostY, cube.bounds.min.y - size / 2 - 2);
        }
      }
      ghostY = Math.max(BOARD.dropY + size, ghostY);
      ctx.save(); ctx.setLineDash([3, 8]); ctx.lineWidth = 2; ctx.strokeStyle = '#fffbedb3';
      ctx.beginPath(); ctx.moveTo(aim, BOARD.dropY + size * 0.6); ctx.lineTo(aim, ghostY); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = state.ready ? 1 : 0.55;
      this.sprite(state.current, aim, BOARD.dropY + Math.sin(this.world.time * 3) * 1.5, 0, size);
      ctx.restore();
      // Small release chevron above the current cube.
      ctx.strokeStyle = '#fffae6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(aim - 5, BOARD.dropY - size * 0.72 - 7); ctx.lineTo(aim, BOARD.dropY - size * 0.72 - 2); ctx.lineTo(aim + 5, BOARD.dropY - size * 0.72 - 7); ctx.stroke();
    }

    ctx.save(); ctx.setLineDash([5, 7]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = state.danger ? '#ff666bdd' : '#fffdf082';
    ctx.beginPath(); ctx.moveTo(57, BOARD.danger); ctx.lineTo(363, BOARD.danger); ctx.stroke(); ctx.restore();
    for (const cube of this.world.cubes.values()) this.cube(cube);
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.floats) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (1.1 - f.age) * 3); ctx.textAlign = 'center';
      ctx.font = '900 18px Montserrat, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff8e5'; ctx.fillStyle = '#438952';
      const y = f.y - f.age * 45; ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y);

      ctx.restore();
    }
  }

  private cube(cube: Cube) {
    const ctx = this.ctx;
    if (cube.sleeping) {
      let cached = this.sleepingSprites.get(cube.id);
      if (!cached) {
        const margin = FRUITS[cube.level].size * 0.23;
        const x = cube.bounds.min.x - margin, y = cube.bounds.min.y - margin;
        const w = cube.bounds.max.x - cube.bounds.min.x + margin * 2, h = cube.bounds.max.y - cube.bounds.min.y + margin * 2;
        const canvas = document.createElement('canvas');
        const resolution = Math.min(this.canvas.width / BOARD.width, 2);
        canvas.width = Math.ceil(w * resolution); canvas.height = Math.ceil(h * resolution);
        const offscreen = canvas.getContext('2d')!;
        offscreen.setTransform(resolution,0,0,resolution,-x*resolution,-y*resolution);
        this.mesh(cube,offscreen);
        cached = {canvas,x,y,w,h}; this.sleepingSprites.set(cube.id,cached);
      }
      ctx.drawImage(cached.canvas,cached.x,cached.y,cached.w,cached.h);
    } else {
      this.sleepingSprites.delete(cube.id);
      this.mesh(cube,ctx);
    }
  }

  private sprite(level: number, x: number, y: number, angle: number, size: number) {
    const ctx = this.ctx, image = this.sprites[level]; if (!image) return;
    const display = size * 1.10;
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
    ctx.drawImage(image,-display/2,-display/2-size*0.035,display,display); ctx.restore();
  }

  /** The texture follows the same eight collision nodes, joined to the centre. */
  private mesh(cube: Cube, ctx: CanvasRenderingContext2D) {
    const image = this.sprites[cube.level]; if (!image) return;
    const size = FRUITS[cube.level].size;
    const points: Point[] = cube.nodes.map(p => ({x:cube.x+(p.x-cube.x)*1.10,y:cube.y+(p.y-cube.y)*1.10-size*0.035}));
    const source: Point[] = REST_POINTS.map(([u,v]) => ({x:(u+0.5)*image.width,y:(v+0.5)*image.height}));
    for(let i=0;i<8;i++) {
      const next=(i+1)%8;
      this.triangle(ctx,image,[source[8],source[i],source[next]],[points[8],points[i],points[next]]);
    }
  }

  private triangle(ctx: CanvasRenderingContext2D, image: HTMLImageElement, s: Point[], d: Point[]) {
    const den = s[0].x * (s[1].y - s[2].y) + s[1].x * (s[2].y - s[0].y) + s[2].x * (s[0].y - s[1].y);
    const affine = (values: number[]) => [
      (values[0] * (s[1].y - s[2].y) + values[1] * (s[2].y - s[0].y) + values[2] * (s[0].y - s[1].y)) / den,
      (values[0] * (s[2].x - s[1].x) + values[1] * (s[0].x - s[2].x) + values[2] * (s[1].x - s[0].x)) / den,
      (values[0] * (s[1].x * s[2].y - s[2].x * s[1].y) + values[1] * (s[2].x * s[0].y - s[0].x * s[2].y) + values[2] * (s[0].x * s[1].y - s[1].x * s[0].y)) / den,
    ];
    const a = affine(d.map(p => p.x)), b = affine(d.map(p => p.y));
    // Overlap clips by a fraction of a pixel to avoid anti-alias seams.
    const cx=(d[0].x+d[1].x+d[2].x)/3,cy=(d[0].y+d[1].y+d[2].y)/3;
    const clip=d.map(p=>{const dx=p.x-cx,dy=p.y-cy,len=Math.max(1,Math.hypot(dx,dy));return{x:p.x+dx/len*0.3,y:p.y+dy/len*0.3};});
    ctx.save();ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);ctx.lineTo(clip[1].x,clip[1].y);ctx.lineTo(clip[2].x,clip[2].y);ctx.closePath();ctx.clip();
    ctx.transform(a[0], b[0], a[1], b[1], a[2], b[2]); ctx.drawImage(image, 0, 0); ctx.restore();
  }

  destroy() { this.destroyed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); this.sleepingSprites.clear(); }
}
