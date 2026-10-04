import { useEffect, useRef, useState } from 'react';
import { FRUITS, fruitAsset } from '../game/fruits';
import { ElasticScroll } from './ElasticScroll';

const Arrow = ({left=false}:{left?:boolean}) => <svg className="arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={left?{transform:'rotate(180deg)'}:undefined}><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export function FruitCarousel({discovered}:{discovered:number}) {
  const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null);
  const motion=useRef<ElasticScroll|null>(null),previous=useRef(discovered);
  const [edges,setEdges]=useState({left:false,right:true});
  const count=FRUITS.filter((_,level)=>discovered&(1<<level)).length;
  useEffect(()=>{
    const scroll=new ElasticScroll(viewport.current!,track.current!,setEdges);motion.current=scroll;
    return()=>{scroll.destroy();motion.current=null;};
  },[]);
  useEffect(()=>{
    const newly=discovered&~previous.current;previous.current=discovered;
    if(newly)motion.current?.scrollTo(Math.max(0,Math.floor(Math.log2(newly))*90-90));
  },[discovered]);
  return <section className="evolution" aria-label="Фруктовая семья">
    <div className="evolution-title"><span>ФРУКТОВАЯ СЕМЬЯ</span><span>{count<11?`${count} / 11`:'ВСЕ СОБРАНЫ'} · ЦЕЛЬ <b>2048</b></span></div>
    <button className="carousel-arrow prev" aria-label="Предыдущие фрукты" onClick={()=>motion.current?.scrollBy(-180)} disabled={!edges.left}><Arrow left /></button>
    <div className="fruit-scroller" ref={viewport} tabIndex={0} aria-label="Лента фруктов. Листай пальцем или стрелками.">
      <div className="fruit-chain" ref={track}>{FRUITS.map((fruit,level)=>{
        const known=!!(discovered&(1<<level));
        return <div className="chain-unit" key={fruit.value}><div className={`chain-fruit ${known?'discovered':'locked'}`} data-level={level} data-discovered={known?'true':'false'} aria-label={known?fruit.name:'Неоткрытый фрукт'}><img src={fruitAsset(level)} alt="" draggable={false} /><span>{known?fruit.name:'???'}</span></div>{level<10&&<span className="chain-arrow"><Arrow /></span>}</div>;
      })}</div>
    </div>
    <button className="carousel-arrow next" aria-label="Следующие фрукты" onClick={()=>motion.current?.scrollBy(180)} disabled={!edges.right}><Arrow /></button>
  </section>;
}
