import { Children, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/** Three copies keep two neighbours visible even when the first item is selected. */
export function SnapRail({count,initial=0,current=0,onChange,children}:{count:number;initial?:number;current?:number;onChange:(index:number)=>void;children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),callback=useRef(onChange);
  const go=useRef<(index:number)=>void>(()=>{}),active=useRef(initial),physical=useRef(count+initial);
  callback.current=onChange;
  useLayoutEffect(()=>{
    const el=viewport.current!,row=track.current!,cards=Array.from(row.children) as HTMLElement[];
    let frame=0,pending:number|null=null,drag:{x:number;scroll:number;moved:boolean}|null=null,suppressClick=false;
    const target=(i:number)=>cards[i].offsetLeft-(el.clientWidth-cards[i].offsetWidth)/2;
    const paint=()=>{
      frame=0;
      const centre=el.scrollLeft+el.clientWidth/2,step=cards[1].offsetLeft-cards[0].offsetLeft;
      let nearest=0,distance=Infinity;
      cards.forEach((card,i)=>{
        const d=Math.abs(card.offsetLeft+card.offsetWidth/2-centre),t=d/step;
        card.style.transform=`translateY(${Math.min(22,t*7)}px) scale(${Math.max(.4,1-t*.24)})`;
        card.style.opacity=String(Math.max(.25,1-t*.21));
        card.style.zIndex=String(100-Math.round(t*10));
        card.dataset.centred=String(d<step/2);
        card.setAttribute('aria-hidden',String(d>=step/2));
        if(d<distance){distance=d;nearest=i;}
      });
      physical.current=nearest;
      if(pending!==null&&Math.abs(el.scrollLeft-target(pending))<1){pending=null;el.style.scrollSnapType='';}
      if(pending===null){
        const index=nearest%count;
        if(active.current!==index){active.current=index;callback.current(index);}
        if(distance<1&&(nearest<count||nearest>=count*2)){
          const middle=count+index;el.scrollTo({left:target(middle),behavior:'instant'});physical.current=middle;paint();return;
        }
      }
    };
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(paint);};
    const resize=()=>{
      row.style.paddingInline=`${Math.max(0,(el.clientWidth-cards[0].offsetWidth)/2)}px`;
      el.scrollTo({left:target(pending??physical.current),behavior:'instant'});paint();
    };
    go.current=(index)=>{
      const logical=(index%count+count)%count;
      pending=[logical,count+logical,count*2+logical].reduce((best,i)=>Math.abs(i-physical.current)<Math.abs(best-physical.current)?i:best,count+logical);
      el.style.scrollSnapType='none';el.scrollTo({left:el.scrollLeft,behavior:'instant'});
      el.scrollTo({left:target(pending),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});scroll();
    };
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const wheel=(e:WheelEvent)=>{
      if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)&&!e.shiftKey)return;
      e.preventDefault();pending=null;el.style.scrollSnapType='';el.scrollLeft+=e.shiftKey?e.deltaY:e.deltaX;
    };
    const down=(e:PointerEvent)=>{
      pending=null;el.style.scrollSnapType='';suppressClick=false;
      if(e.pointerType==='mouse'&&e.button===0)drag={x:e.clientX,scroll:el.scrollLeft,moved:false};
    };
    const move=(e:PointerEvent)=>{
      if(!drag)return;
      const delta=(e.clientX-drag.x)/(el.getBoundingClientRect().width/el.clientWidth);
      if(Math.abs(delta)>5){drag.moved=true;el.setPointerCapture(e.pointerId);el.style.scrollSnapType='none';}
      if(drag.moved)el.scrollLeft=drag.scroll-delta;
    };
    const up=()=>{
      if(drag?.moved){paint();suppressClick=true;el.style.scrollSnapType='';go.current(physical.current%count);}drag=null;
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
  const items=Children.toArray(children);
  return <div className="snap-rail"><div className="snap-viewport" ref={viewport} tabIndex={0} aria-label="Карточки. Листай влево или вправо." onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go.current(current+(e.key==='ArrowRight'?1:-1));}}}><div className="snap-track" ref={track}>{Array.from({length:3},(_,copy)=>items.map((item,i)=><div className="rail-card" data-rail-index={i} key={`${copy}-${i}`}>{item}</div>))}</div></div><button className="shop-arrow prev" aria-label="Предыдущий товар" onClick={()=>go.current(current-1)}><Icon name="left" size={23}/></button><button className="shop-arrow next" aria-label="Следующий товар" onClick={()=>go.current(current+1)}><Icon name="right" size={23}/></button></div>;
}
