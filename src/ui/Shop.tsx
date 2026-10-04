import { useState } from 'react';
import { CATALOG, itemPreview, type Category, type ShopItem } from '../game/catalog';
import { asset, fruitAsset } from '../game/fruits';
import type { Profile } from '../game/profile';
import { Icon, type IconName } from './Icon';
import { SnapRail } from './SnapRail';

const tabs:[Category,string,IconName][]=[['skins','Персонажи','skin'],['backgrounds','Фоны','background'],['boxes','Боксы','box']];
export function Shop({profile,coins,busy,onBuy,onSelect,onVideo,onCoins}:{profile:Profile;coins:number;busy:boolean;onBuy:(item:ShopItem)=>void;onSelect:(item:ShopItem)=>void;onVideo:(item:ShopItem)=>void;onCoins:()=>void}) {
  const [category,setCategory]=useState<Category>('skins'),[indices,setIndices]=useState<Record<Category,number>>({skins:0,backgrounds:0,boxes:0});
  const list=CATALOG[category],index=indices[category],item=list[index],owned=profile.owned.includes(item.key),selected=profile.selected[category]===item.id;
  const change=(i:number)=>setIndices(v=>({...v,[category]:i}));
  return <>
    <div className="shop-heading"><span className="eyebrow">МАЛЕНЬКИЕ РАДОСТИ</span><h1><Icon name="shop" size={30} /> Магазин</h1><div className="shop-wallet"><img src={asset('particles/11.webp')} alt="" />{coins.toLocaleString('ru-RU')}<span>монет</span></div></div>
    <div className="shop-tabs" role="tablist" aria-label="Раздел магазина">{tabs.map(([key,label,icon])=><button key={key} role="tab" aria-selected={key===category} aria-controls="shop-items" onClick={()=>setCategory(key)}><Icon name={icon} size={21}/>{label}</button>)}</div>
    <div id="shop-items" role="tabpanel">
      <SnapRail key={category} count={list.length} initial={index} current={index} onChange={change}>{list.map(card=>{
        const isOwned=profile.owned.includes(card.key);
        return <article className={`shop-card ${card.category}`} key={card.key} aria-label={card.name}>
          <span className={`card-badge ${isOwned?'owned':''}`}><Icon name={isOwned?'check':'lock'} size={14}/>{profile.selected[category]===card.id?'Выбрано':isOwned?'Твоё':'Открой меня'}</span>
          <div className={`item-art ${card.id}`}>{card.category==='skins'?<><img className="skin-mini left" src={fruitAsset(0,card.id)} alt="" loading="lazy"/><img className="skin-main" src={fruitAsset(5,card.id)} alt="" loading="lazy"/><img className="skin-mini right" src={fruitAsset(10,card.id)} alt="" loading="lazy"/></>:<img className="item-image" src={itemPreview(card)} alt="" loading="lazy"/>}</div>
          <h2>{card.name}</h2><p>{card.description}</p>
          <span className="item-price">{isOwned?<><Icon name="check" size={16}/> В коллекции</>:<><img src={asset('particles/11.webp')} alt=""/>{card.price}</>}</span>
        </article>;
      })}</SnapRail>
    </div>
    <div className="shop-pagination">{list.map((card,i)=><span key={card.key} className={i===index?'active':''}/>)}</div>
    <div className="shop-actions" key={item.key}>
      <span className="shop-current">{item.name}</span>
      {owned?<button className="primary-button" disabled={selected||busy} onClick={()=>onSelect(item)}><Icon name={selected?'check':'sparkle'} size={21}/>{busy?'Загружаем…':selected?'Уже в игре':'Выбрать'}</button>:<>
        <button className="primary-button gold-button" disabled={coins<item.price||busy} onClick={()=>onBuy(item)}><img className="button-coin" src={asset('particles/11.webp')} alt=""/>{coins<item.price?`Нужно ещё ${item.price-coins}`:`Купить за ${item.price}`}</button>
        <button className="reward-button" onClick={()=>onVideo(item)}><Icon name="video" size={25}/><span>Открыть за видео<small>{profile.videos[item.key]??0} / {item.videos} просмотрено</small></span><span className="ad-progress">{Array.from({length:item.videos},(_,i)=><i key={i} className={i<(profile.videos[item.key]??0)?'filled':''}/>)}</span></button>
      </>}
      <button className="text-button" onClick={onCoins}><Icon name="video" size={19}/> +75 монет за видео</button>
    </div>
  </>;
}
