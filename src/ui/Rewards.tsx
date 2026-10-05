import { asset, fruitAsset } from '../game/fruits';
import { itemByKey, itemPreview, type ShopItem } from '../game/catalog';
import { DAILY_PRIZES, effectivePrize, prizeName, type DailyPrize } from '../game/rewards';
import type { Profile } from '../game/profile';
import { Icon } from './Icon';

type Props={profile:Profile;day:string;busy:boolean;onClaim:()=>void;onSelect:(item:ShopItem)=>void;onClose:()=>void};
function PrizeArt({prize}:{prize:DailyPrize}) {
  return prize.type==='coins'?<img src={asset('particles/11.webp')} alt=""/>:prize.type==='shakes'?<Icon name="shake" size={45}/>:<img src={itemPreview(itemByKey(prize.key)!)} alt=""/>;
}

export function Rewards({profile,day,busy,onClaim,onSelect,onClose}:Props) {
  const claimedToday=profile.daily>=day;
  const completed=claimedToday&&profile.dailyCount%7===0&&profile.dailyCount>0?7:profile.dailyCount%7;
  return <>
    <header className="rewards-heading"><Icon name="gift" size={32}/><div><span className="eyebrow">КАЖДЫЙ ДЕНЬ ЧТО-ТО ПРИЯТНОЕ</span><h1>Ежедневные награды</h1></div></header>
    <div className="rewards-scroll">
      <section className="daily-hero"><div><span className="exclusive-tag">ТОЛЬКО ЗА ПОДАРКИ</span><h2>Неделя маленьких чудес</h2><p>Собери лунную коллекцию за 7 дней</p><span className="daily-week-progress">{completed} / 7 подарков</span></div><img src={fruitAsset(10,'mochi')} alt="Лунный король"/></section>
      <div className="daily-list">{DAILY_PRIZES.map((original,index)=>{
        const received=index<completed,available=index===completed&&!claimedToday;
        const prize=received?original:effectivePrize(original,profile);
        const item=original.type==='item'?itemByKey(original.key):undefined;
        const canEquip=received&&item&&profile.owned.includes(item.key);
        const selected=item&&profile.selected[item.category]===item.id;
        return <article key={index} className={`daily-prize ${available?'available':''} ${received?'received':''} ${original.type==='item'?'exclusive':''}`} data-day={index+1}>
          <div className={`daily-prize-art ${prize.type}`}><PrizeArt prize={prize}/></div>
          <div className="daily-prize-copy"><span className="daily-day">ДЕНЬ {index+1}{available&&<b>СЕГОДНЯ</b>}</span><h3>{prizeName(prize)}</h3><span className="daily-prize-note">{original.type==='item'?'Эксклюзивная коллекция':original.type==='shakes'?'Остаются с тобой между играми':'В твою копилку'}</span></div>
          {available?<button className="daily-claim" onClick={onClaim} aria-label="Забрать ежедневный подарок">Забрать</button>:canEquip?<button className="daily-equip" disabled={!!selected||busy} onClick={()=>onSelect(item)} aria-label={`Надеть ${item.name}`}>{selected?<Icon name="check" size={20}/>:<Icon name="play" size={20}/>}</button>:received?<span className="daily-state" aria-label="Получено"><Icon name="check" size={21}/></span>:<span className="daily-state locked"><Icon name="lock" size={18}/><small>{index===completed&&claimedToday?'Завтра':`День ${index+1}`}</small></span>}
        </article>;
      })}</div>
      <p className="daily-note">Заходи за новым подарком каждый день. Пропуск дня не сбрасывает прогресс.</p>
    </div>
    <footer className="rewards-footer"><button className="primary-button" onClick={onClose}><Icon name="play" size={24}/>В игру</button></footer>
  </>;
}
