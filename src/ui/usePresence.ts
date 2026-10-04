import { useLayoutEffect, useState } from 'react';

/** Retain the last dialog through its exit animation, including its content. */
export function usePresence<T>(value:T|null, duration=190) {
  const [rendered,setRendered]=useState(value),[leaving,setLeaving]=useState(false);
  useLayoutEffect(()=>{
    if(value!==null){setRendered(value);setLeaving(false);return;}
    setLeaving(true);
    const timer=setTimeout(()=>{setRendered(null);setLeaving(false);},duration);
    return()=>clearTimeout(timer);
  },[value,duration]);
  return {rendered,leaving};
}
