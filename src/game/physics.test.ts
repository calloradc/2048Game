import { describe, expect, it } from 'vitest';
import Matter from 'matter-js';
import { BOARD, FruitWorld } from './physics';
import { FRUITS, randomDrop } from './fruits';
const advance = (world: FruitWorld, seconds: number) => { for (let i = 0; i < seconds * 60; i++) world.step(); };

describe('FruitWorld', () => {
  it('merges two touching equals once, doubles their value and saves the record', () => {
    const world = new FruitWorld(0, false);
    world.add(0, 190, 430); world.add(0, 218, 430);
    advance(world, 2);
    expect(world.cubes.size).toBe(1);
    expect([...world.cubes.values()][0].level).toBe(1);
    expect(world.state.score).toBe(4); expect(world.state.best).toBe(4);
    world.destroy();
  });
  it('does not merge different levels and keeps squares inside the glass', () => {
    const world = new FruitWorld(0, false);
    world.add(1, 70, 250); world.add(2, 107, 250);
    advance(world, 5);
    expect(world.cubes.size).toBe(2); expect(world.state.score).toBe(0);
    for (const cube of world.cubes.values()) {
      expect(cube.body.bounds.min.x).toBeGreaterThanOrEqual(BOARD.left - 1);
      expect(cube.body.bounds.max.x).toBeLessThanOrEqual(BOARD.right + 1);
      expect(cube.body.bounds.max.y).toBeLessThanOrEqual(BOARD.floor + 1);
      expect(Math.abs(cube.strain)).toBeLessThan(0.01);
    }
    world.destroy();
  });
  it('allows drops only after cooldown and clamps aim to container', () => {
    const world = new FruitWorld(0, false);
    world.setAim(-1000); expect(world.aim).toBeGreaterThan(BOARD.left);
    expect(world.drop()).toBe(true); expect(world.drop()).toBe(false);
    advance(world, 0.5); expect(world.drop()).toBe(true);
    expect(world.state.drops).toBe(2); world.destroy();
  });
  it('reaches 2048 and never creates an unsupported twelfth fruit', () => {
    const world = new FruitWorld(0, false);
    world.add(9, 145, 400); world.add(9, 265, 400);
    advance(world, 0.3);
    expect(world.state.status).toBe('won'); expect(world.state.highest).toBe(10);
    expect(world.state.score).toBe(2048); expect(world.cubes.size).toBe(1);
    world.continue(); advance(world, 3);
    expect([...world.cubes.values()][0].level).toBe(10); world.destroy();
  });
  it('limits shakes, wakes resting bodies, and preserves record on reset', () => {
    const world = new FruitWorld(1234, false);
    const cube = world.add(1, 180, 450); advance(world, 4);
    expect(cube.body.isSleeping).toBe(true);
    expect(world.shake()).toBe(true); expect(cube.body.isSleeping).toBe(false);
    expect(world.shake()).toBe(true); expect(world.shake()).toBe(true);
    expect(world.shake()).toBe(false);
    world.reset(false); expect(world.state.best).toBe(1234);
    expect(world.state.shakes).toBe(3); expect(world.state.score).toBe(0); world.destroy();
  });
  it('ends the game after sustained overflow, giving a new fruit a grace period', () => {
    const world = new FruitWorld(0, false);
    const cube = world.add(3, 200, 157);
    Matter.Body.setStatic(cube.body, true);
    advance(world, 3); expect(world.state.status).toBe('playing');
    advance(world, 2); expect(world.state.status).toBe('gameover');
    expect(world.drop()).toBe(false); world.destroy();
  });
  it('survives a busy container with finite positions and bounded deformation', () => {
    const world = new FruitWorld(0, false);
    for (let i = 0; i < 50; i++) world.add(i % 5, 80 + (i % 6) * 48, 210 + Math.floor(i / 6) * 30);
    advance(world, 8);
    for (const cube of world.cubes.values()) {
      expect(Number.isFinite(cube.body.position.x)).toBe(true);
      expect(Number.isFinite(cube.body.position.y)).toBe(true);
      expect(cube.body.position.y).toBeLessThan(BOARD.floor + 1);
      expect(Math.abs(cube.strain)).toBeLessThanOrEqual(0.27);
    }
    expect(world.cubes.size).toBeLessThanOrEqual(50); world.destroy();
  });
});

describe('Fruit progression', () => {
  it('covers every power of two through 2048 and spawns only the first four', () => {
    expect(FRUITS.map(f => f.value)).toEqual(Array.from({ length: 11 }, (_, i) => 2 ** (i + 1)));
    expect([0, 0.4, 0.73, 0.93, 0.999].map(n => randomDrop(() => n))).toEqual([0, 1, 2, 3, 3]);
  });
});
