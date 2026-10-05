import { useLayoutEffect, useRef, useState } from 'react';
import { itemByKey, itemPreview } from '../game/catalog';
import { BUNDLES, bundleOffer } from '../game/commerce';
import type { Profile } from '../game/profile';
import { asset } from '../game/fruits';
import { ElasticScroll } from './ElasticScroll';
import { Icon } from './Icon';
import { PreviewImage } from './PreviewImage';

export function OfferCarousel({profile,onOpen}:{profile:Profile;onOpen:()=>void}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),motion=useRef<ElasticScroll|null>(null);
  const active=useRef(0),held=useRef(false),lastInput=useRef(0);
  const [index,setIndex]=useState(0);
  const go=(next:number)=>{active.current=(next+BUNDLES.length)%BUNDLES.length;setIndex(active.current);motion.current?.scrollTo(active.current*viewport.current!.clientWidth);};
  useLayoutEffect(()=>{
    const el=viewport.current!,row=track.current!;
    const scroll=new ElasticScroll(el,row,()=>{},{onInterrupt:()=>{lastInput.current=performance.now();},onSettled:()=>{
      const next=Math.round(el.scrollLeft/el.clientWidth);active.current=next;setIndex(next);
      if(Math.abs(el.scrollLeft-next*el.clientWidth)>.5)scroll.scrollTo(next*el.clientWidth);
    }});motion.current=scroll;
    const resize=new ResizeObserver(()=>{row.style.setProperty('--offer-width',`${el.clientWidth}px`);scroll.scrollTo(active.current*el.clientWidth,true);});resize.observe(el);
    const down=()=>{held.current=true;lastInput.current=performance.now();},up=()=>{held.current=false;lastInput.current=performance.now();};
    el.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
    let visible=false;const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(el);
    const timer=setInterval(()=>{
      if(!visible||held.current||document.hidden||document.querySelector('.contents-overlay')||el.closest('[inert]')||performance.now()-lastInput.current<4500||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      go(active.current+1);
    },4500);
    return()=>{clearInterval(timer);resize.disconnect();observer.disconnect();scroll.destroy();motion.current=null;el.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);};
  },[]);
  const manual=(next:number)=>{lastInput.current=performance.now();go(next);};
  return <section className="shop-offers" data-reveal aria-label="Предложения магазина">
    <div className="offer-viewport" ref={viewport} tabIndex={0} aria-roledescription="карусель"><div className="offer-track" ref={track}>{BUNDLES.map(bundle=>{
      const deal=bundleOffer(profile,bundle);
      return <button className="shop-feature" key={bundle.id} onClick={onOpen} aria-label={`Смотреть ${bundle.name}`}><span className="sale-ribbon">{deal.bought?'СОБРАН':'ВЫГОДНО'}</span><div className="feature-copy"><span className="offer-tag">ПРЕДЛОЖЕНИЕ {BUNDLES.indexOf(bundle)+1} / {BUNDLES.length}</span><h2>{bundle.name}</h2><span>3 образа + {bundle.shakes} встряски</span><span className="feature-price">{deal.bought?'В коллекции':<><img src={asset('particles/11.webp')} alt=""/>{deal.price}</>}</span></div><PreviewImage className="feature-mascot" src={itemPreview(itemByKey(bundle.items[0])!)} eager/></button>;
    })}</div></div>
    <div className="offer-controls"><button aria-label="Предыдущее предложение" onClick={()=>manual(active.current-1)}><Icon name="right" size={18}/></button><div>{BUNDLES.map((bundle,i)=><button key={bundle.id} aria-label={`Предложение ${i+1}`} aria-pressed={i===index} onClick={()=>manual(i)}><span/></button>)}</div><button aria-label="Следующее предложение" onClick={()=>manual(active.current+1)}><Icon name="right" size={18}/></button></div>
  </section>;
}
