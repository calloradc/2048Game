import { Children, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** One finite row: end padding lets the first and last photo reach the centre. */
export function SnapRail({count,initial=0,current=0,onChange,children}:{count:number;initial?:number;current?:number;onChange:(index:number)=>void;children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),callback=useRef(onChange);
  const go=useRef<(index:number)=>void>(()=>{}),active=useRef(initial);
  callback.current=onChange;

  useLayoutEffect(()=>{
    const el=viewport.current!,row=track.current!,cards=Array.from(row.children) as HTMLElement[];
    if(!cards.length)return;
    const clamp=(index:number)=>Math.max(0,Math.min(count-1,index));
    let frame=0,pending:number|null=null,drag:{x:number;scroll:number;moved:boolean}|null=null,suppressClick=false;
    const target=(index:number)=>cards[index].offsetLeft-(el.clientWidth-cards[index].offsetWidth)/2;
    const paint=()=>{
      frame=0;
      const centre=el.scrollLeft+el.clientWidth/2;
      const step=cards.length>1?cards[1].offsetLeft-cards[0].offsetLeft:cards[0].offsetWidth;
      let nearest=0,distance=Infinity;
      cards.forEach((card,index)=>{
        const d=Math.abs(card.offsetLeft+card.offsetWidth/2-centre),t=Math.min(2.5,d/step);
        card.style.transform=`translateY(${Math.min(18,t*12)}px) scale(${Math.max(.55,1-t*.25)})`;
        card.style.opacity=String(Math.max(.35,1-t*.23));
        card.dataset.centred=String(d<step/2);
        if(d<distance){distance=d;nearest=index;}
      });
      if(pending!==null&&Math.abs(el.scrollLeft-target(pending))<2)pending=null;
      if(pending===null&&active.current!==nearest){active.current=nearest;callback.current(nearest);}
    };
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(paint);};
    const resize=()=>{
      row.style.paddingInline=`${Math.max(0,(el.clientWidth-cards[0].offsetWidth)/2)}px`;
      el.scrollTo({left:target(clamp(pending??active.current)),behavior:'instant'});
      paint();
    };
    go.current=(index)=>{
      pending=clamp(index);
      el.scrollTo({left:target(pending),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      scroll();
    };
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const wheel=(e:WheelEvent)=>{
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)&&!e.shiftKey)return;
      e.preventDefault();pending=null;
      const unit=e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1;
      el.scrollLeft+=(e.shiftKey?e.deltaY:e.deltaX)*unit;
    };
    const down=(e:PointerEvent)=>{
      pending=null;suppressClick=false;
      // Cancel a running smooth scroll before direct manipulation.
      el.scrollTo({left:el.scrollLeft,behavior:'instant'});
      if(e.pointerType==='mouse'&&e.button===0)drag={x:e.clientX,scroll:el.scrollLeft,moved:false};
    };
    const move=(e:PointerEvent)=>{
      if(!drag)return;
      const delta=(e.clientX-drag.x)/(el.getBoundingClientRect().width/el.clientWidth);
      if(Math.abs(delta)>5){drag.moved=true;el.setPointerCapture(e.pointerId);el.style.scrollSnapType='none';}
      if(drag.moved)el.scrollLeft=drag.scroll-delta;
    };
    const up=(e:PointerEvent)=>{
      if(drag?.moved){
        paint();suppressClick=true;el.style.scrollSnapType='';go.current(active.current);
        if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
      }
      drag=null;
    };
    const click=(e:MouseEvent)=>{
      if(suppressClick){suppressClick=false;return;}
      const card=(e.target as HTMLElement).closest<HTMLElement>('[data-rail-index]');
      if(card)go.current(Number(card.dataset.railIndex));
    };
    el.addEventListener('scroll',scroll,{passive:true});el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('click',click);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('scroll',scroll);el.removeEventListener('wheel',wheel);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('click',click);};
  },[count]);
  useLayoutEffect(()=>{if(current!==active.current)go.current(current);},[current]);

  return <div className="snap-rail">
    <div className="snap-viewport" ref={viewport} tabIndex={0} role="region" aria-roledescription="карусель" aria-label="Карточки. Листай влево или вправо." onKeyDown={e=>{
      if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){
        e.preventDefault();
        go.current(e.key==='Home'?0:e.key==='End'?count-1:current+(e.key==='ArrowRight'?1:-1));
      }
    }}>
      <div className="snap-track" ref={track}>{Children.toArray(children).map((item,index)=><div className="rail-card" data-rail-index={index} key={index} role="group" aria-roledescription="карточка" aria-label={`${index+1} из ${count}`} aria-current={current===index?'true':undefined}>{item}</div>)}</div>
    </div>
    <button className="shop-arrow prev" aria-label="Предыдущий товар" disabled={current<=0} onClick={()=>go.current(current-1)}><Icon name="left" size={23}/></button>
    <button className="shop-arrow next" aria-label="Следующий товар" disabled={current>=count-1} onClick={()=>go.current(current+1)}><Icon name="right" size={23}/></button>
  </div>;
}
