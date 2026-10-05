import { t } from '../i18n';
import { Children, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';
import { getReducedMotion, subscribeMotion } from './motion';

/** Deliberate, one-card swipes with vertical gestures delegated to the page. */
export function SnapRail({count,initial=0,current=0,onChange,onActivate,children}:{count:number;initial?:number;current?:number;onChange:(index:number)=>void;onActivate:(index:number)=>void;children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),callback=useRef(onChange);
  const go=useRef<(index:number)=>void>(()=>{}),active=useRef(initial);
  const activate=useRef(onActivate);callback.current=onChange;activate.current=onActivate;

  useLayoutEffect(()=>{
    const el=viewport.current!,row=track.current!,cards=Array.from(row.children) as HTMLElement[];
    if(!cards.length)return;
    const visuals=cards.map(card=>card.querySelector<HTMLElement>('.rail-card-visual')!);
    let frame=0,animation:{from:number;to:number;start:number;duration:number}|null=null;
    let drag:{x:number;y:number;scroll:number;ratio:number;moved:boolean;index:number}|null=null,suppressClick=false;
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
        visuals[index].style.transform=`translate3d(0,${Math.min(16,t*t*9)}px,0) rotate(${getReducedMotion()?0:Math.max(-3,Math.min(3,offset*2.4))}deg) scale(${1-Math.min(.45,t*t*.18)})`;
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
      if(getReducedMotion()||Math.abs(from-to)<.5){el.scrollLeft=to;finish();return;}
      animation={from,to,start:performance.now(),duration:Math.min(650,440+Math.abs(to-from)*.25)};
      schedule();
    };
    const settle=()=>{
      clearTimeout(settleTimer);
      if(drag||animation)return;
      const remaining=wheelUntil-performance.now();
      if(remaining>0){settleTimer=setTimeout(settle,remaining);return;}
      go.current(nearest());
    };
    const scroll=()=>{
      schedule();
      if(!animation&&!drag){clearTimeout(settleTimer);settleTimer=setTimeout(settle,180);}
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
    const unsubscribeMotion=subscribeMotion(()=>{
      if(getReducedMotion()&&animation){el.scrollLeft=animation.to;finish();}
      paint();
    });
    const visibility=new IntersectionObserver(entries=>{el.dataset.visible=String(entries[0].isIntersecting);},{threshold:0});visibility.observe(el);
    const wheel=(event:WheelEvent)=>{
      if(Math.abs(event.deltaX)<=Math.abs(event.deltaY)&&!event.shiftKey)return;
      event.preventDefault();cancel();wheelUntil=performance.now()+180;
      const unit=event.deltaMode===1?16:event.deltaMode===2?width:1;
      el.scrollLeft+=(event.shiftKey?event.deltaY:event.deltaX)*unit*.55;
      scroll();
    };
    const down=(event:PointerEvent)=>{
      if(!event.isPrimary||event.pointerType==='mouse'&&event.button!==0)return;
      cancel();suppressClick=false;
      drag={x:event.clientX,y:event.clientY,scroll:el.scrollLeft,ratio:el.getBoundingClientRect().width/width,moved:false,index:nearest()};
    };
    const move=(event:PointerEvent)=>{
      if(!drag)return;
      if(!drag.moved&&Math.abs(event.clientY-drag.y)>Math.abs(event.clientX-drag.x)&&Math.abs(event.clientY-drag.y)>6){drag=null;finish();return;}
      const delta=(event.clientX-drag.x)/drag.ratio;
      if(Math.abs(delta)>5&&!drag.moved){drag.moved=true;el.setPointerCapture(event.pointerId);}
      if(drag.moved){event.preventDefault();el.scrollLeft=drag.scroll-Math.max(-step,Math.min(step,delta*.72));schedule();}
    };
    const up=(event:PointerEvent)=>{
      const gesture=drag;drag=null;
      if(gesture?.moved){
        suppressClick=true;const delta=(gesture.x-event.clientX)/gesture.ratio;
        go.current(event.type==='pointercancel'?gesture.index:gesture.index+(Math.abs(delta)>step*.18?Math.sign(delta):0));
        if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);
      } else finish();
    };
    const click=(event:MouseEvent)=>{
      if(suppressClick){suppressClick=false;event.preventDefault();event.stopPropagation();return;}
      const card=(event.target as HTMLElement).closest<HTMLElement>('[data-rail-index]');
      if(card){const index=Number(card.dataset.railIndex);go.current(index);activate.current?.(index);}
    };
    el.addEventListener('scroll',scroll,{passive:true});el.addEventListener('scrollend',settle);
    el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('click',click);
    return()=>{
      cancelAnimationFrame(frame);clearTimeout(settleTimer);observer.disconnect();visibility.disconnect();
      unsubscribeMotion();
      el.removeEventListener('scroll',scroll);el.removeEventListener('scrollend',settle);el.removeEventListener('wheel',wheel);
      el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('click',click);
    };
  },[count]);
  useLayoutEffect(()=>{if(current!==active.current)go.current(current);},[current]);

  return <div className="snap-rail" data-reveal>
    <div className="snap-viewport" ref={viewport} tabIndex={0} role="region" aria-roledescription={t("карусель")} aria-label={t("Карточки. Листай влево или вправо.")} onKeyDown={event=>{
      if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){
        event.preventDefault();go.current(event.key==='Home'?0:event.key==='End'?count-1:active.current+(event.key==='ArrowRight'?1:-1));
      }
      if(event.key==='Enter'||event.key===' '){event.preventDefault();activate.current?.(active.current);}
    }}>
      <div className="snap-track" ref={track}>{Children.toArray(children).map((item,index)=><div className="rail-card" data-rail-index={index} key={index} style={{'--rail-index':index} as CSSProperties} role="group" aria-roledescription={t("карточка")} aria-label={t("{n} из {total}",{n:index+1,total:count})} aria-current={current===index?'true':undefined}><div className="rail-card-visual"><div className="rail-card-wave">{item}</div></div></div>)}</div>
    </div>
    <button className="shop-arrow prev" aria-label={t("Предыдущий товар")} disabled={current<=0} onClick={()=>go.current(active.current-1)}><Icon name="right" size={23}/></button>
    <button className="shop-arrow next" aria-label={t("Следующий товар")} disabled={current>=count-1} onClick={()=>go.current(active.current+1)}><Icon name="right" size={23}/></button>
  </div>;
}
