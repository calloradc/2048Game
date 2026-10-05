import { describe, expect, it } from 'vitest';
import { DEMO_PLAYERS, demoRank, roundRankProgress } from './leaderboard';
import { FruitWorld } from './physics';

describe('Demo leaderboard round progress',()=>{
  it('shows improvements only after losing a round with a new personal best',()=>{
    expect(roundRankProgress('playing',1000,0)).toBeNull();
    expect(roundRankProgress('won',1000,0)).toBeNull();
    expect(roundRankProgress('gameover',1000,1000)).toBeNull();
    expect(roundRankProgress('gameover',999,1000)).toBeNull();
    const progress=roundRankProgress('gameover',1000,100)!;
    expect(progress.toRank).toBeLessThan(progress.fromRank);
    expect(progress.gained).toBe(progress.fromRank-progress.toRank);
    expect(progress.total).toBe(DEMO_PLAYERS.length+1);
    const topScore=DEMO_PLAYERS[0].score;
    expect(roundRankProgress('gameover',topScore+4,topScore)).toMatchObject({fromRank:1,toRank:1,gained:0});
  });
  it('uses stable opponents, consistent ties and global ranks',()=>{
    expect(demoRank(0)).toBe(201);
    expect(demoRank(4)).toBe(200);
    expect(demoRank(DEMO_PLAYERS[0].score)).toBe(1);
    expect(DEMO_PLAYERS.every((player,index)=>!index||player.score<=DEMO_PLAYERS[index-1].score)).toBe(true);
    expect(new Set(DEMO_PLAYERS.map(player=>player.id)).size).toBe(200);
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
