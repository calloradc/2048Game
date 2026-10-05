import { useLayoutEffect, useState } from 'react';
import { useAnimationsEnabled } from './motion';

/** Keep outgoing content mounted for closing, including when switching windows. */
export function usePresence<T>(value:T|null, duration=220) {
  const animations = useAnimationsEnabled();
  const [rendered,setRendered]=useState(value);
  const leaving=rendered!==null&&rendered!==value;
  useLayoutEffect(()=>{
    if(rendered===value)return;
    if(rendered===null){setRendered(value);return;}
    const timer=setTimeout(()=>setRendered(value),animations?duration:0);
    return()=>clearTimeout(timer);
  },[value,rendered,duration,animations]);
  return {rendered,leaving};
}
