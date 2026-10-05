import { useEffect, useState } from 'react';
import { t, localeTag } from '../i18n';
import type { RankProgress } from '../game/leaderboard';
import { fruitAsset } from '../game/fruits';
import { Icon } from './Icon';
import { authorizePlayer, getLeaderboard, getYsdk, isAuthorized, submitLeaderboardScore, type LeaderboardData } from '../platform/yandexSdk';
import { readStorage } from '../platform/storage';

export function Leaderboard({progress,onContinue,onAuthorized}:{progress:RankProgress;onContinue:()=>void;onAuthorized:()=>void}) {
  const [data,setData]=useState<LeaderboardData|null>(null),[loading,setLoading]=useState(true),[amount,setAmount]=useState(0),[authorizing,setAuthorizing]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let alive=true;setLoading(true);
    void (async()=>{
      await submitLeaderboardScore(Math.max(progress.score,Number(readStorage('jelly-best'))||0));
      const result=await getLeaderboard();if(alive){setData(result);setLoading(false);setAmount(0);}
    })();
    return()=>{alive=false;};
  },[progress.score,revision]);
  useEffect(()=>{
    if(loading||!data?.own)return;
    let frame=0,elapsed=0,previous=0;
    const tick=(now:number)=>{
      if(previous&&!document.hidden)elapsed+=Math.min(64,now-previous);
      previous=now;const part=Math.min(1,elapsed/1900);setAmount(1-(1-part)**3);
      if(part<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[data,loading]);
  const login=async()=>{
    setAuthorizing(true);
    if(await authorizePlayer()){onAuthorized();setRevision(value=>value+1);}
    setAuthorizing(false);
  };
  const format=(n:number)=>n.toLocaleString(localeTag());
  const toRank=data?.own?.rank,fromRank=data?.previousRank??toRank;
  const rank=toRank&&fromRank?Math.round(fromRank+(toRank-fromRank)*amount):null;
  const entries=[...new Map([...(data?.entries??[]),...(data?.own?[data.own]:[])].map(entry=>[entry.player.uniqueID,entry])).values()].sort((a,b)=>a.rank-b.rank);
  return <section className="leaderboard-content">
    <div className="leaderboard-heading"><Icon name="trophy" size={42}/><div><span className="eyebrow">{t('НОВЫЙ РЕКОРД!')}</span><h1>{t('Рекорд стал выше!')}</h1></div></div>
    <div className="leaderboard-record">{format(progress.score)} <span>{t('очков')} · +{format(progress.score-progress.previousScore)}</span></div>
    {rank&&<div className="rank-progress"><span>#{format(fromRank!)}</span><Icon name="right" size={20}/><strong data-testid="animated-rank">#{format(rank)}</strong><b>↑ {format(Math.max(0,fromRank!-rank))}</b></div>}
    {entries.length>0&&<div className="leaderboard-list">
      {entries.map(entry=><div key={entry.player.uniqueID} className={`leaderboard-row ${entry.player.uniqueID===data?.own?.player.uniqueID?'leaderboard-you':''}`}><span className="leaderboard-place">{format(entry.rank)}</span><img src={fruitAsset(0)} alt=""/><span className="leaderboard-name">{entry.player.publicName||t('Игрок')}</span><b>{format(entry.score)}</b></div>)}
    </div>}
    <p className="leaderboard-summary" aria-live="polite">{loading?t('Загрузка рейтинга…'):toRank?t('Твоё место: {rank}',{rank:format(rank??toRank)}):!getYsdk()?t('Рейтинг доступен в Яндекс Играх.'):!data?t('Рейтинг сейчас недоступен. Попробуй позже.'):!entries.length?t('В рейтинге пока нет результатов.'):''}</p>
    {!!getYsdk()&&!isAuthorized()&&<><p>{t('Войди в Яндекс, чтобы отправлять свой рекорд в рейтинг.')}</p><button className="reward-button" onClick={()=>void login()} disabled={authorizing}>{t('Войти в Яндекс')}</button></>}
    <button className="primary-button" onClick={onContinue}><Icon name="play" size={19}/>{t('Продолжить играть')}</button>
  </section>;
}
