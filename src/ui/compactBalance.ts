/** Compact balance labels share the same Latin suffixes across the game and shop. */
export function compactBalance(value:number):string {
  const amount=Math.max(0,Math.floor(value));
  const units=[{size:1e12,label:'T'},{size:1e9,label:'B'},{size:1e6,label:'M'},{size:1e3,label:'K'}];
  const unit=units.find(({size})=>amount>=size);
  if(!unit)return String(amount);
  const rounded=Math.round(amount/unit.size*10)/10;
  if(rounded>=1000){const larger=units[units.indexOf(unit)-1];if(larger)return `${Math.round(amount/larger.size*10)/10}${larger.label}`;}
  return `${rounded}${unit.label}`;
}
