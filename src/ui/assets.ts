import { asset } from '../game/fruits';
export const uiAsset=(name:string)=>asset(`ui/generated/${name}.webp`);
const surfaces=[
  'button-green','button-gold','button-purple','button-shop','button-play','button-square','button-square-purple','button-square-pink','button-square-close','wallet','next-panel','evolution-panel','dialog-panel','setting-strip','card-skin','card-background','card-box','toast-panel','shop-wallpaper',
];
export const UI_ARTWORK=[
  ...['sound','mute','restart','help','shake','hand','leaf','trophy','play','close','fullscreen','right','left','sparkle','settings','shop','video','gift','skin','background','box','check','lock','double','rescue','vibrate'].map(name=>`icon-${name}`),...surfaces,
].map(uiAsset);
// Share exact resource URLs with the loader; CSS bundling must not duplicate textures.
export const UI_TEXTURES=Object.fromEntries(surfaces.map(name=>[`--ui-${name}`,`url("${new URL(uiAsset(name),document.baseURI).href}")`]));
