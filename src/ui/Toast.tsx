import { t } from '../i18n';
import { useLayoutEffect, useRef, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { usePresence } from './usePresence';

export function Toast({text,onDismiss}:{text:string|null;onDismiss:()=>void}) {
  const {rendered,leaving}=usePresence(text,180),node=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:number;x:number;y:number;time:number;dx:number;dy:number}|null>(null);
  useLayoutEffect(()=>{
    drag.current=null;
    const el=node.current;if(!el||text===null)return;
    el.style.removeProperty('transform');el.style.removeProperty('opacity');
    ['--from-x','--from-y','--exit-x','--exit-y'].forEach(property=>el.style.removeProperty(property));
    el.dataset.dragging='false';
  },[text]);
  const dismiss=(direction:'up'|'right'='up')=>{
    const el=node.current!,gesture=drag.current;
    el.style.setProperty('--from-x',`${gesture?.dx??0}px`);el.style.setProperty('--from-y',`${gesture?.dy??0}px`);
    el.style.setProperty('--exit-x',direction==='right'?`${innerWidth}px`:'0px');
    el.style.setProperty('--exit-y',direction==='up'?`-${el.offsetHeight+32}px`:'0px');
    el.style.removeProperty('transform');el.style.removeProperty('opacity');
    drag.current=null;onDismiss();
  };
  const down=(event:PointerEvent<HTMLDivElement>)=>{
    if(leaving||(event.target as HTMLElement).closest("button")||(event.pointerType==='mouse'&&event.button!==0))return;
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,time:performance.now(),dx:0,dy:0};
    event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.dataset.dragging='true';
  };
  const move=(event:PointerEvent<HTMLDivElement>)=>{
    const gesture=drag.current;if(!gesture||gesture.id!==event.pointerId)return;
    const dx=Math.max(0,event.clientX-gesture.x),dy=Math.min(0,event.clientY-gesture.y);
    gesture.dx=dx>Math.abs(dy)?dx:0;gesture.dy=dx>Math.abs(dy)?0:dy;
    event.currentTarget.style.transform=`translate3d(${gesture.dx}px,${gesture.dy}px,0)`;
    event.currentTarget.style.opacity=String(Math.max(.3,1-Math.max(gesture.dx,Math.abs(gesture.dy))/180));
  };
  const up=(event:PointerEvent<HTMLDivElement>)=>{
    const gesture=drag.current;if(!gesture||gesture.id!==event.pointerId)return;
    const duration=Math.max(1,performance.now()-gesture.time);
    if(event.type!=='pointercancel'&&(gesture.dx>65||gesture.dy< -40||gesture.dx>20&&gesture.dx/duration>.45||gesture.dy< -15&&-gesture.dy/duration>.45))dismiss(gesture.dx>0?'right':'up');
    else {drag.current=null;event.currentTarget.dataset.dragging='false';event.currentTarget.style.removeProperty('transform');event.currentTarget.style.removeProperty('opacity');}
  };
  return rendered===null?null:<div className="toast-position"><div ref={node} className={`toast ${leaving?'is-leaving':''}`} role="status" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><Icon name="check" size={19}/><span>{rendered}</span><button className="toast-close" aria-label={t("Закрыть уведомление")} onClick={()=>dismiss()}><Icon name="close" size={18}/></button></div></div>;
}
