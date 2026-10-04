import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
export type AdReward={type:'coins'}|{type:'shake'}|{type:'revive'}|{type:'double'}|{type:'unlock';key:string};
export const rewardLabel=(reward:AdReward)=>reward.type==='coins'?'+75 монет':reward.type==='shake'?'+1 встряска':reward.type==='revive'?'Спасение урожая':reward.type==='double'?'Монеты за игру ×2':'Шаг к новому оформлению';

export function RewardedAd({reward,onComplete,onCancel}:{reward:AdReward;onComplete:()=>void;onCancel:()=>void}) {
  const [progress,setProgress]=useState(0),done=useRef(false),complete=useRef(onComplete),dialog=useRef<HTMLDivElement>(null);
  complete.current=onComplete;
  useEffect(()=>{
    dialog.current?.focus({preventScroll:true});
    let elapsed=0,last=performance.now();
    const timer=setInterval(()=>{
      const now=performance.now(),dt=Math.min(200,now-last);last=now;
      if(document.hidden)return;
      elapsed+=dt;setProgress(Math.min(1,elapsed/3000));
      if(elapsed>=3000&&!done.current){done.current=true;clearInterval(timer);complete.current();}
    },50);
    return()=>clearInterval(timer);
  },[]);
  return <div className="ad-overlay"><div className="ad-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Имитация рекламы" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onCancel();}if(e.key==='Tab'){e.preventDefault();dialog.current?.querySelector('button')?.focus({preventScroll:true});}}}>
    <span className="eyebrow">ИМИТАЦИЯ РЕКЛАМЫ</span><div className="ad-gift"><Icon name="gift" size={105}/><Icon name="sparkle" size={30}/></div><h1>Маленький бонус</h1><p>{rewardLabel(reward)}</p>
    <div className="ad-bar" role="progressbar" aria-label="Просмотр видео" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span style={{width:`${progress*100}%`}}/></div><span className="ad-countdown">Ещё {Math.max(1,Math.ceil(3-progress*3))} сек.</span>
    <button className="text-button" onClick={onCancel}><Icon name="close" size={15}/> Закрыть без награды</button>
  </div></div>;
}
