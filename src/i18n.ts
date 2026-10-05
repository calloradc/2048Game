import { useSyncExternalStore } from 'react';
import messages from './locales/messages.json';

export const LANGUAGES=[['ru','Русский'],['en','English'],['tr','Türkçe'],['it','Italiano'],['pt','Português']] as const;
export type Language=typeof LANGUAGES[number][0];
const supported=(value:string):value is Language=>LANGUAGES.some(([code])=>code===value);
const detect=():Language=>{
  if(typeof window==='undefined')return 'ru';
  try {const saved=localStorage.getItem('jelly-language');if(saved&&supported(saved))return saved;}catch{/* Optional storage. */}
  for(const candidate of navigator.languages??[navigator.language]){
    const code=candidate.split('-')[0];if(supported(code))return code;
  }
  return 'en';
};
let language=detect();
const listeners=new Set<()=>void>();
const dictionaries:Record<string,string[]>=messages;
export const getLanguage=()=>language;
export const localeTag=()=>({ru:'ru-RU',en:'en-US',tr:'tr-TR',it:'it-IT',pt:'pt-BR'}[language]);
export function t(source:string,params:Record<string,string|number>={}) {
  const index={en:0,tr:1,it:2,pt:3}[language as Exclude<Language,'ru'>];
  const text=language==='ru'?source:dictionaries[source]?.[index]??source;
  return text.replace(/\{(\w+)\}/g,(token,key)=>String(params[key]??token));
}
export function setLanguage(next:Language) {
  if(!supported(next)||next===language)return;
  language=next;
  try{localStorage.setItem('jelly-language',next);}catch{/* Optional storage. */}
  syncDocument();listeners.forEach(listener=>listener());
}
export function syncDocument() {
  if(typeof document==='undefined')return;
  document.documentElement.lang=language;
  document.title=t('Jelly Fruit — фруктовый переполох');
  document.querySelector('meta[name="description"]')?.setAttribute('content',t('Сливай упругие фруктовые кубики и собери арбуз 2048. Уютная игра для телефона.'));
}
export function useLanguage() {
  return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},getLanguage);
}
export const localizedProperty=(object:object,key:string)=>{
  const source=(object as Record<string,string>)[key];
  Object.defineProperty(object,key,{enumerable:true,get:()=>t(source)});
};
syncDocument();
