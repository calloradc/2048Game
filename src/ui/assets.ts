import { asset } from '../game/fruits';
export const uiAsset=(name:string)=>asset(`ui/generated/${name}.webp`);
// Only icons are artwork. Panels, buttons and photo frames are native HTML/CSS.
export const UI_ARTWORK=[
  ...['sound','mute','restart','help','shake','hand','leaf','trophy','play','fullscreen','right','left','sparkle','settings','shop','video','gift','skin','background','box','check','lock','double','rescue','vibrate'].map(name=>`icon-${name}`),
].map(uiAsset);
