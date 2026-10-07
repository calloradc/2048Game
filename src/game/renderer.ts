import { t } from '../i18n';
import { asset, FRUITS, fruitAsset } from './fruits';
import { BOARD, type Cube, type FruitWorld, type MergeEvent } from './physics';
import { bodyUV, bodyRect, spriteFans, textureTransform, type UV } from './spriteShape';
import { AimPreview } from './aimPreview';
import { backgroundAsset, wideBackgroundAsset, boxAsset } from './catalog';
import { UI_ARTWORK } from '../ui/assets';
import { getReducedMotion } from '../ui/motion';

interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; texture: number; size: number; angle: number; spin: number }
interface Burst { x: number; y: number; age: number; color: string; radius: number }
interface Float { x: number; y: number; text: string; age: number; combo: number }
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Не удалось загрузить ${src}`)); image.src = src;
});

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private sprites: HTMLImageElement[] = [];
  private glass?: HTMLImageElement;
  private particleTextures: HTMLImageElement[] = [];
  private bursts: Burst[] = [];
  private frame = 0;
  private last = 0;
  private accumulator = 0;
  private destroyed = false;
  private particles: Particle[] = [];
  private sleepingSprites = new Map<number, {canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number}>();
  private floats: Float[] = [];
  private resizeObserver: ResizeObserver;
  private preview: AimPreview;
  private skin='fruit';
  private appearanceVersion=0;
  private needsDraw=true;
  private suspended=false;
  hideText = false;
  paused = false;

  constructor(private canvas: HTMLCanvasElement, public world: FruitWorld) {
    this.preview=new AimPreview(world.aim);
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas недоступен');
    this.ctx = context;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  async start(progress: (loaded: number, total: number) => void = () => {},skin='fruit',box='glass',background='meadow') {
    this.skin=skin;
    const files=[...FRUITS.map((_,level)=>fruitAsset(level,skin)),boxAsset(box),...Array.from({length:12},(_,i)=>asset(`particles/${i}.webp`)),backgroundAsset(background),wideBackgroundAsset(background),asset('cover.webp'),asset('cover-wide.webp'),asset('pointhand.webp'),...UI_ARTWORK];
    let completed=0;const total=files.length+1;
    const images=await Promise.all(files.map(async src=>{const image=await loadImage(src);if(!this.destroyed)progress(++completed,total);return image;}));
    await document.fonts.ready;
    if (this.destroyed) return;
    progress(++completed,total);
    this.sprites=images.slice(0,11);this.glass=images[11];this.particleTextures=images.slice(12,24);
    this.frame=requestAnimationFrame(this.tick);
  }

  async setAppearance(skin:string,box:string,background:string) {
    const version=++this.appearanceVersion;
    const images=await Promise.all([...FRUITS.map((_,level)=>fruitAsset(level,skin)),boxAsset(box),backgroundAsset(background),wideBackgroundAsset(background)].map(loadImage));
    if(this.destroyed||version!==this.appearanceVersion)return false;
    this.skin=skin;this.sprites=images.slice(0,11);this.glass=images[11];this.sleepingSprites.clear();this.needsDraw=true;return true;
  }

  private displayWidth() {
    const scene=this.canvas.closest<HTMLElement>('.scene');
    // The field can shake/rotate; its axis-aligned bounds must not change
    // the backing resolution or redraw a paused game during that animation.
    return scene?this.canvas.clientWidth*scene.getBoundingClientRect().width/scene.offsetWidth:this.canvas.getBoundingClientRect().width;
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.displayWidth() * dpr));
    this.sleepingSprites.clear();
    this.canvas.width = width; this.canvas.height = Math.round(width * BOARD.height / BOARD.width);
    this.needsDraw=true;
  }

  private tick = (now: number) => {
    const pixels=Math.round(this.displayWidth()*(window.devicePixelRatio||1));
    if(Math.abs(this.canvas.width-pixels)>1)this.resize();
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 1 / 60;
    this.last = now;
    const suspended=this.paused||document.hidden;
    if (!suspended) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= 1 / 60 && steps < 3) {
        this.world.step(1 / 60); this.accumulator -= 1 / 60; steps++;
      }
      if (steps === 3) this.accumulator = 0;
      this.preview.step(this.world.aim,this.world.state.drops,dt,getReducedMotion());
      for (const p of this.particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.vx *= Math.pow(0.985, dt * 60); p.angle += p.spin * dt; }
      this.particles = this.particles.filter(p => p.age < p.life);
      for (const b of this.bursts) b.age += dt;
      this.bursts=this.bursts.filter(b=>b.age<0.35);
      for (const f of this.floats) f.age += dt;
      this.floats = this.floats.filter(f => f.age < 1.1);
    } else this.accumulator = 0;
    // Keep the blurred game backdrop cached while a dialog is open.
    // Appearance changes and resizes still refresh it once during the pause.
    if(!suspended||this.needsDraw||suspended!==this.suspended)this.draw();
    this.needsDraw=false;this.suspended=suspended;
    this.frame = requestAnimationFrame(this.tick);
  };

  merge(event: MergeEvent) {
    const { x, y, level, combo } = event;
    if (!this.hideText) {
      this.floats.push({ x, y: y - FRUITS[level].size / 2, text: combo > 1 ? t('КОМБО!') : t('СОЧНО!'), age: 0, combo });
      this.floats=this.floats.slice(-3);
    }
    this.bursts.push({x,y,age:0,color:FRUITS[level].color,radius:FRUITS[level].size*0.55});
    const juice=[0,0,1,2,3,4,5,5,2,2,0][level];
    const count=Math.min(30,17+level);
    for(let i=0;i<count&&this.particles.length<150;i++) {
      const angle=Math.random()*Math.PI*2,speed=85+Math.random()*150,r=Math.random();
      const texture=i===0?11:r<0.6?juice:r<0.77?6:r<0.91?7:8+(level===4?2:level===2?1:0);
      this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-60,age:0,life:0.5+Math.random()*0.5,texture,size:texture===11?20:texture===7?18:9+Math.random()*10,angle:Math.random()*6.28,spin:(Math.random()-0.5)*8});
    }
  }

  private draw() {
    const ctx = this.ctx, scale = this.canvas.width / BOARD.width;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, BOARD.width, BOARD.height);
    // Draw the selected container once; no duplicate rim or wash.
    if (this.glass) ctx.drawImage(this.glass, 20, 39, 380, 433);
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
      ctx.beginPath(); ctx.moveTo(this.preview.x, BOARD.dropY + size * 0.6); ctx.lineTo(aim, ghostY); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = state.ready ? 1 : 0.55;
      this.sprite(state.current, this.preview.x, BOARD.dropY + Math.sin(this.world.time * 3) * 1.5 - Math.abs(this.preview.angle)*5, this.preview.angle, size*this.preview.scale);
      ctx.restore();
      // Small release chevron above the current cube.
      ctx.strokeStyle = '#fffae6'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(this.preview.x - 5, BOARD.dropY - size * 0.72 - 7); ctx.lineTo(this.preview.x, BOARD.dropY - size * 0.72 - 2); ctx.lineTo(this.preview.x + 5, BOARD.dropY - size * 0.72 - 7); ctx.stroke();
    }

    ctx.save(); ctx.setLineDash([5, 7]); ctx.lineWidth = 1.5;
    ctx.strokeStyle = state.danger ? '#ff666bdd' : '#fffdf082';
    ctx.beginPath(); ctx.moveTo(57, BOARD.danger); ctx.lineTo(363, BOARD.danger); ctx.stroke(); ctx.restore();
    if(state.danger){ctx.fillStyle='#ff7066';ctx.fillRect(57,BOARD.danger+5,306*this.world.overflowProgress,3);}
    for (const cube of this.world.cubes.values()) this.cube(cube);
    for(const b of this.bursts) {
      const t=b.age/0.35;ctx.save();ctx.globalAlpha=(1-t)*0.5;ctx.strokeStyle=b.color;ctx.lineWidth=3*(1-t);
      ctx.beginPath();ctx.arc(b.x,b.y,b.radius*(0.4+t),0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    for (const p of this.particles) {
      const texture=this.particleTextures[p.texture];if(!texture)continue;
      ctx.save();ctx.globalAlpha=Math.min(1,(p.life-p.age)*4);ctx.translate(p.x,p.y);ctx.rotate(p.angle);
      const size=p.size*(0.7+0.3*(1-p.age/p.life));
      if(p.texture===7)ctx.globalCompositeOperation='lighter';
      ctx.drawImage(texture,-size/2,-size/2,size,size);ctx.restore();
    }
    if (!this.hideText) {
      ctx.globalAlpha = 1;
      for (const f of this.floats) {
        ctx.save(); ctx.globalAlpha = Math.min(1, (1.1 - f.age) * 3); ctx.textAlign = 'center';
        ctx.font = '900 18px Nunito, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = '#fff8e5'; ctx.fillStyle = '#438952';
        const y = f.y - f.age * 45; ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y);
        ctx.restore();
      }
    }
  }

  private cube(cube: Cube) {
    const ctx = this.ctx;
    if (cube.sleeping) {
      let cached = this.sleepingSprites.get(cube.id);
      if (!cached) {
        // Cache only the mapped image bounds, including leaves beyond the flesh.
        const uv = bodyUV(cube.level,this.skin);
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(let i=0;i<8;i++) {
          const next=(i+1)%8;
          const {x:a,y:b}=textureTransform([uv[8],uv[i],uv[next]],[cube.nodes[8],cube.nodes[i],cube.nodes[next]]);
          for(const p of spriteFans(this.skin)[cube.level][i]) {
            const px=a[0]*p.x+a[1]*p.y+a[2],py=b[0]*p.x+b[1]*p.y+b[2];
            minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
          }
        }
        // Align the cache to the main canvas pixel grid. A second fractional
        // resample made resting cubes softer than the live mesh.
        const resolution = this.canvas.width / BOARD.width;
        const x=Math.floor((minX-1)*resolution)/resolution,y=Math.floor((minY-1)*resolution)/resolution;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil((maxX+1-x)*resolution);canvas.height = Math.ceil((maxY+1-y)*resolution);
        const w=canvas.width/resolution,h=canvas.height/resolution;
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
    const ctx=this.ctx,image=this.sprites[level];if(!image)return;
    const [left,top,right,bottom]=bodyRect(level,this.skin),sx=size/(right-left),sy=size/(bottom-top);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.drawImage(image,-size/2-left*sx,-size/2-top*sy,256*sx,256*sy);ctx.restore();
  }

  /** Measured flesh UVs map directly to collider nodes; leaves extend outside. */
  private mesh(cube: Cube, ctx: CanvasRenderingContext2D) {
    const image=this.sprites[cube.level];if(!image)return;
    const uv=bodyUV(cube.level,this.skin);
    for(let i=0;i<8;i++) {
      const next=(i+1)%8;
      this.triangle(ctx,image,[uv[8],uv[i],uv[next]],[cube.nodes[8],cube.nodes[i],cube.nodes[next]],spriteFans(this.skin)[cube.level][i]);
    }
  }

  private triangle(ctx: CanvasRenderingContext2D, image: HTMLImageElement, s: UV[], d: UV[], polygon: UV[]) {
    const {x:a,y:b}=textureTransform(s,d);
    const points=polygon.map(p=>({x:a[0]*p.x+a[1]*p.y+a[2],y:b[0]*p.x+b[1]*p.y+b[2]}));
    const cx=points.reduce((v,p)=>v+p.x,0)/points.length,cy=points.reduce((v,p)=>v+p.y,0)/points.length;
    const clip=points.map(p=>{const dx=p.x-cx,dy=p.y-cy,len=Math.max(1,Math.hypot(dx,dy));return{x:p.x+dx/len*0.25,y:p.y+dy/len*0.25};});
    ctx.save();ctx.beginPath();ctx.moveTo(clip[0].x,clip[0].y);for(let i=1;i<clip.length;i++)ctx.lineTo(clip[i].x,clip[i].y);ctx.closePath();ctx.clip();
    ctx.transform(a[0],b[0],a[1],b[1],a[2],b[2]);ctx.drawImage(image,0,0);ctx.restore();
  }

  destroy() { this.destroyed = true; cancelAnimationFrame(this.frame); this.resizeObserver.disconnect(); this.sleepingSprites.clear(); }
}
