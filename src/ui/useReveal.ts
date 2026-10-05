import { useLayoutEffect, type RefObject } from 'react';
import { useAnimationsEnabled } from './motion';

/** Reveal each item once, in screen order, before it can flash into view. */
export function useReveal(root:RefObject<HTMLElement|null>) {
  const animations = useAnimationsEnabled();
  useLayoutEffect(()=>{
    const el=root.current;if(!el)return;
    const nodes=Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    if(!animations){
      nodes.forEach(node=>{node.dataset.revealed='true';node.dataset.entered='true';});return;
    }
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      visible.forEach((entry,index)=>{
        const node=entry.target as HTMLElement;
        node.style.setProperty('--enter-delay',`${Math.min(index*40,160)}ms`);
        node.dataset.revealed='true';observer.unobserve(node);
      });
    },{root:el,rootMargin:'0px 0px 32px 0px',threshold:0});
    nodes.forEach(node=>observer.observe(node));
    const finish=(event:AnimationEvent)=>{
      if(event.animationName==='item-enter')(event.target as HTMLElement).dataset.entered='true';
    };
    el.addEventListener('animationend',finish);
    return()=>{observer.disconnect();el.removeEventListener('animationend',finish);};
  },[root,animations]);
}
