import { useLayoutEffect, useState } from 'react';

/** Keep outgoing content mounted for closing, including when switching windows. */
export function usePresence<T>(value:T|null, duration=220) {
  const [rendered,setRendered]=useState(value);
  const leaving=rendered!==null&&rendered!==value;
  useLayoutEffect(()=>{
    if(rendered===value)return;
    if(rendered===null){setRendered(value);return;}
    const timer=setTimeout(()=>setRendered(value),matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration);
    return()=>clearTimeout(timer);
  },[value,rendered,duration]);
  return {rendered,leaving};
}
