import { ALL_ITEMS, itemByKey, STARTERS, type Category, type ShopItem } from './catalog';

export interface Profile {owned:string[];selected:Record<Category,string>;videos:Record<string,number>;daily:string}
export const defaultProfile=():Profile=>({owned:['skins:fruit','backgrounds:meadow','boxes:glass'],selected:{...STARTERS},videos:{},daily:''});
export function parseProfile(raw:string):Profile {
  const clean=defaultProfile();
  try {
    const data=JSON.parse(raw) as Partial<Profile>;
    if(Array.isArray(data.owned))for(const key of data.owned)if(itemByKey(key)&&!clean.owned.includes(key))clean.owned.push(key);
    for(const category of Object.keys(STARTERS) as Category[]) {
      const id=data.selected?.[category];if(id&&clean.owned.includes(`${category}:${id}`))clean.selected[category]=id;
    }
    for(const item of ALL_ITEMS){const n=data.videos?.[item.key];if(typeof n==='number'&&Number.isFinite(n))clean.videos[item.key]=Math.max(0,Math.min(item.videos,Math.floor(n)));}
    if(typeof data.daily==='string')clean.daily=data.daily;
  } catch { /* A fresh profile is fine when browser storage is unavailable. */ }
  return clean;
}
export function purchase(profile:Profile,item:ShopItem,coins:number) {
  if(profile.owned.includes(item.key)||coins<item.price)return {profile,coins,purchased:false};
  return {profile:{...profile,owned:[...profile.owned,item.key]},coins:coins-item.price,purchased:true};
}
export function rewardUnlock(profile:Profile,item:ShopItem) {
  if(profile.owned.includes(item.key))return {profile,unlocked:false};
  const progress=Math.min(item.videos,(profile.videos[item.key]??0)+1),unlocked=progress>=item.videos;
  return {profile:{...profile,videos:{...profile.videos,[item.key]:progress},owned:unlocked?[...profile.owned,item.key]:profile.owned},unlocked};
}
export function selectItem(profile:Profile,item:ShopItem):Profile {
  return profile.owned.includes(item.key)?{...profile,selected:{...profile.selected,[item.category]:item.id}}:profile;
}
