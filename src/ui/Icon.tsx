import { uiAsset } from './assets';
export type IconName='sound'|'mute'|'restart'|'help'|'shake'|'hand'|'leaf'|'trophy'|'play'|'close'|'fullscreen'|'right'|'left'|'sparkle'|'settings'|'shop'|'video'|'gift'|'skin'|'background'|'box'|'check'|'lock'|'double'|'rescue'|'vibrate';

/** Independently generated raster artwork; labels always remain real UI text. */
export function Icon({name,size=22}:{name:IconName;size?:number}) {
  if(name==='close')return <span className="ui-icon icon-close" style={{width:size,height:size}} aria-hidden="true"/>;
  return <img className="ui-icon" src={uiAsset(`icon-${name}`)} width={size} height={size} alt="" aria-hidden="true" draggable={false}/>;
}
