import { t, localeTag } from '../i18n';
import { itemByKey } from './catalog';
import type { Profile } from './profile';

export type DailyPrize={type:'coins';amount:number}|{type:'shakes';amount:number}|{type:'item';key:string;duplicateCoins:number};
export const DAILY_PRIZES:DailyPrize[]=[
  {type:'coins',amount:25},
  {type:'shakes',amount:2},
  {type:'coins',amount:60},
  {type:'item',key:'boxes:lunar',duplicateCoins:120},
  {type:'coins',amount:120},
  {type:'item',key:'backgrounds:aurora',duplicateCoins:150},
  {type:'item',key:'skins:mochi',duplicateCoins:200},
  {type:'coins',amount:80},
  {type:'shakes',amount:3},
  {type:'coins',amount:150},
  {type:'shakes',amount:4},
  {type:'coins',amount:220},
  {type:'shakes',amount:5},
  {type:'item',key:'skins:crystals',duplicateCoins:480},
  {type:'coins',amount:180},
  {type:'shakes',amount:3},
  {type:'coins',amount:240},
  {type:'item',key:'boxes:cloud',duplicateCoins:350},
  {type:'coins',amount:300},
  {type:'shakes',amount:5},
  {type:'item',key:'skins:pillows',duplicateCoins:500},
];

export const calendarDay=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function effectivePrize(prize:DailyPrize,profile:Profile):DailyPrize {
  return prize.type==='item'&&profile.owned.includes(prize.key)?{type:'coins',amount:prize.duplicateCoins}:prize;
}
export function claimDaily(profile:Profile,date:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||profile.daily>=date)return {profile,prize:null,coins:0};
  const prize=effectivePrize(DAILY_PRIZES[profile.dailyCount%DAILY_PRIZES.length],profile);
  const next={...profile,daily:date,dailyCount:profile.dailyCount+1};
  if(prize.type==='item'){
    if(!itemByKey(prize.key))return {profile,prize:null,coins:0};
    next.owned=[...profile.owned,prize.key];
  }
  if(prize.type==='shakes')next.shakeTokens+=prize.amount;
  return {profile:next,prize,coins:prize.type==='coins'?prize.amount:0};
}
export function prizeName(prize:DailyPrize) {
  if(prize.type==='item')return itemByKey(prize.key)!.name;
  if(prize.type==='coins')return t('+{n} монет',{n:prize.amount});
  const form=new Intl.PluralRules(localeTag()).select(prize.amount);
  return t(form==='one'?'+{n} встряска':form==='few'?'+{n} встряски':'+{n} встрясок',{n:prize.amount});
}
