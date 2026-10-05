import type { CSSProperties } from 'react';
import { asset, fruitAsset } from '../game/fruits';
import { itemByKey, itemPreview, type ShopItem } from '../game/catalog';
import { DAILY_PRIZES, effectivePrize, prizeName, type DailyPrize } from '../game/rewards';
import type { Profile } from '../game/profile';
import { Icon } from './Icon';
import { PreviewImage } from './PreviewImage';

type Props={profile:Profile;day:string;busy:boolean;onClaim:()=>void;onSelect:(item:ShopItem)=>void;onClose:()=>void};
function PrizeArt({prize}:{prize:DailyPrize}) {
  return prize.type==='coins'?<PreviewImage src={asset('particles/11.webp')}/>:prize.type==='shakes'?<Icon name="shake" size={45}/>:<PreviewImage src={itemPreview(itemByKey(prize.key)!)}/>;
}

export function Rewards({profile,day,busy,onClaim,onSelect,onClose}:Props) {
  const claimedToday=profile.daily>=day;
  const cycle=DAILY_PRIZES.length;
  const completed=claimedToday&&profile.dailyCount%cycle===0&&profile.dailyCount>0?cycle:profile.dailyCount%cycle;
  return <>
    <header className="rewards-heading"><Icon name="gift" size={32}/><div><span className="eyebrow">КАЖДЫЙ ДЕНЬ ЧТО-ТО ПРИЯТНОЕ</span><h1>Ежедневные награды</h1></div></header>
    <div className="rewards-scroll">
      <section className="daily-hero"><div><span className="exclusive-tag">14 ДНЕЙ МАЛЕНЬКИХ ЧУДЕС</span><h2>Две недели подарков</h2><p>Лунная коллекция и кристальный финал</p><span className="daily-week-progress">{completed} / {cycle} подарков</span><div className="daily-progress-track" role="progressbar" aria-label="Получено подарков" aria-valuemin={0} aria-valuemax={cycle} aria-valuenow={completed}><span style={{transform:`scaleX(${completed/cycle})`}}/></div></div><PreviewImage src={fruitAsset(10,'mochi')} alt="Лунный король" eager/></section>
      <div className="daily-list" role="list" aria-label="Подарки на 14 дней">{DAILY_PRIZES.map((original,index)=>{
        const received=index<completed,available=index===completed&&!claimedToday;
        const prize=received?original:effectivePrize(original,profile);
        const item=original.type==='item'?itemByKey(original.key):undefined;
        const canEquip=received&&item&&profile.owned.includes(item.key);
        const selected=item&&profile.selected[item.category]===item.id;
        return <article key={index} role="listitem" aria-label={`День ${index+1}: ${prizeName(prize)}, ${received?'получено':available?'доступно сегодня':'скоро'}`} className={`daily-prize ${available?'available':''} ${received?'received':''} ${original.type==='item'?'exclusive':''} ${(index+1)%7===0?'milestone':''}`} style={{'--prize-delay':`${Math.min(index*35,350)}ms`} as CSSProperties} data-day={index+1}>
          <span className="daily-day">ДЕНЬ {index+1}{available&&<b>СЕГОДНЯ</b>}</span>
          <div className={`daily-prize-art ${prize.type}`}><PrizeArt prize={prize}/></div>
          <div className="daily-prize-copy"><h3>{prizeName(prize)}</h3><span className="daily-prize-note">{prize.type==='coins'?'В копилку':prize.type==='shakes'?'В запас':item?.exclusive?'Эксклюзив': '11 сияющих героев'}</span></div>
          {available?<button className="daily-claim" disabled={busy} onClick={onClaim} aria-label="Забрать ежедневный подарок">Забрать</button>:canEquip?<button className="daily-equip" disabled={!!selected||busy} onClick={()=>onSelect(item)} aria-label={`Надеть ${item.name}`}><Icon name={selected?'check':'play'} size={18}/><span>{selected?'В игре':'Надеть'}</span></button>:received?<span className="daily-state" aria-label="Получено"><Icon name="check" size={18}/><small>Получено</small></span>:<span className="daily-state locked"><Icon name="lock" size={15}/><small>{index===completed&&claimedToday||completed===cycle&&index===0?'Завтра':'Скоро'}</small></span>}
        </article>;
      })}</div>
      <p className="daily-note">Заходи за новым подарком каждый день. Пропуск дня не сбрасывает прогресс.</p>
    </div>
    <footer className="rewards-footer"><button className="primary-button" onClick={onClose}><Icon name="play" size={24}/>В игру</button></footer>
  </>;
}
