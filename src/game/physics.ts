import Matter from 'matter-js';
import { FRUITS, randomDrop } from './fruits';

export const BOARD = { width: 420, height: 520, left: 48, right: 372, top: 152, floor: 477, dropY: 87, danger: 169 };
export type Status = 'playing' | 'gameover' | 'won';
export interface GameState {
  score: number; best: number; current: number; next: number;
  highest: number; drops: number; shakes: number; status: Status;
  danger: number; combo: number; ready: boolean;
}
export interface Cube {
  body: Matter.Body; level: number; born: number;
  strain: number; velocity: number; shear: number; shearVelocity: number;
  phase: number;
}
export interface MergeEvent { x: number; y: number; level: number; combo: number }
export const initialState = (best = 0): GameState => ({ score: 0, best, current: 0, next: 1, highest: 0, drops: 0, shakes: 3, status: 'playing', danger: 0, combo: 0, ready: true });

/** Sleeping rigid colliders + impact-driven springs keep the jelly effect cheap. */
export class FruitWorld {
  engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 7, velocityIterations: 5 });
  cubes = new Map<number, Cube>();
  state: GameState;
  time = 0;
  aim = BOARD.width / 2;
  onChange: (state: GameState) => void = () => {};
  onMerge: (event: MergeEvent) => void = () => {};
  private pending: [number, number][] = [];
  private lastDrop = -2;
  private lastMerge = -2;
  private overflowTime = 0;
  private overDanger = false;

  constructor(best = 0, seed = true) {
    this.state = initialState(best);
    this.engine.gravity.y = 1.7;
    Matter.Events.on(this.engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => this.contacts(event, true));
    Matter.Events.on(this.engine, 'collisionActive', (event: Matter.IEventCollision<Matter.Engine>) => this.contacts(event, false));
    this.reset(seed);
  }

  emit() { this.onChange({ ...this.state }); }

  reset(seed = true) {
    const best = this.state.best;
    Matter.Composite.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.cubes.clear(); this.pending = [];
    this.time = 0; this.lastDrop = -2; this.lastMerge = -2; this.overflowTime = 0; this.overDanger = false;
    this.aim = BOARD.width / 2;
    this.state = { ...initialState(best), current: randomDrop(), next: randomDrop() };
    const { left, right, floor } = BOARD;
    Matter.Composite.add(this.engine.world, [
      Matter.Bodies.rectangle(left - 20, 280, 40, 700, { isStatic: true, friction: 0.25 }),
      Matter.Bodies.rectangle(right + 20, 280, 40, 700, { isStatic: true, friction: 0.25 }),
      Matter.Bodies.rectangle(210, floor + 20, 420, 40, { isStatic: true, friction: 0.6 }),
    ]);
    if (seed) [0, 1, 2, 3, 1, 0].forEach((level, i) => {
      const cube = this.add(level, 77 + i * 52, floor - FRUITS[level].size / 2 - 4);
      cube.born = -10;
      Matter.Body.setAngle(cube.body, (i % 2 ? 1 : -1) * 0.045);
    });
    this.emit();
  }

  add(level: number, x: number, y: number): Cube {
    const size = FRUITS[level].size;
    const body = Matter.Bodies.rectangle(x, y, size, size, {
      chamfer: { radius: size * 0.15 }, restitution: 0.12,
      friction: 0.35, frictionStatic: 0.65, frictionAir: 0.006,
      density: 0.002, sleepThreshold: 75,
    });
    const cube: Cube = { body, level, born: this.time, strain: 0, velocity: 0, shear: 0, shearVelocity: 0, phase: Math.random() * Math.PI * 2 };
    this.cubes.set(body.id, cube);
    Matter.Composite.add(this.engine.world, body);
    return cube;
  }

  setAim(x: number) {
    const half = FRUITS[this.state.current].size / 2 + 4;
    this.aim = Math.max(BOARD.left + half, Math.min(BOARD.right - half, x));
  }

  drop(): boolean {
    if (this.state.status !== 'playing' || !this.state.ready || this.cubes.size >= 85) return false;
    this.setAim(this.aim);
    const cube = this.add(this.state.current, this.aim, BOARD.dropY);
    cube.strain = -0.09;
    Matter.Body.setVelocity(cube.body, { x: 0, y: 1.5 });
    this.lastDrop = this.time;
    this.state.current = this.state.next;
    this.state.next = randomDrop();
    this.state.drops++; this.state.ready = false;
    this.emit(); return true;
  }

  shake(): boolean {
    if (!this.state.shakes || this.state.status !== 'playing') return false;
    this.state.shakes--;
    for (const cube of this.cubes.values()) {
      Matter.Sleeping.set(cube.body, false);
      Matter.Body.setVelocity(cube.body, { x: (Math.random() - 0.5) * 9, y: -3.5 - Math.random() * 3 });
      Matter.Body.setAngularVelocity(cube.body, (Math.random() - 0.5) * 0.12);
      cube.velocity += 1.5; cube.shearVelocity += (Math.random() - 0.5) * 2;
    }
    this.emit(); return true;
  }

  private contacts(event: Matter.IEventCollision<Matter.Engine>, impact: boolean) {
    for (const pair of event.pairs) {
      const a = this.cubes.get(pair.bodyA.id), b = this.cubes.get(pair.bodyB.id);
      if (a && b && a.level === b.level && a.level < 10 && this.time - a.born > 0.08 && this.time - b.born > 0.08) {
        this.pending.push([a.body.id, b.body.id]);
      }
      if (impact) {
        const normal = pair.collision.normal;
        const speed = Math.hypot(pair.bodyA.velocity.x - pair.bodyB.velocity.x, pair.bodyA.velocity.y - pair.bodyB.velocity.y);
        const kick = Math.min(2.6, speed * 0.32);
        for (const cube of [a, b]) if (cube) {
          cube.velocity += kick * (Math.abs(normal.y) > Math.abs(normal.x) ? 1 : -1);
          cube.shearVelocity += normal.x * kick * 0.25;
        }
      }
    }
  }

  private merge(a: Cube, b: Cube) {
    const level = a.level + 1, half = FRUITS[level].size / 2;
    const x = Math.max(BOARD.left + half + 1, Math.min(BOARD.right - half - 1, (a.body.position.x + b.body.position.x) / 2));
    const y = Math.min(BOARD.floor - half - 1, (a.body.position.y + b.body.position.y) / 2);
    const vx = (a.body.velocity.x + b.body.velocity.x) / 2;
    Matter.Composite.remove(this.engine.world, [a.body, b.body]);
    this.cubes.delete(a.body.id); this.cubes.delete(b.body.id);
    const cube = this.add(level, x, y);
    cube.strain = 0.18; cube.velocity = -1.5;
    Matter.Body.setVelocity(cube.body, { x: vx * 0.6, y: -1.8 });
    Matter.Body.setAngle(cube.body, (a.body.angle + b.body.angle) * 0.25);
    this.state.combo = this.time - this.lastMerge < 1.4 ? this.state.combo + 1 : 1;
    this.lastMerge = this.time;
    this.state.score += FRUITS[level].value;
    this.state.best = Math.max(this.state.best, this.state.score);
    this.state.highest = Math.max(this.state.highest, level);
    this.onMerge({ x, y, level, combo: this.state.combo });
    if (level === 10) this.state.status = 'won';
    this.emit();
  }

  step(dt = 1 / 60) {
    if (this.state.status !== 'playing') return;
    dt = Math.min(dt, 1 / 30); this.time += dt;
    Matter.Engine.update(this.engine, dt * 1000);
    const merges = this.pending; this.pending = [];
    for (const [aid, bid] of merges) {
      const a = this.cubes.get(aid), b = this.cubes.get(bid);
      if (a && b && a.level === b.level) this.merge(a, b);
    }
    for (const cube of this.cubes.values()) {
      cube.velocity += (-95 * cube.strain - 12 * cube.velocity) * dt;
      cube.strain = Math.max(-0.23, Math.min(0.27, cube.strain + cube.velocity * dt));
      cube.shearVelocity += (-75 * cube.shear - 11 * cube.shearVelocity) * dt;
      cube.shear = Math.max(-0.17, Math.min(0.17, cube.shear + cube.shearVelocity * dt));
      if (Math.abs(cube.strain) + Math.abs(cube.velocity) < 0.002) { cube.strain = 0; cube.velocity = 0; }
    }
    if (!this.state.ready && this.time - this.lastDrop >= 0.42) { this.state.ready = true; this.emit(); }
    // New drops get time to cross the line; settled overflow must persist.
    const danger = [...this.cubes.values()].some(c => this.time - c.born > 2 && c.body.bounds.min.y < BOARD.danger && c.body.speed < 2.5);
    this.overflowTime = danger ? this.overflowTime + dt : 0;
    if (danger !== this.overDanger) { this.overDanger = danger; this.state.danger = danger ? 1 : 0; this.emit(); }
    if (this.overflowTime > 2) { this.state.status = 'gameover'; this.emit(); }
    if (this.state.combo && this.time - this.lastMerge > 1.4) { this.state.combo = 0; this.emit(); }
  }

  continue() { this.state.status = 'playing'; this.emit(); }
  destroy() { Matter.Events.off(this.engine, 'collisionStart'); Matter.Events.off(this.engine, 'collisionActive'); Matter.Composite.clear(this.engine.world, false); Matter.Engine.clear(this.engine); this.cubes.clear(); }
}
