import { useEffect, useRef, useState } from 'react';
import { CATALOG, itemByKey, itemPreview, type Category, type ShopItem } from '../game/catalog';
import { BUNDLES, SHAKE_PACKS, bundleOffer, type Bundle } from '../game/commerce';
import { asset, fruitAsset } from '../game/fruits';
import type { Profile } from '../game/profile';
import { Icon } from './Icon';
import { SnapRail } from './SnapRail';
import { ShopNav } from './ShopNav';
import { useReveal } from './useReveal';
import { PreviewImage } from './PreviewImage';

const sections:[Category,string,string][]=[['skins','Персонажи','КТО СЕГОДНЯ В ИГРЕ?'],['backgrounds','Твой мир','НОВОЕ МЕСТО ДЛЯ СЛИЯНИЙ'],['boxes','Боксы','СОБЕРИ СВОЙ ИДЕАЛЬНЫЙ НАБОР']];
type ShopProps={profile:Profile;coins:number;busy:boolean;onBuy:(item:ShopItem)=>void;onSelect:(item:ShopItem)=>void;onVideo:(item:ShopItem)=>void;onCoins:()=>void;onCoinPack:()=>void;onShakeVideo:()=>void;onShakes:(pack:typeof SHAKE_PACKS[number])=>void;onBundle:(bundle:Bundle)=>void;onRewards:()=>void;onClose:()=>void};

function Ribbon({children}:{children:string}) {return <span className="sale-ribbon">{children}</span>;}
function BundleArt({bundle,onItem}:{bundle:Bundle;onItem:(item:ShopItem)=>void}) {
  return <div className="bundle-art">{bundle.items.map(key=>{const item=itemByKey(key)!;return <button className={`bundle-preview ${item.category}`} key={key} aria-label={`Посмотреть ${item.name}`} onClick={()=>onItem(item)}><PreviewImage src={itemPreview(item)}/></button>;})}<span className="bundle-shakes"><Icon name="shake" size={24}/><b>+{bundle.shakes}</b></span></div>;
}

function Collection({category,title,caption,index,onIndex,profile,coins,busy,onBuy,onSelect,onVideo,onRewards}:ShopProps&{category:Category;title:string;caption:string;index:number;onIndex:(index:number)=>void}) {
  const list=CATALOG[category];
  const item=list[index],owned=profile.owned.includes(item.key),selected=profile.selected[category]===item.id;
  return <section className={`shop-collection ${category}`} data-category={category} data-shop-section={category} aria-label={title}>
    <header className="collection-heading" data-reveal><span className="eyebrow">{caption}</span><h2>{title}</h2></header>
    <SnapRail count={list.length} initial={index} current={index} onChange={onIndex}>{list.map((card,i)=><article className={`shop-card ${category} ${card.exclusive?'exclusive-card':''}`} data-theme={card.id} key={card.key} aria-label={card.name}>
      <div className="card-art">{category==='skins'?<><PreviewImage className="skin-mini left" src={fruitAsset(0,card.id)} eager={Math.abs(i-index)<=1}/><PreviewImage className="skin-main" src={fruitAsset(5,card.id)} eager={Math.abs(i-index)<=1}/><PreviewImage className="skin-mini right" src={fruitAsset(10,card.id)} eager={Math.abs(i-index)<=1}/></>:<PreviewImage className="item-image" src={itemPreview(card)} eager={Math.abs(i-index)<=1}/>}</div>
      <span className="card-caption">{card.name}</span>
      {card.exclusive&&<Ribbon>НОВОЕ</Ribbon>}
      <span className="card-status"><Icon name={profile.owned.includes(card.key)?profile.selected[category]===card.id?'check':'sparkle':card.exclusive?'gift':'lock'} size={17}/></span>
    </article>)}</SnapRail>
    <div className="collection-info" aria-live="polite" data-reveal><div className="item-copy" key={item.key}><h3 className="shop-current">{item.name}</h3><p>{item.exclusive&&<span className="item-exclusive-label">ЭКСКЛЮЗИВ</span>}{item.description}</p></div></div>
    <div data-reveal className="shop-pagination" aria-label={`Выбор: ${title}`}>{list.map((card,i)=><button key={card.key} className={i===index?'active':''} aria-label={`Показать ${card.name}`} aria-pressed={i===index} onClick={()=>onIndex(i)}><span/></button>)}</div>
    <div className="shop-actions" data-reveal>
      {owned?<button className="primary-button" disabled={selected||busy} onClick={()=>onSelect(item)}><Icon name={selected?'check':'sparkle'} size={25}/>{busy?'Загружаем…':selected?'Уже в игре':'Выбрать'}</button>:item.exclusive?<button className="reward-button exclusive-unlock" onClick={onRewards}><Icon name="gift" size={28}/><span>В ежедневных наградах<small>Собери лунную коллекцию</small></span><Icon name="right" size={18}/></button>:<>
        <button className="primary-button" disabled={coins<item.price||busy} onClick={()=>onBuy(item)}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{coins<item.price?`Нужно ещё ${item.price-coins}`:`Купить за ${item.price}`}</button>
        <button className="reward-button" disabled={busy} onClick={()=>onVideo(item)}><Icon name="video" size={28}/><span>Открыть за видео<small>{profile.videos[item.key]??0} / {item.videos} просмотрено</small></span><span className="ad-progress">{Array.from({length:item.videos},(_,i)=><i key={i} className={i<(profile.videos[item.key]??0)?'filled':''}/>)}</span></button>
      </>}
    </div>
  </section>;
}

export function Shop(props:ShopProps) {
  const scroll=useRef<HTMLDivElement>(null),[active,setActive]=useState<string>('skins');
  const jumpTarget=useRef<{id:string;top:number}|null>(null);
  const jumpFrame=useRef(0);
  const [indices,setIndices]=useState<Record<Category,number>>(()=>({
    skins:Math.max(0,CATALOG.skins.findIndex(item=>item.id===props.profile.selected.skins)),
    backgrounds:Math.max(0,CATALOG.backgrounds.findIndex(item=>item.id===props.profile.selected.backgrounds)),
    boxes:Math.max(0,CATALOG.boxes.findIndex(item=>item.id===props.profile.selected.boxes)),
  }));
  useReveal(scroll);
  const jump=(id:string)=>{
    const el=scroll.current,target=el?.querySelector<HTMLElement>(`[data-shop-section="${id}"]`);
    if(!el||!target)return;
    cancelAnimationFrame(jumpFrame.current);
    const top=Math.min(el.scrollHeight-el.clientHeight,Math.max(0,target.offsetTop-8)),from=el.scrollTop;
    jumpTarget.current={id,top};setActive(id);
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||Math.abs(from-top)<1){el.scrollTop=top;jumpTarget.current=null;return;}
    const start=performance.now(),duration=Math.min(460,180+Math.abs(top-from)*.12);
    const move=(now:number)=>{
      const t=Math.min(1,(now-start)/duration);
      el.scrollTop=from+(top-from)*(1-Math.pow(1-t,3));
      if(t<1)jumpFrame.current=requestAnimationFrame(move);
      else {jumpFrame.current=0;jumpTarget.current=null;}
    };
    jumpFrame.current=requestAnimationFrame(move);
  };
  const jumpItem=(item:ShopItem)=>{
    setIndices(current=>({...current,[item.category]:CATALOG[item.category].findIndex(card=>card.key===item.key)}));
    jump(item.category);
  };
  useEffect(()=>{
    const el=scroll.current!;
    let frame=0;
    const sections=Array.from(el.querySelectorAll<HTMLElement>('[data-shop-section]'));
    let positions:{id:string;top:number}[]=[];
    const measure=()=>{positions=sections.map(section=>({id:section.dataset.shopSection!,top:section.offsetTop}));};
    const update=()=>{
      frame=0;
      if(jumpTarget.current)return;
      let id:string='skins';
      const focus=el.scrollTop+el.clientHeight*.45;
      for(const section of positions)if(section.top<=focus)id=section.id;
      if(el.scrollTop>0&&el.scrollTop+el.clientHeight>=el.scrollHeight-8)id='supplies';
      setActive(id);
    };
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const observer=new ResizeObserver(()=>{measure();onScroll();});observer.observe(el);sections.forEach(section=>observer.observe(section));measure();
    const interrupt=()=>{
      if(jumpTarget.current){cancelAnimationFrame(jumpFrame.current);jumpFrame.current=0;jumpTarget.current=null;onScroll();}
    };
    el.addEventListener('scroll',onScroll,{passive:true});el.addEventListener('wheel',interrupt,{passive:true});el.addEventListener('pointerdown',interrupt,{passive:true});
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(jumpFrame.current);observer.disconnect();el.removeEventListener('scroll',onScroll);el.removeEventListener('wheel',interrupt);el.removeEventListener('pointerdown',interrupt);};
  },[]);
  const featured=BUNDLES.find(bundle=>!props.profile.bundles.includes(bundle.id))??BUNDLES[0];
  const offer=bundleOffer(props.profile,featured);
  return <>
    <header className="shop-heading"><h1><Icon name="shop" size={46}/>Магазин</h1><div className="shop-wallet"><img src={asset('particles/11.webp')} alt="монет"/><strong>{props.coins.toLocaleString('ru-RU')}</strong></div></header>
    <div className="shop-toolbar"><div className="shop-toolbar-top"><span>{props.profile.owned.length} образов в коллекции</span><button className="shop-quick-coins" disabled={props.busy} onClick={props.onCoins} aria-label="+75 монет за видео"><Icon name="video" size={22}/><b>+75</b><img src={asset('particles/11.webp')} alt=""/></button></div><ShopNav active={active} onJump={jump}/></div>
    <div className="shop-scroll" ref={scroll}>
      <button data-reveal className="shop-feature" onClick={()=>jump('bundles')} aria-label="Смотреть выгодные наборы"><Ribbon>ВЫГОДНО</Ribbon><div className="feature-copy"><span className="offer-tag">НАБОР ДНЯ</span><h2>{featured.name}</h2><span>3 образа + {featured.shakes} встряски</span><span className="feature-price">{offer.bought?'Собран':<><img src={asset('particles/11.webp')} alt=""/>{offer.price}<Icon name="right" size={15}/></>}</span></div><PreviewImage className="feature-mascot" src={itemPreview(itemByKey(featured.items[0])!)} eager/></button>
      {sections.map(([category,title,caption])=><Collection key={category} category={category} title={title} caption={caption} index={indices[category]} onIndex={index=>setIndices(current=>({...current,[category]:index}))} {...props}/>)}
      <section className="shop-bundles" data-shop-section="bundles" aria-label="Наборы"><header className="collection-heading"><span className="eyebrow">БОЛЬШЕ ПРИЯТНОСТЕЙ ЗА МЕНЬШЕ МОНЕТ</span><h2>Всё в одном наборе</h2></header><div className="bundle-list">{BUNDLES.map(bundle=>{
        const deal=bundleOffer(props.profile,bundle);
        const discount=Math.round(deal.saving/(deal.price+deal.saving)*100);
        return <article className={`bundle-card ${bundle.id} ${deal.bought?'is-owned':''}`} key={bundle.id} data-reveal><Ribbon>{bundle.id==='cozy'?'ВЫГОДНО':'НОВОЕ'}</Ribbon><BundleArt bundle={bundle} onItem={jumpItem}/><div className="bundle-copy"><h3>{bundle.name}</h3><p>{bundle.caption}</p><span className="bundle-saving">{deal.bought?<><Icon name="check" size={17}/>В коллекции</>:<><b>−{discount}%</b>Выгода {deal.saving} монет</>}</span><small>{deal.remaining.length<bundle.items.length&&!deal.bought?'Цена ниже: часть образов уже твоя':'Персонажи · фон · бокс'}</small></div><div className="bundle-checkout"><span className="bundle-old-price">{!deal.bought&&<><img src={asset('particles/11.webp')} alt=""/><del>{deal.price+deal.saving}</del></>}</span><button className="primary-button" disabled={deal.bought||props.coins<deal.price||props.busy} onClick={()=>props.onBundle(bundle)} aria-label={`Купить ${bundle.name} за ${deal.price}`}>{deal.bought?<><Icon name="check" size={22}/>Собран</>:<>Купить<img className="button-coin" src={asset('particles/11.webp')} alt=""/>{deal.price}</>}</button></div></article>;
      })}</div></section>
      <section className="shop-supplies" data-shop-section="supplies" aria-label="Монеты и встряски"><header className="collection-heading"><span className="eyebrow">ДЛЯ НОВЫХ РЕКОРДОВ</span><h2>Монеты и встряски</h2><span className="supply-bank"><Icon name="shake" size={18}/><span>В запасе: {props.profile.shakeTokens}</span></span></header><div className="supplies-grid"><article className="supply-card coins" data-reveal><img src={asset('particles/11.webp')} alt=""/><h3>+150 монет</h3><p>{props.profile.coinVideo} / 2 видео</p><button className="supply-video" onClick={props.onCoinPack} disabled={props.busy}><Icon name="video" size={23}/>Смотреть</button></article><article className="supply-card shakes" data-reveal><Icon name="shake" size={48}/><h3>+1 встряска</h3><p>За короткое видео</p><button className="supply-video" onClick={props.onShakeVideo} disabled={props.busy} aria-label="Добавить встряску за видео"><Icon name="video" size={23}/>Смотреть</button></article>{SHAKE_PACKS.map(pack=><article className="supply-card shakes" key={pack.id} data-reveal>{pack.amount===5&&<Ribbon>ВЫГОДНО</Ribbon>}<Icon name="shake" size={48}/><h3>+{pack.amount} {pack.amount===1?'встряска':'встрясок'}</h3><p>{pack.amount===5?'На 20% выгоднее':'Всегда под рукой'}</p><button className="primary-button" disabled={props.coins<pack.price||props.busy} onClick={()=>props.onShakes(pack)} aria-label={`Купить ${pack.amount} встрясок за ${pack.price}`}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{pack.price}</button></article>)}</div></section>
    </div>
    <footer className="shop-footer"><button className="shop-play" onClick={props.onClose}><Icon name="play" size={32}/>Играть</button></footer>
  </>;
}
