import { asset } from '../game/fruits';
// New filenames also refresh public artwork cached by embedded browsers.
const refreshed:Record<string,string>={'icon-shop':'icon-shop-basket-red','icon-close':'icon-close-coral'};
export const uiAsset=(name:string)=>asset(`ui/generated/${refreshed[name]??name}.webp`);
// Only icons are artwork. Panels, buttons and photo frames are native HTML/CSS.
export const UI_ARTWORK=[
  ...['sound','mute','restart','help','shake','hand','leaf','trophy','play','close','fullscreen','right','left','sparkle','settings','shop','video','gift','skin','background','box','check','lock','double','rescue','vibrate'].map(name=>`icon-${name}`),
].map(uiAsset);
