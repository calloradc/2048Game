import { mergeCoins, shopPrice } from './economy';
import { FRUITS, randomDrop } from './fruits';

export const BOARD = { width: 420, height: 490, left: 50, right: 370, top: 117, floor: 432, dropY: 68, danger: 128 };
export type Status = 'playing' | 'gameover' | 'won';
export interface GameState {
  score: number; best: number; current: number; next: number;
  highest: number; drops: number; shakes: number; status: Status;
  danger: number; combo: number; ready: boolean; coins: number; discovered: number;
  earned: number; doubled: boolean; bonusCoins: number; revives: number;
}
export interface Node { x: number; y: number; px: number; py: number }
interface Link { a: number; b: number; rest: number; lambda: number }
export interface Cube {
  id: number; level: number; born: number; nodes: Node[]; links: Link[];
  x: number; y: number; angle: number; speed: number; sleeping: boolean; sleepTicks: number;
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } };
  invMass: number; restArea: number; areaLambda: number; deformation: number; gx: Float64Array; gy: Float64Array;
}
export interface MergeEvent { x: number; y: number; level: number; combo: number }
export const SHAKE_PRICE = shopPrice(25);
export const initialState = (best = 0, coins = 0, discovered = 1): GameState => ({ score: 0, best, current: 0, next: 1, highest: 0, drops: 0, shakes: 3, status: 'playing', danger: 0, combo: 0, ready: true, coins, discovered, earned:0, doubled:false, bonusCoins:0, revives:0 });
// Clockwise perimeter: corners and edge midpoints. Ninth point is the centre.
export const REST_POINTS = [[-0.5,-0.5],[0,-0.5],[0.5,-0.5],[0.5,0],[0.5,0.5],[0,0.5],[-0.5,0.5],[-0.5,0],[0,0]] as const;
const ITERATIONS = 6;
const CELL = 100;
const MAX_CUBES = 70;
const OVERFLOW_SECONDS = 1.2;

/** Nine Verlet particles, compliant distance/area constraints and polygon contacts. */
export class FruitWorld {
  cubes = new Map<number, Cube>();
  state: GameState;
  time = 0;
  aim = BOARD.width / 2;
  onChange: (state: GameState) => void = () => {};
  onMerge: (event: MergeEvent) => void = () => {};
  private nextId = 1;
  private lastDrop = -2;
  private lastMerge = -2;
  private mergedLevels = 0;
  private overflowTime = 0;
  private overDanger = false;
  lastPairCount = 0;
  private contactA = new Float64Array(8);
  private contactB = new Float64Array(8);

  constructor(best = 0, coins = 0, discovered = 1) { this.state = initialState(best,coins,discovered); this.reset(); }
  get overflowProgress() { return Math.min(1,this.overflowTime/OVERFLOW_SECONDS); }
  emit() { this.onChange({ ...this.state }); }
  grantCoins(amount: number) { if(!Number.isFinite(amount)||amount<=0)return;this.state.coins+=Math.floor(amount);this.emit(); }
  spendCoins(amount: number) { if(amount<0||!Number.isFinite(amount)||this.state.coins<amount)return false;this.state.coins-=Math.floor(amount);this.emit();return true; }
  grantShake() { this.state.shakes++;this.emit(); }
  doubleEarnings() {
    if(this.state.status==='playing'||this.state.doubled||!this.state.earned)return false;
    this.state.doubled=true;this.state.bonusCoins=this.state.earned;this.grantCoins(this.state.bonusCoins);return true;
  }
  revive() {
    if(this.state.status!=='gameover'||this.state.revives>=1)return false;
    const upper=[...this.cubes.values()].sort((a,b)=>a.bounds.min.y-b.bounds.min.y);
    for(let i=0;i<upper.length;i++)if(i<3||upper[i].bounds.min.y<BOARD.danger+55)this.cubes.delete(upper[i].id);
    for(const cube of this.cubes.values())this.setVelocity(cube,0,-0.3);
    this.state.status='playing';this.state.revives++;this.state.danger=0;this.state.ready=true;
    this.overflowTime=0;this.overDanger=false;this.emit();return true;
  }
  reset() {
    const {best,coins} = this.state;
    this.cubes.clear(); this.time = 0; this.lastDrop = -2; this.lastMerge = -2;
    this.mergedLevels = 0;
    this.overflowTime = 0; this.overDanger = false; this.nextId = 1;
    this.aim = BOARD.width / 2;
    this.state = { ...initialState(best,coins), current: randomDrop(), next: randomDrop() };
    this.emit();
  }

  add(level: number, x: number, y: number): Cube {
    const size = FRUITS[level].size;
    const nodes = REST_POINTS.map(([u,v]) => ({ x: x + u * size, y: y + v * size, px: x + u * size, py: y + v * size }));
    const links: Link[] = [];
    const link = (a: number, b: number) => links.push({a,b,rest:Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y),lambda:0});
    for (let i = 0; i < 8; i++) { link(i,(i+1)%8); link(i,8); }
    for (let i = 0; i < 4; i++) link(i,i+4);
    const cube: Cube = {
      id:this.nextId++, level, born:this.time, nodes, links, x,y,angle:0,speed:0,sleeping:false,sleepTicks:0,
      bounds:{min:{x:x-size/2,y:y-size/2},max:{x:x+size/2,y:y+size/2}},
      invMass: 1000 / (size * size), restArea:size*size,areaLambda:0,deformation:0,gx:new Float64Array(8),gy:new Float64Array(8),
    };
    this.cubes.set(cube.id,cube); return cube;
  }

  setAim(x: number) {
    const half = FRUITS[this.state.current].size / 2 + 5;
    this.aim = Math.max(BOARD.left + half, Math.min(BOARD.right - half, x));
  }
  drop(): boolean {
    if (this.state.status !== 'playing' || !this.state.ready || this.cubes.size >= MAX_CUBES) return false;
    this.setAim(this.aim);
    const cube = this.add(this.state.current,this.aim,BOARD.dropY);
    this.state.discovered |= 1 << cube.level;
    this.setVelocity(cube,0,1.5);
    this.lastDrop = this.time; this.state.current = this.state.next; this.state.next = randomDrop();
    this.state.drops++; this.state.ready = false; this.emit(); return true;
  }
  wake(cube: Cube) { cube.sleeping = false; cube.sleepTicks = 0; }
  setVelocity(cube: Cube, vx: number, vy: number) {
    this.wake(cube);
    for (const n of cube.nodes) { n.px=n.x-vx; n.py=n.y-vy; }
  }
  shake(): boolean {
    if (this.state.status !== 'playing') return false;
    if (this.state.shakes > 0) this.state.shakes--;
    else if (this.state.coins >= SHAKE_PRICE) this.state.coins -= SHAKE_PRICE;
    else return false;
    for (const cube of this.cubes.values()) {
      this.setVelocity(cube,(Math.random()-0.5)*7,-3-Math.random()*3);
      // Offset individual perimeter nodes to excite a real bending wave.
      for (let i=0;i<8;i++) { cube.nodes[i].px += Math.sin(i*Math.PI/4)*1.3; cube.nodes[i].py += Math.cos(i*Math.PI/4)*1.3; }
    }
    this.emit(); return true;
  }

  private updateGeometry(c: Cube) {
    const n=c.nodes;
    c.x=n.reduce((s,p)=>s+p.x,0)/9; c.y=n.reduce((s,p)=>s+p.y,0)/9;
    let dot=0,cross=0;
    for(let i=0;i<8;i++){const [u,v]=REST_POINTS[i],dx=n[i].x-c.x,dy=n[i].y-c.y;dot+=dx*u+dy*v;cross+=dy*u-dx*v;}
    c.angle=Math.atan2(cross,dot);
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(let i=0;i<8;i++){minX=Math.min(minX,n[i].x);maxX=Math.max(maxX,n[i].x);minY=Math.min(minY,n[i].y);maxY=Math.max(maxY,n[i].y);}
    c.bounds.min.x=minX;c.bounds.min.y=minY;c.bounds.max.x=maxX;c.bounds.max.y=maxY;
    const cos=Math.cos(c.angle),sin=Math.sin(c.angle),size=FRUITS[c.level].size;
    let error=0;
    for(let i=0;i<8;i++) {
      const [u,v]=REST_POINTS[i];
      error=Math.max(error,Math.hypot(n[i].x-c.x-(u*cos-v*sin)*size,n[i].y-c.y-(u*sin+v*cos)*size));
    }
    c.deformation=error/size;
  }

  private limitShape(c: Cube) {
    const size=FRUITS[c.level].size,limit=size*0.24,cos=Math.cos(c.angle),sin=Math.sin(c.angle);
    for(let i=0;i<9;i++) {
      const [u,v]=REST_POINTS[i],targetX=c.x+(u*cos-v*sin)*size,targetY=c.y+(u*sin+v*cos)*size;
      const p=c.nodes[i],dx=p.x-targetX,dy=p.y-targetY,distance=Math.hypot(dx,dy);
      const cap=i===8?limit*0.5:limit;
      if(distance>cap){p.x=targetX+dx*cap/distance;p.y=targetY+dy*cap/distance;}
    }
  }

  private springs(c: Cube, dt: number) {
    const w=c.invMass;
    // XPBD compliance is scaled by mass, keeping big fruit similarly soft.
    const alpha=0.00038*w/(dt*dt);
    for(const l of c.links) {
      const a=c.nodes[l.a],b=c.nodes[l.b],dx=b.x-a.x,dy=b.y-a.y;
      const distance=Math.max(0.001,Math.hypot(dx,dy));
      const hard=distance<l.rest*0.65||distance>l.rest*1.32;
      const compliance=hard?0:alpha;
      const lambda=(-(distance-l.rest)-compliance*l.lambda)/(2*w+compliance);
      l.lambda+=lambda;
      const correction=lambda*w/distance;
      a.x-=dx*correction; a.y-=dy*correction; b.x+=dx*correction; b.y+=dy*correction;
    }
    let area=0,denominator=0;
    const gx=c.gx,gy=c.gy;
    for(let i=0;i<8;i++) {
      const p=c.nodes[i],next=c.nodes[(i+1)%8],prev=c.nodes[(i+7)%8];
      area+=(p.x*next.y-next.x*p.y)*0.5;
      gx[i]=(next.y-prev.y)*0.5; gy[i]=(prev.x-next.x)*0.5;
      denominator+=w*(gx[i]*gx[i]+gy[i]*gy[i]);
    }
    const areaAlpha=0.04*w/(dt*dt);
    const lambda=(-(area-c.restArea)-areaAlpha*c.areaLambda)/(denominator+areaAlpha);
    c.areaLambda+=lambda;
    for(let i=0;i<8;i++) { c.nodes[i].x+=w*gx[i]*lambda; c.nodes[i].y+=w*gy[i]*lambda; }
  }

  private boundaries(c: Cube) {
    for(const n of c.nodes) {
      n.x=Math.max(BOARD.left,Math.min(BOARD.right,n.x));
      if(n.y>BOARD.floor) {
        n.y=BOARD.floor;
        n.px=n.x-(n.x-n.px)*0.82;
        n.py=Math.min(n.py,BOARD.floor);
      }
    }
  }

  private pairs(): [Cube,Cube][] {
    const grid=new Map<string,Cube[]>(), result:[Cube,Cube][]=[],seen=new Set<number>();
    for(const c of this.cubes.values()) {
      this.updateGeometry(c);
      for(let x=Math.floor((c.bounds.min.x-5)/CELL);x<=Math.floor((c.bounds.max.x+5)/CELL);x++) {
        for(let y=Math.floor((c.bounds.min.y-5)/CELL);y<=Math.floor((c.bounds.max.y+5)/CELL);y++) {
          const key=`${x},${y}`,list=grid.get(key)??[];
          for(const other of list) {
            if(c.sleeping&&other.sleeping) continue;
            const pair=Math.min(c.id,other.id)*100000+Math.max(c.id,other.id);
            if(!seen.has(pair)) {seen.add(pair);result.push([other,c]);}
          }
          list.push(c);grid.set(key,list);
        }
      }
    }
    this.lastPairCount=result.length;return result;
  }

  private collide(a: Cube,b: Cube): boolean {
    if(a.bounds.max.x<b.bounds.min.x||b.bounds.max.x<a.bounds.min.x||a.bounds.max.y<b.bounds.min.y||b.bounds.max.y<a.bounds.min.y) return false;
    let depth=Infinity,nx=0,ny=0;
    const an=a.nodes,bn=b.nodes;
    // Polygon SAT on all eight perimeter points, not an undeformed box.
    for(const nodes of [an,bn]) for(let i=0;i<8;i++) {
      const p=nodes[i],q=nodes[(i+1)%8],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);
      if(len<0.01)continue;
      const ax=-dy/len,ay=dx/len;
      let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
      for(let j=0;j<8;j++) {
        const av=an[j].x*ax+an[j].y*ay,bv=bn[j].x*ax+bn[j].y*ay;
        amin=Math.min(amin,av);amax=Math.max(amax,av);bmin=Math.min(bmin,bv);bmax=Math.max(bmax,bv);
      }
      const overlap=Math.min(amax,bmax)-Math.max(amin,bmin);
      if(overlap<=0)return false;
      if(overlap<depth) {depth=overlap;const sign=(b.x-a.x)*ax+(b.y-a.y)*ay>=0?1:-1;nx=ax*sign;ny=ay*sign;}
    }
    if(!Number.isFinite(depth))return false;
    if(a.sleeping)this.wake(a);if(b.sleeping)this.wake(b);
    // Distribute contact pressure over only the facing points: the surface dents.
    let amax=-Infinity,bmin=Infinity;
    for(let i=0;i<8;i++){amax=Math.max(amax,an[i].x*nx+an[i].y*ny);bmin=Math.min(bmin,bn[i].x*nx+bn[i].y*ny);}
    const aw=this.contactA,bw=this.contactB;
    let asum=0,bsum=0;
    const ar=FRUITS[a.level].size*0.24,br=FRUITS[b.level].size*0.24;
    for(let i=0;i<8;i++) {
      aw[i]=Math.max(0,1-(amax-an[i].x*nx-an[i].y*ny)/ar);
      bw[i]=Math.max(0,1-(bn[i].x*nx+bn[i].y*ny-bmin)/br);
      asum+=aw[i];bsum+=bw[i];
    }
    let denominator=0;
    for(let i=0;i<8;i++){aw[i]/=asum;bw[i]/=bsum;denominator+=aw[i]*aw[i]*a.invMass+bw[i]*bw[i]*b.invMass;}
    const impulse=Math.max(0,depth-0.12)*0.72/Math.max(0.0001,denominator);
    for(let i=0;i<8;i++) {
      an[i].x-=nx*impulse*a.invMass*aw[i];an[i].y-=ny*impulse*a.invMass*aw[i];
      bn[i].x+=nx*impulse*b.invMass*bw[i];bn[i].y+=ny*impulse*b.invMass*bw[i];
    }
    return true;
  }

  private merge(a: Cube,b: Cube) {
    const level=a.level+1,half=FRUITS[level].size/2;
    const x=Math.max(BOARD.left+half+1,Math.min(BOARD.right-half-1,(a.x+b.x)/2));
    const y=Math.min(BOARD.floor-half-1,(a.y+b.y)/2);
    const vx=((a.x-a.nodes[8].px)+(b.x-b.nodes[8].px))*0.15;
    this.cubes.delete(a.id);this.cubes.delete(b.id);
    const c=this.add(level,x,y);this.setVelocity(c,vx,-1.1);
    // Birth pulse changes actual node positions; springs restore the square.
    for(let i=0;i<8;i++) {
      const n=c.nodes[i];n.x=x+(n.x-x)*1.12;n.y=y+(n.y-y)*0.89;
    }
    this.updateGeometry(c);
    this.state.combo=this.time-this.lastMerge<1.4?this.state.combo+1:1;this.lastMerge=this.time;
    this.state.score+=FRUITS[level].value;this.state.best=Math.max(this.state.best,this.state.score);
    this.state.highest=Math.max(this.state.highest,level);
    const coins = mergeCoins(this.mergedLevels + level) - mergeCoins(this.mergedLevels);
    this.mergedLevels += level;
    this.state.discovered |= 1 << level; this.state.coins += coins;this.state.earned+=coins;
    this.onMerge({x,y,level,combo:this.state.combo});
    if(level===10)this.state.status='won';this.emit();
  }

  step(dt=1/60) {
    if(this.state.status!=='playing')return;
    dt=Math.min(dt,1/30);this.time+=dt;
    for(const c of this.cubes.values()) {
      if(c.sleeping)continue;
      c.areaLambda=0;for(const l of c.links)l.lambda=0;
      for(const n of c.nodes) {
        const vx=Math.max(-12,Math.min(12,(n.x-n.px)*0.988));
        const vy=Math.max(-12,Math.min(12,(n.y-n.py)*0.988));
        n.px=n.x;n.py=n.y;n.x+=vx;n.y+=vy+1100*dt*dt;
      }
    }
    const pairs=this.pairs(),merges=new Map<number,[number,number]>();
    for(let iteration=0;iteration<ITERATIONS;iteration++) {
      for(const c of this.cubes.values())if(!c.sleeping){this.springs(c,dt);this.updateGeometry(c);this.limitShape(c);this.boundaries(c);this.updateGeometry(c);}
      for(const [a,b] of pairs) {
        if(a.sleeping&&b.sleeping)continue;
        if(this.collide(a,b)&&a.level===b.level&&a.level<10)merges.set(a.id*100000+b.id,[a.id,b.id]);
      }
    }
    for(const c of this.cubes.values()) {
      if(c.sleeping)continue;
      this.updateGeometry(c);this.limitShape(c);this.boundaries(c);this.updateGeometry(c);
      c.speed=Math.sqrt(c.nodes.reduce((v,n)=>v+(n.x-n.px)**2+(n.y-n.py)**2,0)/9);
      if(c.speed<0.12)c.sleepTicks++;else c.sleepTicks=0;
      if(c.sleepTicks>75){c.sleeping=true;for(const n of c.nodes){n.px=n.x;n.py=n.y;}}
    }
    for(const [aid,bid]of merges.values()) {
      const a=this.cubes.get(aid),b=this.cubes.get(bid);if(a&&b&&a.level===b.level)this.merge(a,b);
    }
    if(!this.state.ready&&this.time-this.lastDrop>=0.42){this.state.ready=true;this.emit();}
    // Motion in a crowded jelly pile must not reset the loss countdown.
    // Only the newly released/merged fruit gets a short falling grace period.
    const danger=this.cubes.size>=MAX_CUBES||[...this.cubes.values()].some(c=>this.time-c.born>1.3&&c.bounds.min.y<BOARD.danger);
    this.overflowTime=danger?this.overflowTime+dt:Math.max(0,this.overflowTime-dt*2);
    if(danger!==this.overDanger){this.overDanger=danger;this.state.danger=danger?1:0;this.emit();}
    if(this.overflowTime>=OVERFLOW_SECONDS){this.state.status='gameover';this.emit();}
    if(this.state.combo&&this.time-this.lastMerge>1.4){this.state.combo=0;this.emit();}
  }
  continue(){this.state.status='playing';this.emit();}
  destroy(){this.cubes.clear();}
}
