import { asset } from '../game/fruits';
export type IconName='sound'|'mute'|'restart'|'help'|'shake'|'hand'|'leaf'|'trophy'|'play'|'close'|'fullscreen'|'right'|'left'|'sparkle'|'settings'|'shop'|'video'|'gift'|'skin'|'background'|'box'|'check'|'lock'|'double'|'rescue'|'vibrate';
export const Icon=({name,size=22}:{name:IconName;size?:number})=><img className="ui-icon" src={asset(`ui/icon-${name}.webp`)} alt="" aria-hidden="true" draggable={false} style={{width:size,height:size}} />;
