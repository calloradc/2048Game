import type { Status } from './physics';

const handles=['BerryBuddy','MochiCloud','SunnyFox','MintyCat','PeachPop','JellyBear','LunaBun','CocoaPanda','KiwiStar','HoneyBee'];
// A fixed demo population keeps ranks comparable across rounds and reloads.
export const DEMO_PLAYERS=Array.from({length:200},(_,index)=>({
  id:`demo-${index}`,name:`${handles[index%handles.length]}_${String(index+1).padStart(3,'0')}`,
  score:4*Math.round((index+1)**1.6),avatar:index%11,
})).sort((a,b)=>b.score-a.score);
export const demoRank=(score:number)=>1+DEMO_PLAYERS.filter(player=>player.score>score).length;
export interface RankProgress { previousScore:number; score:number; fromRank:number; toRank:number; gained:number; total:number }

export function roundRankProgress(status:Status,score:number,previousBest:number):RankProgress|null {
  if(status!=='gameover'||score<=previousBest)return null;
  const fromRank=demoRank(previousBest),toRank=demoRank(score);
  return {previousScore:previousBest,score,fromRank,toRank,gained:fromRank-toRank,total:DEMO_PLAYERS.length+1};
}
