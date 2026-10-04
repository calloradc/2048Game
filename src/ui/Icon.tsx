import { useId, type ReactNode } from 'react';
export type IconName='sound'|'mute'|'restart'|'help'|'shake'|'hand'|'leaf'|'trophy'|'play'|'close'|'fullscreen'|'right'|'left'|'sparkle'|'settings'|'shop'|'video'|'gift'|'skin'|'background'|'box'|'check'|'lock'|'double'|'rescue'|'vibrate';

const colors:Record<IconName,[string,string]>={
  sound:['#50caff','#287be7'],mute:['#abc3d9','#6a83a8'],restart:['#59e4b9','#14a981'],
  help:['#a590ff','#7055e8'],shake:['#ffce52','#ff8a27'],hand:['#ffe3a2','#ffb768'],
  leaf:['#a3ed4d','#2fba62'],trophy:['#ffe65c','#ffaa22'],play:['#78eda8','#1bb87a'],
  close:['#ff9a96','#f35770'],fullscreen:['#5ce0f5','#228ed8'],right:['#4edbd2','#129caf'],
  left:['#4edbd2','#129caf'],sparkle:['#fff37e','#ffb828'],settings:['#72d9ff','#4e7ef2'],
  shop:['#ff9885','#ed4e75'],video:['#ac97ff','#7858e8'],gift:['#ff9fdb','#ef4ca6'],
  skin:['#9ee961','#36b77d'],background:['#67e5e1','#238fda'],box:['#92f3ff','#36b7da'],
  check:['#84ed9c','#24b778'],lock:['#ffdf65','#e9a334'],double:['#ffe86f','#ffad32'],
  rescue:['#ffb193','#f56a78'],vibrate:['#86adff','#635cdb'],
};

/** Each game icon has its own colors and crisp shapes at any screen density. */
export function Icon({name,size=22}:{name:IconName;size?:number}) {
  const id=useId().replace(/:/g,'');
  const fill=`url(#${id})`;
  const shapes:Record<IconName,ReactNode>={
    shop:<><path fill={fill} d="M9 18h30l-2 23H11Z"/><path fill="#fff3d3" d="M6 10h36l-3 11H9Z"/><path stroke="#ef6683" strokeWidth="5" d="m14 11-1 8m11-8v8m10-8 1 8"/><path fill="#ffd254" d="M20 28h10v13H20Z"/><path fill="#57d3d3" d="M12 28h5v6h-5Z"/><path stroke="#fff" opacity=".8" d="m12 23-1 11"/></>,
    settings:<><path fill={fill} d="m20 5 8 0 2 6 5 2 6-1 4 7-4 5 0 5 4 5-4 7-6-1-5 2-2 5h-8l-2-5-5-2-6 1-4-7 4-5v-5l-4-5 4-7 6 1 5-2Z" transform="translate(0 -3)"/><circle cx="24" cy="23" r="9" fill="#fff0a4"/><circle cx="24" cy="23" r="4" fill="#e99c32" stroke="none"/></>,
    gift:<><rect x="8" y="20" width="32" height="23" rx="4" fill={fill}/><rect x="5" y="15" width="38" height="11" rx="3" fill={fill}/><path fill="#ffdf58" d="M21 16h7v27h-7Z"/><path fill="#ffdf58" d="M24 15C6 19 8 2 16 6c6 3 8 9 8 9Zm0 0c18 4 16-13 8-9-6 3-8 9-8 9Z"/><path stroke="#fff" opacity=".75" d="M11 30v8m-2-19h7"/></>,
    video:<><rect x="5" y="13" width="30" height="25" rx="7" fill={fill}/><path fill="#ffdc62" d="m35 20 9-5v21l-9-5Z"/><path fill="#fff" stroke="none" d="m17 19 11 7-11 7Z"/><path stroke="#e4dcff" d="M11 18h6"/></>,
    trophy:<><path fill="#ffc344" d="M12 11H5v8c0 8 7 10 12 10m19-18h7v8c0 8-7 10-12 10"/><path fill={fill} d="M12 6h24v15c0 8-5 13-12 13S12 29 12 21Z"/><path stroke="#eda334" strokeWidth="5" d="M24 34v7"/><path fill="#ffdb52" d="M14 39h20v6H14Z"/><path stroke="#fff7c0" strokeWidth="3" d="M17 11v10"/><path fill="#fff7c0" stroke="none" d="m24 12 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1Z"/></>,
    shake:<><path fill={fill} d="m14 13 21-4 5 31-21 4Z"/><path fill="#ffefab" d="m14 13 21-4 1 7-21 4Z"/><path stroke="#fff7ce" strokeWidth="3" d="m20 23 2 13"/><path stroke="#27aacc" strokeWidth="3" d="m5 16 4-5m-5 18 5 4m31-31 4 5m-2 13 3 5"/><path stroke="#c97532" d="m22 10-1-6h8l2 5"/></>,
    sound:<><path fill={fill} d="M6 18h9L27 8v32L15 30H6Z"/><path stroke="#349be4" strokeWidth="4" fill="none" d="M34 15c7 5 7 13 0 18m6-23c11 8 11 20 0 28"/><path stroke="#c8f4ff" d="M11 22v4"/></>,
    mute:<><path fill={fill} d="M6 18h9L27 8v32L15 30H6Z"/><path stroke="#f76883" strokeWidth="5" d="m34 18 10 12m0-12L34 30"/></>,
    play:<><circle cx="24" cy="24" r="20" fill={fill}/><path fill="#fff" stroke="#109868" d="m19 13 15 11-15 11Z"/><path stroke="#d1ffe3" d="M10 17c2-5 5-8 9-8"/></>,
    help:<><circle cx="24" cy="24" r="20" fill={fill}/><path stroke="#fff" strokeWidth="5" fill="none" d="M16 17c1-10 18-9 16 1-1 5-8 4-8 10"/><circle cx="24" cy="35" r="2.5" fill="#fff" stroke="none"/><path stroke="#e3dcff" d="M10 15c2-4 4-6 7-7"/></>,
    close:<><circle cx="24" cy="24" r="20" fill={fill}/><path stroke="#fff" strokeWidth="5" d="m17 17 14 14m0-14L17 31"/></>,
    check:<><circle cx="24" cy="24" r="20" fill={fill}/><path fill="none" stroke="#fff" strokeWidth="5" d="m13 24 8 8 15-17"/></>,
    right:<path fill={fill} d="m18 6 19 18-19 18-8-8 11-10-11-10Z"/>,
    left:<path fill={fill} d="M30 6 11 24l19 18 8-8-11-10 11-10Z"/>,
    restart:<><path fill={fill} d="M39 18A17 17 0 1 1 24 7v7A10 10 0 1 0 32 22Z"/><path fill="#ffdf57" d="m22 3 12 8-12 8Z"/></>,
    leaf:<><path fill={fill} d="M40 5C15 3 5 15 7 29c3 17 29 21 33-24Z"/><path fill="none" stroke="#277f51" strokeWidth="3" d="M8 41 32 14m-16 18 1-11m7 4 10-1"/><path stroke="#d5ff9c" d="M15 12c4-3 9-4 14-4"/></>,
    sparkle:<><path fill={fill} d="m24 3 6 15 15 6-15 6-6 15-6-15-15-6 15-6Z"/><path fill="#fff9c0" stroke="none" d="m24 11 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z"/></>,
    background:<><rect x="4" y="7" width="40" height="34" rx="5" fill="#fff2d0"/><path fill={fill} d="M9 12h30v24H9Z"/><circle cx="31" cy="18" r="4" fill="#ffe353" stroke="none"/><path fill="#61d277" d="m9 32 9-13 9 13 6-7 6 11H9Z"/></>,
    box:<><path fill={fill} d="m7 12 7-5h20l7 5-2 29H9Z"/><path fill="#d5fbff" d="m7 12 7-5h20l7 5-7 5H14Z"/><path fill="none" stroke="#fff" strokeWidth="3" d="m13 22 1 12m20-14-1 16"/><path fill="#ffcb62" d="M19 31h10v7H19Z"/></>,
    skin:<><rect x="6" y="14" width="36" height="30" rx="11" fill={fill}/><path fill="#79dc72" d="m12 14-2-9 10 9m10 0 8-9-2 9"/><ellipse cx="16" cy="27" rx="3" ry="4" fill="#183b43" stroke="none"/><ellipse cx="32" cy="27" rx="3" ry="4" fill="#183b43" stroke="none"/><path fill="none" d="M20 34q4 5 8 0"/><circle cx="11" cy="33" r="3" fill="#ff9bb4" stroke="none"/><circle cx="37" cy="33" r="3" fill="#ff9bb4" stroke="none"/></>,
    lock:<><path fill="none" stroke="#eda43f" strokeWidth="6" d="M14 23V14c0-14 20-14 20 0v9"/><rect x="7" y="20" width="34" height="24" rx="6" fill={fill}/><circle cx="24" cy="30" r="4" fill="#b77b2f" stroke="none"/><path stroke="#b77b2f" strokeWidth="4" d="M24 33v5"/><path stroke="#fff1aa" d="M12 25v9"/></>,
    double:<><circle cx="18" cy="21" r="15" fill={fill}/><circle cx="30" cy="30" r="15" fill={fill}/><path fill="none" stroke="#fff5b7" strokeWidth="3" d="M9 21a9 9 0 0 1 9-9m12 9a9 9 0 0 1 9 9"/><path stroke="#b97825" strokeWidth="3" d="m24 26 8 8m0-8-8 8"/></>,
    rescue:<><path fill={fill} d="M24 43 7 26C-5 10 17-2 24 13c7-15 29-3 17 13Z"/><path fill="#fff2c8" stroke="none" d="M21 17h6v7h7v6h-7v7h-6v-7h-7v-6h7Z"/></>,
    fullscreen:<><rect x="4" y="4" width="40" height="40" rx="11" fill={fill}/><path stroke="#fff" strokeWidth="4" fill="none" d="M12 20v-8h8m8 0h8v8m0 8v8h-8m-8 0h-8v-8"/></>,
    vibrate:<><rect x="14" y="5" width="20" height="38" rx="5" fill={fill}/><path stroke="#dce7ff" d="M20 10h8"/><circle cx="24" cy="36" r="2" fill="#fff" stroke="none"/><path stroke="#7365da" strokeWidth="3" fill="none" d="m7 13-3 6 3 6-3 6m37-18 3 6-3 6 3 6"/></>,
    hand:<><path fill={fill} d="M15 40 8 25c-3-6 3-8 7-1l2 3V8c0-6 7-6 7 0v12c0-5 7-5 7 0 0-5 7-5 7 1 6-3 8 3 6 8l-6 14H20Z"/><path stroke="#fff0c5" d="M20 8v15"/></>,
  };
  return <svg className="ui-icon" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="#24506a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <defs><linearGradient id={id} x1="0%" y1="0%" x2="65%" y2="100%"><stop stopColor={colors[name][0]}/><stop offset="1" stopColor={colors[name][1]}/></linearGradient></defs>
    {shapes[name]}
  </svg>;
}
