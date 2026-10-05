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

function Collection({category,title,caption,profile,coins,busy,onBuy,onSelect,onVideo,onRewards}:ShopProps&{category:Category;title:string;caption:string}) {
  const list=CATALOG[category];
  const [index,setIndex]=useState(()=>Math.max(0,list.findIndex(item=>item.id===profile.selected[category])));
  const item=list[index],owned=profile.owned.includes(item.key),selected=profile.selected[category]===item.id;
  return <section className={`shop-collection ${category}`} data-category={category} data-shop-section={category} aria-label={title}>
    <header className="collection-heading"><span className="eyebrow">{caption}</span><h2>{title}</h2></header>
    <SnapRail count={list.length} initial={index} current={index} onChange={setIndex}>{list.map(card=><article className={`shop-card ${category} ${card.exclusive?'exclusive-card':''}`} data-theme={card.id} key={card.key} aria-label={card.name}>
      <div className="card-art">{category==='skins'?<><img className="skin-mini left" src={fruitAsset(0,card.id)} alt="" loading="lazy"/><img className="skin-main" src={fruitAsset(5,card.id)} alt="" loading="lazy"/><img className="skin-mini right" src={fruitAsset(10,card.id)} alt="" loading="lazy"/></>:<img className="item-image" src={itemPreview(card)} alt="" loading="lazy"/>}</div>
      <span className="card-caption">{card.name}</span>
      <span className="card-status"><Icon name={profile.owned.includes(card.key)?profile.selected[category]===card.id?'check':'sparkle':card.exclusive?'gift':'lock'} size={17}/></span>
    </article>)}</SnapRail>
    <div className="collection-info" aria-live="polite"><h3 className="shop-current">{item.name}</h3><p>{item.exclusive&&<span className="item-exclusive-label">ЭКСКЛЮЗИВ</span>}{item.description}</p></div>
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
    el.addEventListener('scroll',update,{passive:true});return()=>el.removeEventListener('scroll',update);
  },[]);
  const featured=BUNDLES.find(bundle=>!props.profile.bundles.includes(bundle.id))??BUNDLES[0];
  const offer=bundleOffer(props.profile,featured);
  return <>
    <header className="shop-heading"><h1><Icon name="shop" size={34}/>Магазин</h1><div className="shop-wallet"><img src={asset('particles/11.webp')} alt="монет"/><strong>{props.coins.toLocaleString('ru-RU')}</strong></div></header>
    <div className="shop-toolbar"><div className="shop-toolbar-top"><span>{props.profile.owned.length} образов в коллекции</span><button className="shop-quick-coins" disabled={props.busy} onClick={props.onCoins} aria-label="+75 монет за видео"><Icon name="video" size={22}/><b>+75</b><img src={asset('particles/11.webp')} alt=""/></button></div><nav className="shop-nav" aria-label="Разделы магазина">{links.map(([id,label])=><button key={id} aria-current={active===id?'true':undefined} onClick={()=>jump(id)}>{label}</button>)}</nav></div>
    <div className="shop-scroll" ref={scroll}>
      <button className="shop-feature" onClick={()=>jump('bundles')} aria-label="Смотреть выгодные наборы"><div><span className="offer-tag">ВМЕСТЕ ВЫГОДНЕЕ</span><h2>{featured.name}</h2><span>3 образа + {featured.shakes} встряски</span></div><img src={itemPreview(itemByKey(featured.items[0])!)} alt=""/><span className="feature-price">{offer.bought?'Собран':<><img src={asset('particles/11.webp')} alt=""/>{offer.price}<Icon name="right" size={15}/></>}</span></button>
      {sections.map(([category,title,caption])=><Collection key={category} category={category} title={title} caption={caption} {...props}/>)}
      <section className="shop-bundles" data-shop-section="bundles" aria-label="Наборы"><header className="collection-heading"><span className="eyebrow">БОЛЬШЕ ПРИЯТНОСТЕЙ ЗА МЕНЬШЕ МОНЕТ</span><h2>Всё в одном наборе</h2></header><div className="bundle-list">{BUNDLES.map(bundle=>{
        const deal=bundleOffer(props.profile,bundle);
        return <article className={`bundle-card ${bundle.id}`} key={bundle.id}><div className="bundle-art">{bundle.items.map(key=><img src={itemPreview(itemByKey(key)!)} alt="" key={key}/>)}<span>+{bundle.shakes}<Icon name="shake" size={20}/></span></div><div className="bundle-copy"><h3>{bundle.name}</h3><p>{bundle.caption}</p><span className="bundle-saving">{deal.bought?'Набор уже в коллекции':`Выгода ${deal.saving} монет`}</span>{deal.remaining.length<bundle.items.length&&!deal.bought&&<small>Учли образы, которые у тебя уже есть</small>}</div><button className="primary-button" disabled={deal.bought||props.coins<deal.price||props.busy} onClick={()=>props.onBundle(bundle)} aria-label={`Купить ${bundle.name} за ${deal.price}`}><Icon name={deal.bought?'check':'shop'} size={22}/>{deal.bought?'Собран':<><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{deal.price}</>}</button></article>;
      })}</div></section>
      <section className="shop-supplies" data-shop-section="supplies" aria-label="Монеты и встряски"><header className="collection-heading"><span className="eyebrow">ЕЩЁ НЕМНОГО ЖЕЛЕЙНОГО ВОЛШЕБСТВА</span><h2>Монеты и встряски</h2></header><div className="supplies-grid"><article className="supply-card coins"><img src={asset('particles/11.webp')} alt=""/><h3>+150 монет</h3><p>{props.profile.coinVideo} / 2 видео</p><button className="supply-video" onClick={props.onCoinPack} disabled={props.busy}><Icon name="video" size={23}/>Смотреть</button></article><article className="supply-card shakes"><Icon name="shake" size={48}/><h3>+1 встряска</h3><p>За короткое видео</p><button className="supply-video" onClick={props.onShakeVideo} disabled={props.busy} aria-label="Добавить встряску за видео"><Icon name="video" size={23}/>Смотреть</button></article>{SHAKE_PACKS.map(pack=><article className="supply-card shakes" key={pack.id}><Icon name="shake" size={48}/><h3>+{pack.amount} {pack.amount===1?'встряска':'встрясок'}</h3><p>{pack.amount===5?'На 20% выгоднее':'Всегда под рукой'}</p><button className="primary-button" disabled={props.coins<pack.price||props.busy} onClick={()=>props.onShakes(pack)} aria-label={`Купить ${pack.amount} встрясок за ${pack.price}`}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{pack.price}</button></article>)}</div><div className="shake-bank"><Icon name="shake" size={23}/>{props.profile.shakeTokens} встрясок в запасе<small>Сохраняются между играми</small></div></section>
      <span className="collection-end">Собирай, меняй, играй!</span>
    </div>
    <footer className="shop-footer"><button className="shop-play" onClick={props.onClose}><Icon name="play" size={32}/>Играть</button></footer>
  </>;
}
