import { useEffect, useRef, useState } from 'react';

export function nativePixelRatio(dpr:number,inner:number,outer:number,embedded=false) {
  if(embedded||!inner||!outer)return dpr;
  const ratio=outer/inner;
  const levels=[.25,1/3,.5,2/3,.75,.8,.9,1,1.1,1.25,1.5,1.75,2,2.5,3,4,5];
  const zoom=levels.reduce((best,value)=>Math.abs(value-ratio)<Math.abs(best-ratio)?value:best,1);
  return Math.abs(ratio-zoom)/zoom<.025?dpr/zoom:dpr;
}

/** Keep game coordinates and physical UI size stable when desktop page zoom changes. */
export function useGameViewport() {
  const nativeDpr=useRef(matchMedia('(hover: hover) and (pointer: fine)').matches?nativePixelRatio(window.devicePixelRatio||1,innerWidth,outerWidth,window.top!==window):window.devicePixelRatio||1);
  const [viewport,setViewport]=useState({width:innerWidth,height:innerHeight,zoom:1});
  useEffect(()=>{
    let resolution:MediaQueryList;
    const update=()=>{
      const desktop=matchMedia('(hover: hover) and (pointer: fine)').matches;
      const zoom=desktop?(window.devicePixelRatio||1)/nativeDpr.current:1;
      const visual=window.visualViewport;
      setViewport({width:(visual?.width??innerWidth)*zoom,height:(visual?.height??innerHeight)*zoom,zoom});
      resolution?.removeEventListener('change',update);
      resolution=matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener('change',update);
    };
    update();window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);
    return()=>{window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);resolution.removeEventListener('change',update);};
  },[]);
  return viewport;
}
