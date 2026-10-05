import { useEffect, useState, type CSSProperties } from 'react';
import { t, localeTag } from '../i18n';
import { DEMO_PLAYERS, type RankProgress } from '../game/leaderboard';
import { fruitAsset } from '../game/fruits';
import { Icon } from './Icon';
import { useAnimationsEnabled } from './motion';

export function Leaderboard({progress,onContinue}:{progress:RankProgress;onContinue:()=>void}) {
  const animations = useAnimationsEnabled();
  const [amount,setAmount]=useState(0);
  useEffect(()=>{
    if(!animations){setAmount(1);return;}
    let frame=0,elapsed=0,previous=0;
    const tick=(now:number)=>{
      if(previous&&!document.hidden)elapsed+=Math.min(64,now-previous);
      previous=now;
      const part=Math.min(1,elapsed/1900);
      setAmount(1-(1-part)**3);
      if(part<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[animations]);
  const position=progress.fromRank+(progress.toRank-progress.fromRank)*amount;
  const rank=Math.round(position),gained=progress.fromRank-rank;
  const format=(n:number)=>n.toLocaleString(localeTag());
  const step=43,camera=(position-3)*step;
  const rivals=DEMO_PLAYERS.map((player,index)=>({...player,rank:index+1+(index+1>=position?1:0)}))
    .filter(player=>Math.abs(player.rank-position)<=3.4);
  const rowStyle=(place:number)=>({transform:`translateY(${place*step-step-camera}px)`} as CSSProperties);
  return <section className="leaderboard-content">
    <div className="leaderboard-heading"><Icon name="trophy" size={42}/><div><span className="eyebrow">{t('НОВЫЙ РЕКОРД!')}</span><h1>{progress.gained?t('Ты поднимаешься!'):t('Рекорд стал выше!')}</h1></div></div>
    <div className="leaderboard-record">{format(progress.score)} <span>{t('очков')} · +{format(progress.score-progress.previousScore)}</span></div>
    <div className="rank-progress" aria-hidden="true"><span>#{format(progress.fromRank)}</span><Icon name="right" size={20}/><strong data-testid="animated-rank">#{format(rank)}</strong><b>↑ {format(gained)}</b></div>
    <div className="leaderboard-window" aria-hidden="true">
      {rivals.map(player=><div key={player.id} className="leaderboard-row" style={rowStyle(player.rank)}><span className="leaderboard-place">{format(player.rank)}</span><img src={fruitAsset(player.avatar)} alt=""/><span className="leaderboard-name">{player.name}</span><b>{format(player.score)}</b></div>)}
      <div className="leaderboard-row leaderboard-you" style={{...rowStyle(position),translate:`0 ${(1-amount)*30}px`}}><span className="leaderboard-place">{format(rank)}</span><img src={fruitAsset(0)} alt=""/><span className="leaderboard-name">{t('Ты')}</span><b>{format(progress.score)}</b></div>
    </div>
    <p className="leaderboard-summary" aria-live="polite">{amount>=1?t('Твоё место: {rank} из {total} · вверх на {n}',{rank:format(progress.toRank),total:format(progress.total),n:format(progress.gained)}):t('Поднимаемся в рейтинге…')}</p>
    <p className="leaderboard-demo">{t('Демо-лидерборд · игроки пока вымышленные')}</p>
    <button className="primary-button" onClick={onContinue}><Icon name="play" size={19}/>{t('Продолжить играть')}</button>
  </section>;
}
