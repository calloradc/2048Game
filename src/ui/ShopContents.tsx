import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { itemByKey, itemPreview, SKIN_NAMES, type ShopItem } from '../game/catalog';
import { fruitAsset } from '../game/fruits';
import type { Bundle } from '../game/commerce';
import { Icon } from './Icon';
import { PreviewImage } from './PreviewImage';
import { SoftScroll } from './SoftScroll';
import { usePresence } from './usePresence';

export type Contents={type:'item';item:ShopItem}|{type:'bundle';bundle:Bundle};
export function ShopContents({contents,onClose,onItem}:{contents:Contents|null;onClose:()=>void;onItem:(item:ShopItem)=>void}) {
  const {rendered,leaving}=usePresence(contents),dialog=useRef<HTMLDivElement>(null),opener=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(!contents)return;
    opener.current=document.activeElement as HTMLElement;dialog.current?.focus({preventScroll:true});
    return()=>opener.current?.focus({preventScroll:true});
  },[contents]);
  if(!rendered)return null;
  const title=rendered.type==='item'?rendered.item.name:rendered.bundle.name;
  return createPortal(<div className={`contents-overlay ${leaving?'is-leaving':''}`} onPointerDown={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose();}}>
    <div className="contents-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label={`Содержимое: ${title}`} tabIndex={-1} inert={leaving} onKeyDown={event=>{
      if(event.key==='Escape'){event.stopPropagation();onClose();}
      if(event.key==='Tab'){
        const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button');if(!buttons?.length)return;
        if(event.shiftKey&&(document.activeElement===buttons[0]||document.activeElement===dialog.current)){event.preventDefault();buttons[buttons.length-1].focus();}
        else if(!event.shiftKey&&document.activeElement===buttons[buttons.length-1]){event.preventDefault();buttons[0].focus();}
      }
    }}>
      <header><span className="eyebrow">СОДЕРЖИМОЕ</span><h2>{title}</h2><button className="dialog-close" aria-label="Закрыть содержимое" onClick={onClose}><Icon name="close" size={24}/></button></header>
      <SoftScroll className="contents-scroll"><div className={`contents-grid ${rendered.type==='item'&&rendered.item.category==='skins'?'skin':rendered.type}`}>
        {rendered.type==='item'&&rendered.item.category==='skins'?SKIN_NAMES[rendered.item.id].map((name,level)=><figure key={level} style={{animationDelay:`${Math.min(level*30,180)}ms`}}><PreviewImage src={fruitAsset(level,rendered.item.id)} eager/><figcaption>{name}</figcaption></figure>):rendered.type==='item'?<figure className={`contents-preview ${rendered.item.category}`}><PreviewImage src={itemPreview(rendered.item)} eager/><figcaption>{rendered.item.description}</figcaption></figure>:<>
          {rendered.bundle.items.map(key=>{const item=itemByKey(key)!;return <button className={`contents-item ${item.category}`} key={key} onClick={()=>{onClose();onItem(item);}}><div><PreviewImage src={itemPreview(item)} eager/></div><strong>{item.name}</strong><span>Посмотреть в магазине<Icon name="right" size={14}/></span></button>;})}
          <div className="contents-shakes"><Icon name="shake" size={40}/><strong>+{rendered.bundle.shakes} встряски</strong></div>
        </>}
      </div></SoftScroll>
      <button className="primary-button" onClick={onClose}>Понятно</button>
    </div>
  </div>,document.querySelector('.game-screen')!);
}
