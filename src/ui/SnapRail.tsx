import { Children, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Native touch inertia, with one cancellable animation only after a gesture ends. */
export function SnapRail({count,initial=0,current=0,onChange,children}:{count:number;initial?:number;current?:number;onChange:(index:number)=>void;children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),callback=useRef(onChange);
  const go=useRef<(index:number)=>void>(()=>{}),active=useRef(initial);
  callback.current=onChange;

  useLayoutEffect(()=>{
    const el=viewport.current!,row=track.current!,cards=Array.from(row.children) as HTMLElement[];
    if(!cards.length)return;
    const visuals=cards.map(card=>card.querySelector<HTMLElement>('.rail-card-visual')!);
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0,animation:{from:number;to:number;start:number;duration:number}|null=null;
    let drag:{x:number;scroll:number;ratio:number;moved:boolean}|null=null,touching=false,suppressClick=false;
    let settleTimer:ReturnType<typeof setTimeout>|undefined,wheelUntil=0;
    let centres:number[]=[],width=0,step=1;
    const clamp=(index:number)=>Math.max(0,Math.min(count-1,index));
    const target=(index:number)=>centres[index]-width/2;
    const nearest=()=>centres.reduce((best,centre,index)=>Math.abs(centre-el.scrollLeft-width/2)<Math.abs(centres[best]-el.scrollLeft-width/2)?index:best,0);
    const select=(index:number)=>{if(active.current!==index){active.current=index;callback.current(index);}};
    const paint=()=>{
      const centre=el.scrollLeft+width/2;
      cards.forEach((card,index)=>{
        const offset=(centres[index]-centre)/step,t=Math.min(2.5,Math.abs(offset));
        visuals[index].style.transform=`translate3d(0,${Math.min(16,t*t*9)}px,0) rotate(${reducedMotion.matches?0:Math.max(-3,Math.min(3,offset*2.4))}deg) scale(${1-Math.min(.45,t*t*.18)})`;
        // Keep alpha and compositor layers stable during rapid direction changes.
        const centred=String(Math.abs(offset)<.5);
        if(card.dataset.centred!==centred)card.dataset.centred=centred;
      });
    };
    const finish=()=>{
      animation=null;el.dataset.moving='false';
      select(nearest());paint();
    };
    const tick=(now:number)=>{
      frame=0;
      if(animation){
        const t=Math.min(1,(now-animation.start)/animation.duration),ease=1-Math.pow(1-t,3);
        el.scrollLeft=animation.from+(animation.to-animation.from)*ease;
        if(t===1)finish();
      }
      paint();
      if(animation)frame=requestAnimationFrame(tick);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(tick);};
    const cancel=()=>{
      clearTimeout(settleTimer);animation=null;wheelUntil=0;
      el.dataset.moving='true';
      // Snapping stays disabled throughout direct manipulation and settling.
    };
    go.current=(index)=>{
      cancel();const next=clamp(index),from=el.scrollLeft,to=target(next);
      select(next);
      if(reducedMotion.matches||Math.abs(from-to)<.5){el.scrollLeft=to;finish();return;}
      animation={from,to,start:performance.now(),duration:Math.min(340,160+Math.abs(to-from)*.3)};
      schedule();
    };
    const settle=()=>{
      clearTimeout(settleTimer);
      if(touching||drag||animation)return;
      const remaining=wheelUntil-performance.now();
      if(remaining>0){settleTimer=setTimeout(settle,remaining);return;}
      go.current(nearest());
    };
    const scroll=()=>{
      schedule();
      if(!animation&&!touching&&!drag){clearTimeout(settleTimer);settleTimer=setTimeout(settle,180);}
    };
    const resize=()=>{
      cancel();width=el.clientWidth;
      const cardWidth=cards[0].offsetWidth;
      row.style.paddingInline=`${Math.max(0,(width-cardWidth)/2)}px`;
      centres=cards.map(card=>card.offsetLeft+card.offsetWidth/2);
      step=centres.length>1?centres[1]-centres[0]:cardWidth;
      el.scrollLeft=target(clamp(active.current));finish();
    };
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const visibility=new IntersectionObserver(entries=>{el.dataset.visible=String(entries[0].isIntersecting);},{threshold:0});visibility.observe(el);
    const wheel=(event:WheelEvent)=>{
      if(Math.abs(event.deltaX)<=Math.abs(event.deltaY)&&!event.shiftKey)return;
      event.preventDefault();cancel();wheelUntil=performance.now()+180;
      const unit=event.deltaMode===1?16:event.deltaMode===2?width:1;
      el.scrollLeft+=(event.shiftKey?event.deltaY:event.deltaX)*unit;
      scroll();
    };
    const down=(event:PointerEvent)=>{
      cancel();suppressClick=false;
      if(event.pointerType==='mouse'&&event.button===0)drag={x:event.clientX,scroll:el.scrollLeft,ratio:el.getBoundingClientRect().width/width,moved:false};
    };
    const move=(event:PointerEvent)=>{
      if(!drag)return;
      const delta=(event.clientX-drag.x)/drag.ratio;
      if(Math.abs(delta)>5&&!drag.moved){drag.moved=true;el.setPointerCapture(event.pointerId);}
      if(drag.moved){el.scrollLeft=drag.scroll-delta;schedule();}
    };
    const up=(event:PointerEvent)=>{
      const moved=drag?.moved;drag=null;
      if(moved){suppressClick=true;go.current(nearest());if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);}
    };
    const touchStart=()=>{touching=true;cancel();};
    const touchEnd=()=>{touching=false;clearTimeout(settleTimer);settleTimer=setTimeout(settle,180);};
    const click=(event:MouseEvent)=>{
      if(suppressClick){suppressClick=false;return;}
      const card=(event.target as HTMLElement).closest<HTMLElement>('[data-rail-index]');
      if(card)go.current(Number(card.dataset.railIndex));
    };
    el.addEventListener('scroll',scroll,{passive:true});el.addEventListener('scrollend',settle);
    el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('click',click);
    el.addEventListener('touchstart',touchStart,{passive:true});el.addEventListener('touchend',touchEnd,{passive:true});el.addEventListener('touchcancel',touchEnd,{passive:true});
    return()=>{
      cancelAnimationFrame(frame);clearTimeout(settleTimer);observer.disconnect();visibility.disconnect();
      el.removeEventListener('scroll',scroll);el.removeEventListener('scrollend',settle);el.removeEventListener('wheel',wheel);
      el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('click',click);
      el.removeEventListener('touchstart',touchStart);el.removeEventListener('touchend',touchEnd);el.removeEventListener('touchcancel',touchEnd);
    };
  },[count]);
  useLayoutEffect(()=>{if(current!==active.current)go.current(current);},[current]);

  return <div className="snap-rail" data-reveal>
    <div className="snap-viewport" ref={viewport} tabIndex={0} role="region" aria-roledescription="карусель" aria-label="Карточки. Листай влево или вправо." onKeyDown={event=>{
      if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){
        event.preventDefault();go.current(event.key==='Home'?0:event.key==='End'?count-1:active.current+(event.key==='ArrowRight'?1:-1));
      }
    }}>
      <div className="snap-track" ref={track}>{Children.toArray(children).map((item,index)=><div className="rail-card" data-rail-index={index} key={index} style={{'--rail-index':index} as CSSProperties} role="group" aria-roledescription="карточка" aria-label={`${index+1} из ${count}`} aria-current={current===index?'true':undefined}><div className="rail-card-visual"><div className="rail-card-wave">{item}</div></div></div>)}</div>
    </div>
    <button className="shop-arrow prev" aria-label="Предыдущий товар" disabled={current<=0} onClick={()=>go.current(active.current-1)}><Icon name="right" size={23}/></button>
    <button className="shop-arrow next" aria-label="Следующий товар" disabled={current>=count-1} onClick={()=>go.current(active.current+1)}><Icon name="right" size={23}/></button>
  </div>;
}
