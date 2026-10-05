import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { ElasticScroll } from './ElasticScroll';

export function SoftScroll({children,className='small-dialog-scroll',viewportRef,enabled=true}:{children:ReactNode;className?:string;viewportRef?:RefObject<HTMLDivElement|null>;enabled?:boolean}) {
  const ownViewport=useRef<HTMLDivElement>(null),viewport=viewportRef??ownViewport,track=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!enabled)return;
    const scroll=new ElasticScroll(viewport.current!,track.current!,()=>{},{axis:'y'});
    return()=>scroll.destroy();
  },[enabled]);
  if(!enabled)return <>{children}</>;
  return <div className={className} ref={viewport}><div className="soft-scroll-track" ref={track}>{children}</div></div>;
}
