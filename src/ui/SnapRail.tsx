import { Children, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
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
    const visuals=cards.map(card=>card.querySelector<HTMLElement>('.rail-card-visual')!);
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,pending:number|null=null,drag:{x:number;scroll:number;ratio:number;moved:boolean}|null=null,suppressClick=false;
    let settleTimer:ReturnType<typeof setTimeout>|undefined;
    let wheelUntil=0;
    let centres:number[]=[],width=0,step=1;
    const target=(index:number)=>centres[index]-width/2;
    const nearestTo=(position:number)=>centres.reduce((best,centre,index)=>Math.abs(centre-position)<Math.abs(centres[best]-position)?index:best,0);
    const select=(index:number)=>{if(active.current!==index){active.current=index;callback.current(index);}};
    const paint=()=>{
      frame=0;
      const centre=el.scrollLeft+width/2;
      cards.forEach((card,index)=>{
        const offset=(centres[index]-centre)/step,t=Math.min(2.5,Math.abs(offset));
        // Snap targets keep their original geometry; only the photo moves.
        visuals[index].style.transform=`translate3d(0,${Math.min(16,t*t*9)}px,0) rotate(${reducedMotion.matches?0:Math.max(-3,Math.min(3,offset*2.4))}deg) scale(${1-Math.min(.45,t*t*.18)})`;
        visuals[index].style.opacity=String(Math.max(.4,1-t*t*.18));
        const centred=String(Math.abs(offset)<.5),nearby=String(t<1.8);
        if(card.dataset.centred!==centred)card.dataset.centred=centred;
        if(card.dataset.nearby!==nearby)card.dataset.nearby=nearby;
      });
      if(pending!==null&&Math.abs(el.scrollLeft-target(pending))<1){pending=null;el.style.scrollSnapType='';}
      if(pending===null)select(nearestTo(centre));
    };
    const settle=()=>{
      clearTimeout(settleTimer);
      if(drag)return;
      if(performance.now()<wheelUntil){settleTimer=setTimeout(settle,wheelUntil-performance.now());return;}
      if(pending===null&&el.style.scrollSnapType!=='none'){paint();return;}
      const index=pending??nearestTo(el.scrollLeft+width/2);
      if(Math.abs(el.scrollLeft-target(index))>1)go.current(index);
      else {pending=null;el.style.scrollSnapType='';paint();}
    };
    const scroll=()=>{
      if(!frame)frame=requestAnimationFrame(paint);
      clearTimeout(settleTimer);settleTimer=setTimeout(settle,160);
    };
    const resize=()=>{
      width=el.clientWidth;
      const cardWidth=cards[0].offsetWidth;
      row.style.paddingInline=`${Math.max(0,(width-cardWidth)/2)}px`;
      // Read layout once, before the animation frame writes any styles.
      centres=cards.map(card=>card.offsetLeft+card.offsetWidth/2);
      step=centres.length>1?centres[1]-centres[0]:cardWidth;
      el.scrollTo({left:target(clamp(pending??active.current)),behavior:'instant'});
      paint();
    };
    go.current=(index)=>{
      pending=clamp(index);select(pending);
      // Let the smooth scroll finish before restoring native snapping.
      el.style.scrollSnapType='none';
      el.scrollTo({left:target(pending),behavior:reducedMotion.matches?'instant':'smooth'});
      scroll();
    };
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const wheel=(e:WheelEvent)=>{
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)&&!e.shiftKey)return;
      e.preventDefault();pending=null;
      wheelUntil=performance.now()+160;
      el.style.scrollSnapType='none';
      const unit=e.deltaMode===1?16:e.deltaMode===2?width:1;
      el.scrollLeft+=(e.shiftKey?e.deltaY:e.deltaX)*unit;
      scroll();
    };
    const down=(e:PointerEvent)=>{
      clearTimeout(settleTimer);wheelUntil=0;pending=null;suppressClick=false;
      // Cancel a running smooth scroll before direct manipulation.
      el.scrollTo({left:el.scrollLeft,behavior:'instant'});
      el.style.scrollSnapType='';
      if(e.pointerType==='mouse'&&e.button===0)drag={x:e.clientX,scroll:el.scrollLeft,ratio:el.getBoundingClientRect().width/width,moved:false};
    };
    const move=(e:PointerEvent)=>{
      if(!drag)return;
      const delta=(e.clientX-drag.x)/drag.ratio;
      if(Math.abs(delta)>5){drag.moved=true;el.setPointerCapture(e.pointerId);el.style.scrollSnapType='none';}
      if(drag.moved)el.scrollLeft=drag.scroll-delta;
    };
    const up=(e:PointerEvent)=>{
      const moved=drag?.moved;drag=null;
      if(moved){
        paint();suppressClick=true;go.current(nearestTo(el.scrollLeft+width/2));
        if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);
      }
    };
    const click=(e:MouseEvent)=>{
      if(suppressClick){suppressClick=false;return;}
      const card=(e.target as HTMLElement).closest<HTMLElement>('[data-rail-index]');
      if(card)go.current(Number(card.dataset.railIndex));
    };
    el.addEventListener('scroll',scroll,{passive:true});el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('scrollend',settle);
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('click',click);
    return()=>{cancelAnimationFrame(frame);clearTimeout(settleTimer);observer.disconnect();el.removeEventListener('scroll',scroll);el.removeEventListener('scrollend',settle);el.removeEventListener('wheel',wheel);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('click',click);};
  },[count]);
  useLayoutEffect(()=>{if(current!==active.current)go.current(current);},[current]);

  return <div className="snap-rail">
    <div className="snap-viewport" ref={viewport} tabIndex={0} role="region" aria-roledescription="карусель" aria-label="Карточки. Листай влево или вправо." onKeyDown={e=>{
      if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){
        e.preventDefault();
        go.current(e.key==='Home'?0:e.key==='End'?count-1:current+(e.key==='ArrowRight'?1:-1));
      }
    }}>
      <div className="snap-track" ref={track}>{Children.toArray(children).map((item,index)=><div className="rail-card" data-rail-index={index} key={index} style={{'--rail-index':index} as CSSProperties} role="group" aria-roledescription="карточка" aria-label={`${index+1} из ${count}`} aria-current={current===index?'true':undefined}><div className="rail-card-visual"><div className="rail-card-arrival">{item}</div></div></div>)}</div>
    </div>
    <button className="shop-arrow prev" aria-label="Предыдущий товар" disabled={current<=0} onClick={()=>go.current(current-1)}><Icon name="left" size={23}/></button>
    <button className="shop-arrow next" aria-label="Следующий товар" disabled={current>=count-1} onClick={()=>go.current(current+1)}><Icon name="right" size={23}/></button>
  </div>;
}
