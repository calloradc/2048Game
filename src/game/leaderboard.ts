import type { Status } from './physics';
export interface RankProgress { previousScore: number; score: number }
// Actual places are loaded from the platform after the round, never estimated.
export function roundRankProgress(status:Status,score:number,previousBest:number):RankProgress|null {
  return status==='gameover'&&score>previousBest?{previousScore:previousBest,score}:null;
}
