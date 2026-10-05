import { useState } from 'react';
import { CATALOG, itemPreview, type Category, type ShopItem } from '../game/catalog';
import { asset, fruitAsset } from '../game/fruits';
import type { Profile } from '../game/profile';
import { Icon } from './Icon';
import { SnapRail } from './SnapRail';

const sections:[Category,string,string][]=[['skins','Персонажи','КТО СЕГОДНЯ В ИГРЕ?'],['backgrounds','Твой мир','НОВОЕ МЕСТО ДЛЯ СЛИЯНИЙ'],['boxes','Боксы','СОБЕРИ СВОЙ ИДЕАЛЬНЫЙ НАБОР']];
type ShopProps={profile:Profile;coins:number;busy:boolean;onBuy:(item:ShopItem)=>void;onSelect:(item:ShopItem)=>void;onVideo:(item:ShopItem)=>void;onCoins:()=>void;onClose:()=>void};

function Collection({category,title,caption,profile,coins,busy,onBuy,onSelect,onVideo}:ShopProps&{category:Category;title:string;caption:string}) {
  const list=CATALOG[category];
  const [index,setIndex]=useState(()=>Math.max(0,list.findIndex(item=>item.id===profile.selected[category])));
  const item=list[index],owned=profile.owned.includes(item.key),selected=profile.selected[category]===item.id;
  return <section className={`shop-collection ${category}`} data-category={category} aria-label={title}>
    <header className="collection-heading"><span className="eyebrow">{caption}</span><h2>{title}</h2></header>
    <SnapRail count={list.length} initial={index} current={index} onChange={setIndex}>{list.map(card=><article className={`shop-card ${category}`} data-theme={card.id} key={card.key} aria-label={card.name}>
      <div className="card-art">{category==='skins'?<><img className="skin-mini left" src={fruitAsset(0,card.id)} alt="" loading="lazy"/><img className="skin-main" src={fruitAsset(5,card.id)} alt="" loading="lazy"/><img className="skin-mini right" src={fruitAsset(10,card.id)} alt="" loading="lazy"/></>:<img className="item-image" src={itemPreview(card)} alt="" loading="lazy"/>}</div>
      <span className="card-caption">{card.name}</span>
      <span className="card-status"><Icon name={profile.owned.includes(card.key)?profile.selected[category]===card.id?'check':'sparkle':'lock'} size={17}/></span>
    </article>)}</SnapRail>
    <div className="collection-info" aria-live="polite"><h3 className="shop-current">{item.name}</h3><p>{item.description}</p></div>
    <div className="shop-pagination" aria-label={`Выбор: ${title}`}>{list.map((card,i)=><button key={card.key} className={i===index?'active':''} aria-label={`Показать ${card.name}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><span/></button>)}</div>
    <div className="shop-actions">
      {owned?<button className="primary-button" disabled={selected||busy} onClick={()=>onSelect(item)}><Icon name={selected?'check':'sparkle'} size={25}/>{busy?'Загружаем…':selected?'Уже в игре':'Выбрать'}</button>:<>
        <button className="primary-button gold-button" disabled={coins<item.price||busy} onClick={()=>onBuy(item)}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{coins<item.price?`Нужно ещё ${item.price-coins}`:`Купить за ${item.price}`}</button>
        <button className="reward-button" disabled={busy} onClick={()=>onVideo(item)}><Icon name="video" size={28}/><span>Открыть за видео<small>{profile.videos[item.key]??0} / {item.videos} просмотрено</small></span><span className="ad-progress">{Array.from({length:item.videos},(_,i)=><i key={i} className={i<(profile.videos[item.key]??0)?'filled':''}/>)}</span></button>
      </>}
    </div>
  </section>;
}

export function Shop(props:ShopProps) {
  return <>
    <header className="shop-heading"><h1><Icon name="shop" size={34}/> Магазин</h1><div className="shop-wallet"><img src={asset('particles/11.webp')} alt="монет"/><strong>{props.coins.toLocaleString('ru-RU')}</strong></div></header>
    <div className="shop-scroll">{sections.map(([category,title,caption])=><Collection key={category} category={category} title={title} caption={caption} {...props}/>)}<button className="reward-button shop-coin-video" disabled={props.busy} onClick={props.onCoins}><Icon name="video" size={26}/><span>+75 монет за видео</span><Icon name="double" size={26}/></button><span className="collection-end">Собирай, меняй, играй!</span></div>
    <footer className="shop-footer"><button className="shop-play" onClick={props.onClose}><Icon name="play" size={32}/> Играть</button></footer>
  </>;
}
