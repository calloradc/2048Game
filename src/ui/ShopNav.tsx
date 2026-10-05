import { t } from '../i18n';
import { useLayoutEffect, useRef } from 'react';

export const SHOP_LINKS=[['skins','Персонажи'],['backgrounds','Фоны'],['boxes','Боксы'],['bundles','Наборы'],['supplies','Монеты']] as const;

export function ShopNav({active,onJump}:{active:string;onJump:(id:string)=>void}) {
  const nav=useRef<HTMLElement>(null),pill=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>{
    const el=nav.current!,marker=pill.current!;
    const measure=()=>{
      const button=el.querySelector<HTMLElement>('[aria-current="true"]');if(!button)return;
      marker.style.width=`${button.offsetWidth}px`;
      marker.style.transform=`translate3d(${button.offsetLeft}px,0,0)`;
      marker.dataset.ready='true';
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(el);
    return()=>observer.disconnect();
  },[active,t("Разделы магазина")]);
  return <nav className="shop-nav" ref={nav} aria-label={t("Разделы магазина")}><span className="shop-nav-pill" ref={pill} aria-hidden="true"/>{SHOP_LINKS.map(([id,label])=><button key={id} aria-current={active===id?'true':undefined} onClick={()=>onJump(id)}>{t(label)}</button>)}</nav>;
}
