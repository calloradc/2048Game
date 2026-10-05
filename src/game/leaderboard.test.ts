import { describe, expect, it } from 'vitest';
import { roundRankProgress } from './leaderboard';
import { FruitWorld } from './physics';

describe('Leaderboard round progress',()=>{
  it('shows improvements only after losing a round with a new personal best',()=>{
    expect(roundRankProgress('playing',1000,0)).toBeNull();
    expect(roundRankProgress('won',1000,0)).toBeNull();
    expect(roundRankProgress('gameover',1000,1000)).toBeNull();
    expect(roundRankProgress('gameover',999,1000)).toBeNull();
    const progress=roundRankProgress('gameover',1000,100)!;
    expect(progress).toEqual({previousScore:100,score:1000});
  });
  it('compares against the best at round start even though live best already increased',()=>{
    const world=new FruitWorld(100),startingBest=world.state.best;
    world.state.score=1000;world.state.best=1000;world.state.status='gameover';
    expect(world.revive()).toBe(true);
    expect(roundRankProgress(world.state.status,world.state.score,startingBest)).toBeNull();
    world.state.status='gameover';
    const progress=roundRankProgress(world.state.status,world.state.score,startingBest)!;
    expect(progress.previousScore).toBe(100);
    world.reset();
    expect(world.state.score).toBe(0);expect(world.state.best).toBe(1000);
    world.state.status='gameover';world.state.score=800;
    expect(roundRankProgress(world.state.status,world.state.score,world.state.best)).toBeNull();
    world.destroy();
  });
});
