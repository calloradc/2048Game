import { t } from '../i18n';
import { useRef } from 'react';
import { asset, fruitAsset } from '../game/fruits';
import { itemByKey, itemPreview, type ShopItem } from '../game/catalog';
import { DAILY_PRIZES, effectivePrize, prizeName, type DailyPrize } from '../game/rewards';
import type { Profile } from '../game/profile';
import { Icon } from './Icon';
import { PreviewImage } from './PreviewImage';
import { useReveal } from './useReveal';
import { SoftScroll } from './SoftScroll';

type Props={profile:Profile;day:string;busy:boolean;onClaim:()=>void;onSelect:(item:ShopItem)=>void;onClose:()=>void};
function PrizeArt({prize}:{prize:DailyPrize}) {
  if(prize.type==='item'&&itemByKey(prize.key)?.category==='backgrounds')return <div className="daily-background-preview backgrounds"><div className="card-art"><PreviewImage className="item-image" src={itemPreview(itemByKey(prize.key)!)}/></div></div>;
  return prize.type==='coins'?<PreviewImage src={asset("particles/11.webp")}/>:prize.type==='shakes'?<Icon name="shake" size={45}/>:<PreviewImage src={itemPreview(itemByKey(prize.key)!)}/>;
}

export function Rewards({profile,day,busy,onClaim,onSelect,onClose}:Props) {
  const scroll=useRef<HTMLDivElement>(null);useReveal(scroll);
  const claimedToday=profile.daily>=day;
  const cycle=DAILY_PRIZES.length;
  const completed=claimedToday&&profile.dailyCount%cycle===0&&profile.dailyCount>0?cycle:profile.dailyCount%cycle;
  return <>
    <header className="rewards-heading"><Icon name="gift" size={32}/><div><span className="eyebrow">{t("КАЖДЫЙ ДЕНЬ ЧТО-ТО ПРИЯТНОЕ")}</span><h1>{t("Ежедневные награды")}</h1></div></header>
    <SoftScroll className="rewards-scroll" viewportRef={scroll}>
      <section className="daily-hero" data-reveal><div><span className="exclusive-tag">{t("21 ДЕНЬ МАЛЕНЬКИХ ЧУДЕС")}</span><h2>{t("Три недели подарков")}</h2><p>{t("Лунная коллекция, облачный бокс и сонные подушки")}</p><span className="daily-week-progress">{t("{n} / {total} подарков",{n:completed,total:cycle})}</span><div className="daily-progress-track" role="progressbar" aria-label={t("Получено подарков")} aria-valuemin={0} aria-valuemax={cycle} aria-valuenow={completed}><span style={{transform:`scaleX(${completed/cycle})`}}/></div></div><PreviewImage src={fruitAsset(10,'pillows')} alt={t("Звёздная подушка")} eager/></section>
      <div className="daily-list" role="list" aria-label={t("Подарки на 21 день")}>{DAILY_PRIZES.map((original,index)=>{
        const received=index<completed,available=index===completed&&!claimedToday;
        const prize=received?original:effectivePrize(original,profile);
        const item=original.type==='item'?itemByKey(original.key):undefined;
        const canEquip=received&&item&&profile.owned.includes(item.key);
        const selected=item&&profile.selected[item.category]===item.id;
        return <article key={index} role="listitem" aria-label={t("День {n}: {item}, {status}",{n:index+1,item:prizeName(prize),status:received?t("получено"):available?t("доступно сегодня"):t("скоро")})} className={`daily-prize ${available?'available':''} ${received?'received':''} ${original.type==='item'?'exclusive':''} ${(index+1)%7===0?'milestone':''}`} data-reveal data-day={index+1}>
          <span className="daily-day">{t("ДЕНЬ {n}",{n:index+1})}{available&&<b>{t("СЕГОДНЯ")}</b>}</span>
          <div className={`daily-prize-art ${prize.type}`}><PrizeArt prize={prize}/></div>
          <div className="daily-prize-copy"><h3>{prizeName(prize)}</h3><span className="daily-prize-note">{prize.type==='coins'?t("В копилку"):prize.type==='shakes'?t("В запас"):item?.exclusive?t("Эксклюзив"): t("11 сияющих героев")}</span></div>
          {available?<button className="daily-claim" disabled={busy} onClick={onClaim} aria-label={t("Забрать ежедневный подарок")}>{t("Забрать")}</button>:canEquip?<button className="daily-equip" disabled={!!selected||busy} onClick={()=>onSelect(item)} aria-label={t("Надеть {item}",{item:item.name})}><Icon name={selected?'check':'play'} size={18}/><span>{selected?t("В игре"):t("Надеть")}</span></button>:received?<span className="daily-state" aria-label={t("Получено")}><Icon name="check" size={18}/><small>{t("Получено")}</small></span>:<span className="daily-state locked"><Icon name="lock" size={15}/><small>{index===completed&&claimedToday||completed===cycle&&index===0?t("Завтра"):t("Скоро")}</small></span>}
        </article>;
      })}</div>
      <p className="daily-note">{t("Заходи за новым подарком каждый день. Пропуск дня не сбрасывает прогресс.")}</p>
    </SoftScroll>
    <footer className="rewards-footer"><button className="primary-button" onClick={onClose}><Icon name="play" size={24}/>{t("В игру")}</button></footer>
  </>;
}
