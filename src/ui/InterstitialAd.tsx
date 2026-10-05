import { t } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { asset } from '../game/fruits';

/** The local ad presentation shares the same visible-time rules as rewarded ads. */
export function InterstitialAd({onComplete}:{onComplete:()=>void}) {
  const [elapsed,setElapsed]=useState(0),complete=useRef(onComplete),dialog=useRef<HTMLDivElement>(null);
  complete.current=onComplete;
  useEffect(()=>{
    dialog.current?.focus({preventScroll:true});
    let visibleTime=0,last=performance.now();
    const timer=setInterval(()=>{
      const now=performance.now(),dt=Math.min(200,now-last);last=now;
      if(document.hidden)return;
      visibleTime+=dt;setElapsed(visibleTime);
      if(visibleTime>=5000){clearInterval(timer);complete.current();}
    },50);
    return()=>clearInterval(timer);
  },[]);
  const warning=elapsed<2000;
  return <div className="interstitial-overlay" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={warning?t("Предупреждение о рекламе"):t("Межстраничная реклама")} onKeyDown={e=>{e.stopPropagation();if(e.key==='Tab')e.preventDefault();}}>
    {warning?<div className="interstitial-warning"><span className="eyebrow">{t("КОРОТКАЯ ПАУЗА")}</span><h1>{t("Сейчас будет реклама")}</h1><div className="interstitial-seconds" aria-live="polite">{Math.max(1,Math.ceil((2000-elapsed)/1000))}</div><p>{t("После неё вернёмся к результатам игры")}</p></div>:<div className="interstitial-creative"><img src={asset("cover-wide.webp")} alt={t("Фруктовая семья Jelly Fruit")}/><div><span className="eyebrow">{t("ДЕМОНСТРАЦИОННАЯ РЕКЛАМА")}</span><h1>{t("Ещё немного сочного настроения")}</h1><p>{t("Вернёмся к урожаю через {n} сек.",{n:Math.max(1,Math.ceil((5000-elapsed)/1000))})}</p></div></div>}
  </div>;
}
