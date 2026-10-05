import { useEffect, useRef, useState } from 'react';
import { CATALOG, itemByKey, itemPreview, type Category, type ShopItem } from '../game/catalog';
import { BUNDLES, SHAKE_PACKS, bundleOffer, type Bundle } from '../game/commerce';
import { asset, fruitAsset } from '../game/fruits';
import type { Profile } from '../game/profile';
import { Icon } from './Icon';
import { SnapRail } from './SnapRail';

const sections:[Category,string,string][]=[['skins','Персонажи','КТО СЕГОДНЯ В ИГРЕ?'],['backgrounds','Твой мир','НОВОЕ МЕСТО ДЛЯ СЛИЯНИЙ'],['boxes','Боксы','СОБЕРИ СВОЙ ИДЕАЛЬНЫЙ НАБОР']];
const links=[['skins','Персонажи'],['backgrounds','Фоны'],['boxes','Боксы'],['bundles','Наборы'],['supplies','Монеты']] as const;
type ShopProps={profile:Profile;coins:number;busy:boolean;onBuy:(item:ShopItem)=>void;onSelect:(item:ShopItem)=>void;onVideo:(item:ShopItem)=>void;onCoins:()=>void;onCoinPack:()=>void;onShakeVideo:()=>void;onShakes:(pack:typeof SHAKE_PACKS[number])=>void;onBundle:(bundle:Bundle)=>void;onRewards:()=>void;onClose:()=>void};

function Ribbon({children}:{children:string}) {return <span className="sale-ribbon">{children}</span>;}
function BundleArt({bundle}:{bundle:Bundle}) {
  return <div className="bundle-art">{bundle.items.map(key=>{const item=itemByKey(key)!;return <img className={`bundle-preview ${item.category}`} src={itemPreview(item)} alt="" key={key}/>;})}<span className="bundle-shakes"><Icon name="shake" size={24}/><b>+{bundle.shakes}</b></span></div>;
}

function Collection({category,title,caption,profile,coins,busy,onBuy,onSelect,onVideo,onRewards}:ShopProps&{category:Category;title:string;caption:string}) {
  const list=CATALOG[category];
  const [index,setIndex]=useState(()=>Math.max(0,list.findIndex(item=>item.id===profile.selected[category])));
  const item=list[index],owned=profile.owned.includes(item.key),selected=profile.selected[category]===item.id;
  return <section className={`shop-collection ${category}`} data-category={category} data-shop-section={category} aria-label={title}>
    <header className="collection-heading"><span className="eyebrow">{caption}</span><h2>{title}</h2></header>
    <SnapRail count={list.length} initial={index} current={index} onChange={setIndex}>{list.map(card=><article className={`shop-card ${category} ${card.exclusive?'exclusive-card':''}`} data-theme={card.id} key={card.key} aria-label={card.name}>
      <div className="card-art">{category==='skins'?<><img className="skin-mini left" src={fruitAsset(0,card.id)} alt="" loading="lazy"/><img className="skin-main" src={fruitAsset(5,card.id)} alt="" loading="lazy"/><img className="skin-mini right" src={fruitAsset(10,card.id)} alt="" loading="lazy"/></>:<img className="item-image" src={itemPreview(card)} alt="" loading="lazy"/>}</div>
      <span className="card-caption">{card.name}</span>
      {card.exclusive&&<Ribbon>НОВОЕ</Ribbon>}
      <span className="card-status"><Icon name={profile.owned.includes(card.key)?profile.selected[category]===card.id?'check':'sparkle':card.exclusive?'gift':'lock'} size={17}/></span>
    </article>)}</SnapRail>
    <div className="collection-info" aria-live="polite"><div className="item-copy" key={item.key}><h3 className="shop-current">{item.name}</h3><p>{item.exclusive&&<span className="item-exclusive-label">ЭКСКЛЮЗИВ</span>}{item.description}</p></div></div>
    <div className="shop-pagination" aria-label={`Выбор: ${title}`}>{list.map((card,i)=><button key={card.key} className={i===index?'active':''} aria-label={`Показать ${card.name}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><span/></button>)}</div>
    <div className="shop-actions">
      {owned?<button className="primary-button" disabled={selected||busy} onClick={()=>onSelect(item)}><Icon name={selected?'check':'sparkle'} size={25}/>{busy?'Загружаем…':selected?'Уже в игре':'Выбрать'}</button>:item.exclusive?<button className="reward-button exclusive-unlock" onClick={onRewards}><Icon name="gift" size={28}/><span>В ежедневных наградах<small>Собери лунную коллекцию</small></span><Icon name="right" size={18}/></button>:<>
        <button className="primary-button" disabled={coins<item.price||busy} onClick={()=>onBuy(item)}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{coins<item.price?`Нужно ещё ${item.price-coins}`:`Купить за ${item.price}`}</button>
        <button className="reward-button" disabled={busy} onClick={()=>onVideo(item)}><Icon name="video" size={28}/><span>Открыть за видео<small>{profile.videos[item.key]??0} / {item.videos} просмотрено</small></span><span className="ad-progress">{Array.from({length:item.videos},(_,i)=><i key={i} className={i<(profile.videos[item.key]??0)?'filled':''}/>)}</span></button>
      </>}
    </div>
  </section>;
}

export function Shop(props:ShopProps) {
  const scroll=useRef<HTMLDivElement>(null),[active,setActive]=useState<string>('skins');
  const jump=(id:string)=>{
    const el=scroll.current,target=el?.querySelector<HTMLElement>(`[data-shop-section="${id}"]`);
    if(el&&target){setActive(id);el.scrollTo({top:target.offsetTop-8,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  };
  useEffect(()=>{
    const el=scroll.current!;
    const update=()=>{
      let id:string='skins';
      for(const section of el.querySelectorAll<HTMLElement>('[data-shop-section]'))if(section.offsetTop<=el.scrollTop+40)id=section.dataset.shopSection!;
      if(el.scrollTop>0&&el.scrollTop+el.clientHeight>=el.scrollHeight-8)id='supplies';
      setActive(id);
    };
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){(entry.target as HTMLElement).dataset.revealed='true';observer.unobserve(entry.target);}},{root:el,threshold:.12});
    el.querySelectorAll('[data-reveal]').forEach(node=>observer.observe(node));
    el.addEventListener('scroll',update,{passive:true});return()=>{el.removeEventListener('scroll',update);observer.disconnect();};
  },[]);
  const featured=BUNDLES.find(bundle=>!props.profile.bundles.includes(bundle.id))??BUNDLES[0];
  const offer=bundleOffer(props.profile,featured);
  return <>
    <header className="shop-heading"><h1><Icon name="shop" size={34}/>Магазин</h1><div className="shop-wallet"><img src={asset('particles/11.webp')} alt="монет"/><strong>{props.coins.toLocaleString('ru-RU')}</strong></div></header>
    <div className="shop-toolbar"><div className="shop-toolbar-top"><span>{props.profile.owned.length} образов в коллекции</span><button className="shop-quick-coins" disabled={props.busy} onClick={props.onCoins} aria-label="+75 монет за видео"><Icon name="video" size={22}/><b>+75</b><img src={asset('particles/11.webp')} alt=""/></button></div><nav className="shop-nav" aria-label="Разделы магазина">{links.map(([id,label])=><button key={id} aria-current={active===id?'true':undefined} onClick={()=>jump(id)}>{label}</button>)}</nav></div>
    <div className="shop-scroll" ref={scroll}>
      <button className="shop-feature" onClick={()=>jump('bundles')} aria-label="Смотреть выгодные наборы"><Ribbon>ВЫГОДНО</Ribbon><div className="feature-copy"><span className="offer-tag">НАБОР ДНЯ</span><h2>{featured.name}</h2><span>3 образа + {featured.shakes} встряски</span><span className="feature-price">{offer.bought?'Собран':<><img src={asset('particles/11.webp')} alt=""/>{offer.price}<Icon name="right" size={15}/></>}</span></div><img className="feature-mascot" src={itemPreview(itemByKey(featured.items[0])!)} alt=""/></button>
      {sections.map(([category,title,caption])=><Collection key={category} category={category} title={title} caption={caption} {...props}/>)}
      <section className="shop-bundles" data-shop-section="bundles" aria-label="Наборы"><header className="collection-heading"><span className="eyebrow">БОЛЬШЕ ПРИЯТНОСТЕЙ ЗА МЕНЬШЕ МОНЕТ</span><h2>Всё в одном наборе</h2></header><div className="bundle-list">{BUNDLES.map(bundle=>{
        const deal=bundleOffer(props.profile,bundle);
        const discount=Math.round(deal.saving/(deal.price+deal.saving)*100);
        return <article className={`bundle-card ${bundle.id} ${deal.bought?'is-owned':''}`} key={bundle.id} data-reveal><Ribbon>{bundle.id==='cozy'?'ВЫГОДНО':'НОВОЕ'}</Ribbon><BundleArt bundle={bundle}/><div className="bundle-copy"><h3>{bundle.name}</h3><p>{bundle.caption}</p><span className="bundle-saving">{deal.bought?<><Icon name="check" size={17}/>В коллекции</>:<><b>−{discount}%</b>Выгода {deal.saving} монет</>}</span><small>{deal.remaining.length<bundle.items.length&&!deal.bought?'Цена ниже: часть образов уже твоя':'Персонажи · фон · бокс'}</small></div><div className="bundle-checkout"><span className="bundle-old-price">{!deal.bought&&<><img src={asset('particles/11.webp')} alt=""/><del>{deal.price+deal.saving}</del></>}</span><button className="primary-button" disabled={deal.bought||props.coins<deal.price||props.busy} onClick={()=>props.onBundle(bundle)} aria-label={`Купить ${bundle.name} за ${deal.price}`}>{deal.bought?<><Icon name="check" size={22}/>Собран</>:<>Купить<img className="button-coin" src={asset('particles/11.webp')} alt=""/>{deal.price}</>}</button></div></article>;
      })}</div></section>
      <section className="shop-supplies" data-shop-section="supplies" aria-label="Монеты и встряски"><header className="collection-heading"><span className="eyebrow">ДЛЯ НОВЫХ РЕКОРДОВ</span><h2>Монеты и встряски</h2><span className="supply-bank"><Icon name="shake" size={18}/><span>В запасе: {props.profile.shakeTokens}</span></span></header><div className="supplies-grid"><article className="supply-card coins" data-reveal><img src={asset('particles/11.webp')} alt=""/><h3>+150 монет</h3><p>{props.profile.coinVideo} / 2 видео</p><button className="supply-video" onClick={props.onCoinPack} disabled={props.busy}><Icon name="video" size={23}/>Смотреть</button></article><article className="supply-card shakes" data-reveal><Icon name="shake" size={48}/><h3>+1 встряска</h3><p>За короткое видео</p><button className="supply-video" onClick={props.onShakeVideo} disabled={props.busy} aria-label="Добавить встряску за видео"><Icon name="video" size={23}/>Смотреть</button></article>{SHAKE_PACKS.map(pack=><article className="supply-card shakes" key={pack.id} data-reveal>{pack.amount===5&&<Ribbon>ВЫГОДНО</Ribbon>}<Icon name="shake" size={48}/><h3>+{pack.amount} {pack.amount===1?'встряска':'встрясок'}</h3><p>{pack.amount===5?'На 20% выгоднее':'Всегда под рукой'}</p><button className="primary-button" disabled={props.coins<pack.price||props.busy} onClick={()=>props.onShakes(pack)} aria-label={`Купить ${pack.amount} встрясок за ${pack.price}`}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{pack.price}</button></article>)}</div></section>
    </div>
    <footer className="shop-footer"><button className="shop-play" onClick={props.onClose}><Icon name="play" size={32}/>Играть</button></footer>
  </>;
}
