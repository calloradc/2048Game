import { describe, expect, it } from 'vitest';
import { BOARD, FruitWorld, SHAKE_PRICE } from './physics';
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
  it('rewards merges, discovers dropped and merged fruit, and preserves the wallet on restart', () => {
    const world=new FruitWorld(123,10,1);
    world.state.current=2;world.drop();
    expect(world.state.discovered & (1<<2)).toBeTruthy();
    world.add(0,190,410);world.add(0,218,410);advance(world,0.3);
    expect(world.state.coins).toBe(10);expect(world.state.discovered & (1<<1)).toBeTruthy();
    world.reset();expect(world.state.coins).toBe(10);expect(world.state.discovered).toBe(1);
    expect(world.state.score).toBe(0);world.destroy();
  });
  it('uses three free shakes before spending coins and refuses an unaffordable shake', () => {
    const world=new FruitWorld(0,SHAKE_PRICE+1);
    for(let i=0;i<3;i++)expect(world.shake()).toBe(true);
    expect(world.state.coins).toBe(SHAKE_PRICE+1);expect(world.state.shakes).toBe(0);
    expect(world.shake()).toBe(true);expect(world.state.coins).toBe(1);
    expect(world.shake()).toBe(false);expect(world.state.coins).toBe(1);world.destroy();
  });
  it('accumulates small merge rewards in whole coins and doubles only the earned amount', () => {
    const world=new FruitWorld(0,100);
    for(let i=0;i<5;i++) {
      world.cubes.clear();world.add(0,190,410);world.add(0,218,410);advance(world,.3);
    }
    expect(world.state.score).toBe(20);expect(world.state.earned).toBe(3);expect(world.state.coins).toBe(103);
    world.state.status='gameover';expect(world.doubleEarnings()).toBe(true);expect(world.state.coins).toBe(106);
    expect(world.doubleEarnings()).toBe(false);
    world.reset();expect(world.state.earned).toBe(0);expect(world.state.coins).toBe(106);world.destroy();
  });
  it('gives a new fruit time before sustained overflow ends the game', () => {
    const world=new FruitWorld();const cube=world.add(3,200,BOARD.danger+FRUITS[3].size/2-5);cube.sleeping=true;
    advance(world,1.25);expect(world.state.danger).toBe(0);expect(world.overflowProgress).toBe(0);
    advance(world,.1);expect(world.state.danger).toBe(1);
    advance(world,1.05);expect(world.state.status).toBe('playing');
    advance(world,.15);expect(world.state.status).toBe('gameover');expect(world.drop()).toBe(false);world.destroy();
  });
  it('does not count fruit resting just beneath the danger line', () => {
    const world=new FruitWorld();const cube=world.add(3,200,BOARD.danger+FRUITS[3].size/2+1);cube.sleeping=true;
    advance(world,5);expect(world.state.danger).toBe(0);expect(world.state.status).toBe('playing');world.destroy();
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
  it('loses with a moving crowded pile and revives only once per round',()=>{
    const world=new FruitWorld();
    // Final-level bodies cannot merge. Their moving stack extends above the line.
    for(let row=0;row<4;row++)for(let col=0;col<3;col++) {
      const cube=world.add(10,105+col*105,400-row*100);
      world.setVelocity(cube,col%2?2:-2,-1);
    }
    advance(world,7);expect(world.state.status).toBe('gameover');expect(world.drop()).toBe(false);
    const before=world.cubes.size;
    expect(world.revive()).toBe(true);expect(world.cubes.size).toBeLessThan(before);
    expect(world.state.status).toBe('playing');expect(world.state.revives).toBe(1);expect(world.overflowProgress).toBe(0);
    expect(world.revive()).toBe(false);expect(world.drop()).toBe(true);
    advance(world,7);expect(world.state.status).toBe('playing');
    for(let i=0;i<6;i++)world.add(10,100+i%3*110,100-Math.floor(i/3)*110);
    advance(world,7);expect(world.state.status).toBe('gameover');expect(world.revive()).toBe(false);
    world.reset();expect(world.state.revives).toBe(0);world.destroy();
  });
  it('awards extra coins once, preserves the bonus on continuing, and resets round perks',()=>{
    const world=new FruitWorld(0,50);
    world.add(9,145,390);world.add(9,265,390);advance(world,.3);
    expect(world.state.earned).toBe(6);expect(world.state.coins).toBe(56);
    expect(world.doubleEarnings()).toBe(true);expect(world.state.coins).toBe(62);
    expect(world.doubleEarnings()).toBe(false);expect(world.state.coins).toBe(62);
    world.continue();world.add(0,70,410);world.add(0,98,410);advance(world,.3);
    expect(world.state.earned).toBe(6);expect(world.state.bonusCoins).toBe(6);
    world.grantShake();expect(world.state.shakes).toBe(4);
    expect(world.spendCoins(500)).toBe(false);expect(world.spendCoins(20)).toBe(true);
    const coins=world.state.coins;world.reset();expect(world.state.coins).toBe(coins);
    expect(world.state.doubled).toBe(false);expect(world.state.bonusCoins).toBe(0);expect(world.state.shakes).toBe(3);world.destroy();
  });
  it('lets the large fruit settle back into square bodies',()=>{
    for(let level=7;level<11;level++){
      const world=new FruitWorld(),cube=world.add(level,210,230);advance(world,6);
      const aspect=(cube.bounds.max.x-cube.bounds.min.x)/(cube.bounds.max.y-cube.bounds.min.y);
      expect(aspect).toBeGreaterThan(.93);expect(aspect).toBeLessThan(1.07);world.destroy();
    }
  });
  it('ends a capacity-limited round instead of leaving the drop button permanently blocked',()=>{
    const world=new FruitWorld();
    for(let i=0;i<70;i++){const cube=world.add(0,64+i%10*31,400-Math.floor(i/10)*31);cube.sleeping=true;}
    expect(world.drop()).toBe(false);advance(world,3);
    expect(world.state.status).toBe('gameover');expect(world.revive()).toBe(true);expect(world.drop()).toBe(true);world.destroy();
  });
});
describe('Fruit progression',()=>{
  it('covers powers of two through 2048 and only spawns early fruit',()=>{
    expect(FRUITS.map(f=>f.value)).toEqual(Array.from({length:11},(_,i)=>2**(i+1)));
    expect([0,0.4,0.73,0.93,0.999].map(n=>randomDrop(()=>n))).toEqual([0,1,2,3,3]);
  });
});
