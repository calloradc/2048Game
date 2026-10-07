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
    let drag:{pointerId:number;pointerType:string;startX:number;startY:number;startScroll:number;ratio:number;moved:boolean;startIndex:number;lastX:number;lastTime:number;velocity:number}|null=null,suppressClick=false;
    let settleTimer:ReturnType<typeof setTimeout>|undefined,wheelUntil=0;
    let centres:number[]=[],width=0,step=1;
    const clamp=(index:number)=>Math.max(0,Math.min(count-1,index));
    const target=(index:number)=>centres[index]-width/2;
    const nearestTo=(scroll:number)=>centres.reduce((best,centre,index)=>Math.abs(centre-scroll-width/2)<Math.abs(centres[best]-scroll-width/2)?index:best,0);
    const nearest=()=>nearestTo(el.scrollLeft);
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
      if(!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
      cancel();suppressClick=false;
      const rect=el.getBoundingClientRect();
      const ratio=rect.width>0&&width>0?rect.width/width:1;
      drag={
        pointerId:event.pointerId,
        pointerType:event.pointerType,
        startX:event.clientX,
        startY:event.clientY,
        startScroll:el.scrollLeft,
        ratio,
        moved:false,
        startIndex:nearest(),
        lastX:event.clientX,
        lastTime:performance.now(),
        velocity:0,
      };
    };
    const move=(event:PointerEvent)=>{
      if(!drag||drag.pointerId!==event.pointerId)return;
      const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
      if(!drag.moved){
        if(drag.pointerType!=='mouse'&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>6){drag=null;finish();return;}
        if(Math.abs(dx)<5)return;
        drag.moved=true;el.dataset.moving='true';
        try{el.setPointerCapture(event.pointerId);}catch{}
      }
      event.preventDefault();
      const now=performance.now();
      const dt=Math.max(1,now-drag.lastTime);
      const stepDx=event.clientX-drag.lastX;
      const instantV=stepDx/dt;
      drag.velocity=drag.velocity*0.25+instantV*0.75;
      drag.lastX=event.clientX;
      drag.lastTime=now;

      const deltaScroll=-dx/drag.ratio;
      const rawScroll=drag.startScroll+deltaScroll;
      const minScroll=target(0),maxScroll=target(count-1);
      let scrollPos=rawScroll;
      if(rawScroll<minScroll){
        const over=minScroll-rawScroll;
        scrollPos=minScroll-over*0.35;
      }else if(rawScroll>maxScroll){
        const over=rawScroll-maxScroll;
        scrollPos=maxScroll+over*0.35;
      }
      el.scrollLeft=scrollPos;
      paint();
      schedule();
    };
    const release=(event:PointerEvent,cancelled:boolean)=>{
      const gesture=drag;
      if(!gesture||gesture.pointerId!==event.pointerId)return;
      drag=null;
      try{if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);}catch{}
      if(!gesture.moved){finish();return;}
      suppressClick=true;
      if(cancelled){go.current(gesture.startIndex);return;}

      const timeSinceMove=performance.now()-gesture.lastTime;
      const effectiveV=timeSinceMove>90?0:gesture.velocity;
      const flickOffset=-(effectiveV/gesture.ratio)*160;
      const projectedScroll=el.scrollLeft+flickOffset;
      let targetIndex=clamp(nearestTo(projectedScroll));

      const totalDelta=el.scrollLeft-gesture.startScroll;
      if(Math.abs(effectiveV)>0.3){
        const flickDir=effectiveV<0?1:-1;
        if(flickDir>0&&targetIndex<=gesture.startIndex)targetIndex=clamp(gesture.startIndex+1);
        if(flickDir<0&&targetIndex>=gesture.startIndex)targetIndex=clamp(gesture.startIndex-1);
      }else if(targetIndex===gesture.startIndex&&Math.abs(totalDelta)>step*0.18){
        const dragDir=Math.sign(totalDelta);
        targetIndex=clamp(gesture.startIndex+dragDir);
      }
      go.current(targetIndex);
    };
    const onUp=(e:PointerEvent)=>release(e,false);
    const onCancel=(e:PointerEvent)=>release(e,true);
    const onLostCapture=(e:PointerEvent)=>release(e,false);
    const onWindowUp=(e:PointerEvent)=>{if(drag&&drag.pointerId===e.pointerId)release(e,false);};
    const onWindowCancel=(e:PointerEvent)=>{if(drag&&drag.pointerId===e.pointerId)release(e,true);};
    const click=(event:MouseEvent)=>{
      if(suppressClick){suppressClick=false;event.preventDefault();event.stopPropagation();return;}
      const card=(event.target as HTMLElement).closest<HTMLElement>('[data-rail-index]');
      if(card){const index=Number(card.dataset.railIndex);go.current(index);activate.current?.(index);}
    };
    el.addEventListener('scroll',scroll,{passive:true});el.addEventListener('scrollend',settle);
    el.addEventListener('wheel',wheel,{passive:false});
    el.addEventListener('pointerdown',down);
    el.addEventListener('pointermove',move);
    el.addEventListener('pointerup',onUp);
    el.addEventListener('pointercancel',onCancel);
    el.addEventListener('lostpointercapture',onLostCapture);
    window.addEventListener('pointerup',onWindowUp);
    window.addEventListener('pointercancel',onWindowCancel);
    el.addEventListener('click',click);
    return()=>{
      cancelAnimationFrame(frame);clearTimeout(settleTimer);observer.disconnect();visibility.disconnect();
      unsubscribeMotion();
      el.removeEventListener('scroll',scroll);el.removeEventListener('scrollend',settle);el.removeEventListener('wheel',wheel);
      el.removeEventListener('pointerdown',down);
      el.removeEventListener('pointermove',move);
      el.removeEventListener('pointerup',onUp);
      el.removeEventListener('pointercancel',onCancel);
      el.removeEventListener('lostpointercapture',onLostCapture);
      window.removeEventListener('pointerup',onWindowUp);
      window.removeEventListener('pointercancel',onWindowCancel);
      el.removeEventListener('click',click);
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
