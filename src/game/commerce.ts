import { itemByKey } from './catalog';
import type { Profile } from './profile';
import { SHAKE_PRICE } from './physics';
import { AD_COIN_PACK, PRICE_MULTIPLIER } from './economy';

export interface Bundle {id:string;name:string;caption:string;items:string[];shakes:number;price:number}
export const BUNDLES:Bundle[]=[
  {id:'cozy',name:'Уютный набор',caption:'Шушистики, сакура и розовый бокс',items:['skins:fuzzies','backgrounds:sunset','boxes:rose'],shakes:3,price:360*PRICE_MULTIPLIER},
  {id:'crystal',name:'Звёздный набор',caption:'Кристаллики, лунный сад и ледяной бокс',items:['skins:crystals','backgrounds:moonlight','boxes:ice'],shakes:5,price:720*PRICE_MULTIPLIER},
];
export const SHAKE_PACKS=[{id:'one',amount:1,price:25*PRICE_MULTIPLIER},{id:'five',amount:5,price:100*PRICE_MULTIPLIER}] as const;

export function bundleOffer(profile:Profile,bundle:Bundle) {
  const retail=bundle.items.reduce((sum,key)=>sum+itemByKey(key)!.price,0)+bundle.shakes*SHAKE_PRICE;
  const remaining=bundle.items.filter(key=>!profile.owned.includes(key));
  const value=remaining.reduce((sum,key)=>sum+itemByKey(key)!.price,0)+bundle.shakes*SHAKE_PRICE;
  const price=Math.ceil(bundle.price*value/retail);
  return {remaining,price,saving:value-price,bought:profile.bundles.includes(bundle.id)};
}
export function purchaseBundle(profile:Profile,bundle:Bundle,coins:number) {
  const offer=bundleOffer(profile,bundle);
  if(offer.bought||coins<offer.price)return {profile,coins,purchased:false};
  const selected={...profile.selected};
  bundle.items.forEach(key=>{const item=itemByKey(key)!;selected[item.category]=item.id;});
  return {profile:{...profile,selected,owned:[...profile.owned,...offer.remaining],shakeTokens:profile.shakeTokens+bundle.shakes,bundles:[...profile.bundles,bundle.id]},coins:coins-offer.price,purchased:true};
}
export function purchaseShakes(profile:Profile,pack:typeof SHAKE_PACKS[number],coins:number) {
  if(coins<pack.price)return {profile,coins,purchased:false};
  return {profile:{...profile,shakeTokens:profile.shakeTokens+pack.amount},coins:coins-pack.price,purchased:true};
}
export function rewardCoinPack(profile:Profile) {
  const complete=profile.coinVideo===1;
  return {profile:{...profile,coinVideo:complete?0:1},coins:complete?AD_COIN_PACK:0};
}
