import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Native touch inertia and snapping; scale is visual and never changes layout. */
export function SnapRail({count,initial=0,current=0,onChange,children}:{count:number;initial?:number;current?:number;onChange:(index:number)=>void;children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),callback=useRef(onChange);
  const go=useRef<(index:number)=>void>(()=>{}),active=useRef(initial);
  callback.current=onChange;
  useLayoutEffect(()=>{
    const el=viewport.current!,row=track.current!,cards=Array.from(row.children) as HTMLElement[];
    let frame=0,drag:{x:number;scroll:number;moved:boolean}|null=null;
    const paint=()=>{
      const centre=el.scrollLeft+el.clientWidth/2;
      let nearest=0,distance=Infinity;
      cards.forEach((card,i)=>{
        const d=Math.abs(card.offsetLeft+card.offsetWidth/2-centre);
        const t=Math.min(1,d/(card.offsetWidth+14));
        card.style.transform=`scale(${1-t*.15})`;
        card.style.opacity=String(1-t*.38);
        card.setAttribute('data-centred',String(d<card.offsetWidth/2));
        if(d<distance){distance=d;nearest=i;}
      });
      if(active.current!==nearest){active.current=nearest;callback.current(nearest);}
      frame=0;
    };
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(paint);};
    const resize=()=>{row.style.paddingInline=`${Math.max(0,(el.clientWidth-cards[0].offsetWidth)/2)}px`;paint();};
    go.current=(i)=>el.scrollTo({left:cards[Math.max(0,Math.min(cards.length-1,i))].offsetLeft-(el.clientWidth-cards[0].offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    el.scrollLeft=cards[initial].offsetLeft-(el.clientWidth-cards[0].offsetWidth)/2;paint();
    const wheel=(e:WheelEvent)=>{e.preventDefault();el.scrollLeft+=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;};
    const down=(e:PointerEvent)=>{if(e.pointerType!=='mouse'||e.button!==0)return;drag={x:e.clientX,scroll:el.scrollLeft,moved:false};};
    const move=(e:PointerEvent)=>{
      if(!drag)return;
      const delta=(e.clientX-drag.x)/(el.getBoundingClientRect().width/el.clientWidth);
      if(Math.abs(delta)>5){drag.moved=true;el.setPointerCapture(e.pointerId);el.style.scrollSnapType='none';}
      if(drag.moved)el.scrollLeft=drag.scroll-delta;
    };
    const up=()=>{if(drag?.moved){el.style.scrollSnapType='';go.current(active.current);}drag=null;};
    el.addEventListener('scroll',scroll,{passive:true});el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',up);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('scroll',scroll);el.removeEventListener('wheel',wheel);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('pointerleave',up);};
  },[count]);
  return <div className="snap-rail"><div className="snap-viewport" ref={viewport} tabIndex={0} aria-label="Карточки магазина. Листай влево или вправо." onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go.current(active.current+(e.key==='ArrowRight'?1:-1));}}}><div className="snap-track" ref={track}>{children}</div></div><button className="shop-arrow prev" aria-label="Предыдущий товар" disabled={current===0} onClick={()=>go.current(active.current-1)}><Icon name="left" size={18}/></button><button className="shop-arrow next" aria-label="Следующий товар" disabled={current===count-1} onClick={()=>go.current(active.current+1)}><Icon name="right" size={18}/></button></div>;
}
