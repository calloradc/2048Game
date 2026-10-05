import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { AD_COINS, AD_COIN_PACK } from '../game/economy';
export type AdReward={type:'coins'}|{type:'coin-pack'}|{type:'shake'}|{type:'revive'}|{type:'double'}|{type:'unlock';key:string};
export const rewardLabel=(reward:AdReward)=>reward.type==='coins'?t("+{n} монет",{n:AD_COINS}):reward.type==='coin-pack'?t("Шаг к +{n} монетам",{n:AD_COIN_PACK}):reward.type==='shake'?t("+1 встряска"):reward.type==='revive'?t("Спасение урожая"):reward.type==='double'?t("Монеты за игру ×2"):t("Шаг к новому оформлению");

export function RewardedAd({reward,leaving=false,onComplete,onCancel}:{reward:AdReward;leaving?:boolean;onComplete:()=>void;onCancel:()=>void}) {
  const [progress,setProgress]=useState(0),done=useRef(false),complete=useRef(onComplete),dialog=useRef<HTMLDivElement>(null);
  complete.current=onComplete;
  useEffect(()=>{
    if(leaving)return;
    dialog.current?.focus({preventScroll:true});
    let elapsed=0,last=performance.now();
    const timer=setInterval(()=>{
      const now=performance.now(),dt=Math.min(200,now-last);last=now;
      if(document.hidden)return;
      elapsed+=dt;setProgress(Math.min(1,elapsed/3000));
      if(elapsed>=3000&&!done.current){done.current=true;clearInterval(timer);complete.current();}
    },50);
    return()=>clearInterval(timer);
  },[leaving]);
  return <div className={`ad-overlay ${leaving?'is-leaving':''}`} inert={leaving}><div className="ad-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("Имитация рекламы")} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onCancel();}if(e.key==='Tab'){e.preventDefault();dialog.current?.querySelector('button')?.focus({preventScroll:true});}}}>
    <span className="eyebrow">{t("ИМИТАЦИЯ РЕКЛАМЫ")}</span><div className="ad-gift"><Icon name="gift" size={105}/><Icon name="sparkle" size={30}/></div><h1>{t("Маленький бонус")}</h1><p>{rewardLabel(reward)}</p>
    <div className="ad-bar" role="progressbar" aria-label={t("Просмотр видео")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span style={{width:`${progress*100}%`}}/></div><span className="ad-countdown">{t("Ещё {n} сек.",{n:Math.max(1,Math.ceil(3-progress*3))})}</span>
    <button className="text-button" onClick={onCancel}><Icon name="close" size={15}/> {t("Закрыть без награды")}</button>
  </div></div>;
}
