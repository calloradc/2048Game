import { asset, FRUITS, fruitAsset } from './fruits';
import { BOARD, type Cube, type FruitWorld, type MergeEvent } from './physics';

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
    this.floats.push({ x, y: y - FRUITS[level].size / 2, text: `+${FRUITS[level].value}`, age: 0, combo });
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
    // The generated glass is layered behind fruit and only its rims in front.
    ctx.fillStyle = '#23583b22'; ctx.beginPath(); ctx.ellipse(210, 497, 184, 13, 0, 0, Math.PI * 2); ctx.fill();
    if (this.glass) { ctx.globalAlpha = 0.35; ctx.drawImage(this.glass, 25, 130, 370, 370); ctx.globalAlpha = 1; }
    ctx.save(); ctx.beginPath(); ctx.roundRect(48, 151, 324, 326, 8); ctx.clip();
    const wash = ctx.createLinearGradient(0, 151, 0, 477); wash.addColorStop(0, '#e5fbef12'); wash.addColorStop(1, '#c9f5e63a');
    ctx.fillStyle = wash; ctx.fillRect(48, 151, 324, 326); ctx.restore();

    const { state, aim } = this.world;
    if (state.status === 'playing' && !this.paused) {
      const size = FRUITS[state.current].size;
      let ghostY = BOARD.floor - size / 2;
      for (const cube of this.world.cubes.values()) {
        if (aim + size / 2 > cube.body.bounds.min.x && aim - size / 2 < cube.body.bounds.max.x) {
          ghostY = Math.min(ghostY, cube.body.bounds.min.y - size / 2 - 2);
        }
      }
      ghostY = Math.max(BOARD.dropY + size, ghostY);
      ctx.save(); ctx.setLineDash([3, 8]); ctx.lineWidth = 2; ctx.strokeStyle = '#fffbedb3';
      ctx.beginPath(); ctx.moveTo(aim, BOARD.dropY + size * 0.6); ctx.lineTo(aim, ghostY); ctx.stroke();
      ctx.globalAlpha = 0.21; this.sprite(state.current, aim, ghostY, 0, size, 0, 0, false); ctx.restore();
      ctx.save(); ctx.globalAlpha = state.ready ? 1 : 0.55;
      this.sprite(state.current, aim, BOARD.dropY, 0, size, Math.sin(this.world.time * 3) * 0.025, 0);
      ctx.restore();
      // Small release chevron above the current cube.
      ctx.strokeStyle = '#fffae6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(aim - 5, BOARD.dropY - size * 0.72 - 7); ctx.lineTo(aim, BOARD.dropY - size * 0.72 - 2); ctx.lineTo(aim + 5, BOARD.dropY - size * 0.72 - 7); ctx.stroke();
    }

    ctx.save(); ctx.setLineDash([5, 7]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = state.danger ? '#ff666bdd' : '#fffdf082';
    ctx.beginPath(); ctx.moveTo(57, BOARD.danger); ctx.lineTo(363, BOARD.danger); ctx.stroke(); ctx.restore();
    for (const cube of this.world.cubes.values()) this.cube(cube);
    if (this.glass) {
      ctx.save(); ctx.beginPath(); ctx.rect(25, 130, 370, 370); ctx.rect(49, 165, 322, 309); ctx.clip('evenodd');
      ctx.globalAlpha = 0.91; ctx.drawImage(this.glass, 25, 130, 370, 370); ctx.restore();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of this.floats) {
      ctx.save(); ctx.globalAlpha = Math.min(1, (1.1 - f.age) * 3); ctx.textAlign = 'center';
      ctx.font = '900 25px Nunito, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff8e5'; ctx.fillStyle = '#438952';
      const y = f.y - f.age * 45; ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y);
      if (f.combo > 1) { ctx.font = '900 12px Nunito, sans-serif'; ctx.fillStyle = '#df8633'; ctx.fillText(`КОМБО ×${f.combo}`, f.x, y + 17); }
      ctx.restore();
    }
  }

  private cube(cube: Cube) {
    this.sprite(cube.level, cube.body.position.x, cube.body.position.y, cube.body.angle, FRUITS[cube.level].size, cube.strain, cube.shear);
  }

  private sprite(level: number, x: number, y: number, angle: number, size: number, strain: number, shear: number, label = true) {
    const ctx = this.ctx, image = this.sprites[level]; if (!image) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.transform(1 + strain, 0, shear, 1 / (1 + strain), 0, 0);
    const display = size * 1.17;
    if (Math.abs(strain) > 0.013) this.mesh(image, display, strain);
    else ctx.drawImage(image, -display / 2, -display / 2 - size * 0.05, display, display);
    if (label) {
      const value = FRUITS[level].value.toString(), font = Math.max(9, size * 0.16);
      ctx.font = `900 ${font}px Nunito, sans-serif`;
      const w = Math.max(font * 1.6, ctx.measureText(value).width + font * 0.7), h = font * 1.35;
      const bx = size * 0.22 - w / 2, by = size * 0.30 - h / 2;
      ctx.fillStyle = '#fffbeaeb'; ctx.beginPath(); ctx.roundRect(bx, by, w, h, h / 2); ctx.fill();
      ctx.fillStyle = '#68512e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, size * 0.22, size * 0.30 + 0.3);
    }
    ctx.restore();
  }

  /** Only moving jelly uses eight textured triangles; resting fruit uses one draw. */
  private mesh(image: HTMLImageElement, size: number, strain: number) {
    const points: Point[] = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const px = (col / 2 - 0.5) * size, py = (row / 2 - 0.5) * size - size * 0.043;
      points.push({ x: px + Math.sin(row * 1.8 + this.world.time * 15) * strain * size * 0.13 * (col === 1 ? 0.3 : 1), y: py + Math.sin(col * 2 + this.world.time * 17) * strain * size * 0.10 });
    }
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const tl = row * 3 + col, tr = tl + 1, bl = tl + 3, br = bl + 1;
      const sx = col * image.width / 2, sy = row * image.height / 2, hw = image.width / 2, hh = image.height / 2;
      this.triangle(image, [{ x: sx, y: sy }, { x: sx + hw, y: sy }, { x: sx, y: sy + hh }], [points[tl], points[tr], points[bl]]);
      this.triangle(image, [{ x: sx + hw, y: sy + hh }, { x: sx, y: sy + hh }, { x: sx + hw, y: sy }], [points[br], points[bl], points[tr]]);
    }
  }

  private triangle(image: HTMLImageElement, s: Point[], d: Point[]) {
    const ctx = this.ctx;
    const den = s[0].x * (s[1].y - s[2].y) + s[1].x * (s[2].y - s[0].y) + s[2].x * (s[0].y - s[1].y);
    const affine = (values: number[]) => [
      (values[0] * (s[1].y - s[2].y) + values[1] * (s[2].y - s[0].y) + values[2] * (s[0].y - s[1].y)) / den,
      (values[0] * (s[2].x - s[1].x) + values[1] * (s[0].x - s[2].x) + values[2] * (s[1].x - s[0].x)) / den,
      (values[0] * (s[1].x * s[2].y - s[2].x * s[1].y) + values[1] * (s[2].x * s[0].y - s[0].x * s[2].y) + values[2] * (s[0].x * s[1].y - s[1].x * s[0].y)) / den,
    ];
    const a = affine(d.map(p => p.x)), b = affine(d.map(p => p.y));
    ctx.save(); ctx.beginPath(); ctx.moveTo(d[0].x, d[0].y); ctx.lineTo(d[1].x, d[1].y); ctx.lineTo(d[2].x, d[2].y); ctx.closePath(); ctx.clip();
    ctx.transform(a[0], b[0], a[1], b[1], a[2], b[2]); ctx.drawImage(image, 0, 0); ctx.restore();
  }

  destroy() { this.destroyed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); }
}
