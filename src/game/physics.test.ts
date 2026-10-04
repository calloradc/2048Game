import { describe, expect, it } from 'vitest';
import { BOARD, FruitWorld } from './physics';
import { FRUITS, randomDrop } from './fruits';
const advance = (world: FruitWorld, seconds: number) => { for (let i = 0; i < seconds * 60; i++) world.step(); };

describe('FruitWorld: rules and soft bodies', () => {
  it('starts empty and resets without adding a demonstration pile', () => {
    const world = new FruitWorld(123);
    expect(world.cubes.size).toBe(0); world.drop(); expect(world.cubes.size).toBe(1);
    world.reset(); expect(world.cubes.size).toBe(0); expect(world.state.score).toBe(0);
    expect(world.state.best).toBe(123);world.destroy();
  });
  it('merges touching equals once, doubles their value and saves the record', () => {
    const world = new FruitWorld();
    world.add(0,190,430);world.add(0,218,430);advance(world,2);
    expect(world.cubes.size).toBe(1);expect([...world.cubes.values()][0].level).toBe(1);
    expect(world.state.score).toBe(4);expect(world.state.best).toBe(4);world.destroy();
  });
  it('keeps different fruit and their actual contour inside the glass', () => {
    const world = new FruitWorld();world.add(1,70,250);world.add(2,107,250);advance(world,5);
    expect(world.cubes.size).toBe(2);expect(world.state.score).toBe(0);
    for(const cube of world.cubes.values())for(const p of cube.nodes) {
      expect(p.x).toBeGreaterThanOrEqual(BOARD.left-0.001);expect(p.x).toBeLessThanOrEqual(BOARD.right+0.001);
      expect(p.y).toBeLessThanOrEqual(BOARD.floor+0.001);
    }
    world.destroy();
  });
  it('physically bends its edge midpoints on impact and restores the area', () => {
    const world = new FruitWorld();const cube=world.add(4,210,300);
    world.setVelocity(cube,1,9);
    let deformation=0,bend=0;
    for(let i=0;i<150;i++){
      world.step();deformation=Math.max(deformation,cube.deformation);
      const [a,b,c]=cube.nodes;
      bend=Math.max(bend,Math.hypot(b.x-(a.x+c.x)/2,b.y-(a.y+c.y)/2));
    }
    expect(deformation).toBeGreaterThan(0.03);expect(bend).toBeGreaterThan(1);
    advance(world,4);
    let area=0;for(let i=0;i<8;i++){const p=cube.nodes[i],q=cube.nodes[(i+1)%8];area+=(p.x*q.y-q.x*p.y)/2;}
    expect(area/cube.restArea).toBeGreaterThan(0.75);expect(area/cube.restArea).toBeLessThan(1.2);
    expect(cube.sleeping).toBe(true);world.destroy();
  });
  it('respects the drop cooldown and clamps aim', () => {
    const world=new FruitWorld();world.setAim(-1000);expect(world.aim).toBeGreaterThan(BOARD.left);
    expect(world.drop()).toBe(true);expect(world.drop()).toBe(false);
    advance(world,0.5);expect(world.drop()).toBe(true);expect(world.state.drops).toBe(2);world.destroy();
  });
  it('creates the final 2048 fruit and supports continuing', () => {
    const world=new FruitWorld();world.add(9,145,390);world.add(9,265,390);advance(world,0.3);
    expect(world.state.status).toBe('won');expect(world.state.highest).toBe(10);
    expect(world.state.score).toBe(2048);expect(world.cubes.size).toBe(1);
    world.continue();advance(world,3);expect([...world.cubes.values()][0].level).toBe(10);world.destroy();
  });
  it('limits shakes and wakes sleeping soft bodies', () => {
    const world=new FruitWorld(1234);const cube=world.add(1,180,450);advance(world,4);
    expect(cube.sleeping).toBe(true);expect(world.shake()).toBe(true);expect(cube.sleeping).toBe(false);
    expect(world.shake()).toBe(true);expect(world.shake()).toBe(true);expect(world.shake()).toBe(false);
    world.reset();expect(world.state.best).toBe(1234);expect(world.state.shakes).toBe(3);world.destroy();
  });
  it('gives a new fruit time before sustained overflow ends the game', () => {
    const world=new FruitWorld();const cube=world.add(3,200,157);cube.sleeping=true;
    advance(world,3);expect(world.state.status).toBe('playing');
    advance(world,2);expect(world.state.status).toBe('gameover');expect(world.drop()).toBe(false);world.destroy();
  });
  it('keeps a busy container finite and uses local broadphase pairs', () => {
    const world=new FruitWorld();
    for(let i=0;i<40;i++)world.add(i%5,80+(i%6)*48,210+Math.floor(i/6)*32);
    advance(world,8);
    for(const cube of world.cubes.values())for(const p of cube.nodes){
      expect(Number.isFinite(p.x)).toBe(true);expect(Number.isFinite(p.y)).toBe(true);
      expect(p.y).toBeLessThanOrEqual(BOARD.floor+0.001);
    }
    expect(world.cubes.size).toBeLessThanOrEqual(40);expect(world.lastPairCount).toBeLessThan(40*39/2);world.destroy();
  });
});
describe('Fruit progression',()=>{
  it('covers powers of two through 2048 and only spawns early fruit',()=>{
    expect(FRUITS.map(f=>f.value)).toEqual(Array.from({length:11},(_,i)=>2**(i+1)));
    expect([0,0.4,0.73,0.93,0.999].map(n=>randomDrop(()=>n))).toEqual([0,1,2,3,3]);
  });
});
