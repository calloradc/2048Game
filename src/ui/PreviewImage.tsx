import { useEffect, useRef, useState } from 'react';

/** Reserve the artwork slot, then fade in a fully decoded preview. */
export function PreviewImage({src,className='',eager=false,alt=''}:{src:string;className?:string;eager?:boolean;alt?:string}) {
  const image=useRef<HTMLImageElement>(null),[ready,setReady]=useState('');
  useEffect(()=>{
    const el=image.current!;let alive=true;
    const reveal=async()=>{
      try {await el.decode();} catch {return;}
      if(alive)setReady(src);
    };
    if(el.complete&&el.naturalWidth)void reveal();
    el.addEventListener('load',reveal);
    return()=>{alive=false;el.removeEventListener('load',reveal);};
  },[src]);
  return <img ref={image} src={src} alt={alt} className={`preview-image ${className} ${ready===src?'is-decoded':''}`} loading={eager?'eager':'lazy'} decoding="async" draggable={false}/>;
}
