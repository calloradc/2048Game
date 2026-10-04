import { REST_POINTS, type Node } from './physics';
import bodies from './generatedBodies.json';
const {fruitRepaired,...collections}=bodies;
export interface UV { x: number; y: number }
// Visible flesh bounds, excluding transparent padding and decorative leaves.
// Each rectangle was measured on the exported 256px sprite, independently.
export const FRUIT_BODY = [
  [21,61,233,248], [22,54,232,248], [22,54,232,248], [22,42,230,248],
  [7,25,247,248], fruitRepaired['5'], [19,57,236,248], ...bodies.fruitLarge,
];
export const bodyRect=(level:number,skin='fruit'):number[]=>skin==='fruit'?FRUIT_BODY[level]:(collections as Record<string,number[][]>)[skin][level];
export const bodyUV = (level: number,skin='fruit'): UV[] => {
  const [left,top,right,bottom]=bodyRect(level,skin);
  return REST_POINTS.map(([u,v])=>({x:left+(u+0.5)*(right-left),y:top+(v+0.5)*(bottom-top)}));
};
function clipHalfPlane(polygon: UV[], value: (p: UV)=>number): UV[] {
  const result: UV[]=[];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],va=value(a),vb=value(b);
    if(va>=-0.00001)result.push(a);
    if((va>=0)!==(vb>=0)) {
      const t=va/(va-vb);result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
  }
  return result;
}
// Extend the eight flesh triangles to the image boundary so leaves are painted
// outside the collider, without scaling or moving the physical body texture.
const fanCache=new Map<string,UV[][][]>();
export const spriteFans=(skin='fruit'):UV[][][]=>{
  const existing=fanCache.get(skin);if(existing)return existing;
  const fans=FRUIT_BODY.map((_,level)=>{
    const uv=bodyUV(level,skin),centre=uv[8];
    return Array.from({length:8},(_,i)=>{
      const a=uv[i],b=uv[(i+1)%8];
      let polygon:UV[]=[{x:0,y:0},{x:256,y:0},{x:256,y:256},{x:0,y:256}];
      polygon=clipHalfPlane(polygon,p=>(a.x-centre.x)*(p.y-centre.y)-(a.y-centre.y)*(p.x-centre.x));
      return clipHalfPlane(polygon,p=>(p.x-centre.x)*(b.y-centre.y)-(p.y-centre.y)*(b.x-centre.x));
    });
  });
  fanCache.set(skin,fans);return fans;
};
export const SPRITE_FANS=spriteFans();
export function textureTransform(s: UV[], d: Pick<Node,'x'|'y'>[]) {
  const den=s[0].x*(s[1].y-s[2].y)+s[1].x*(s[2].y-s[0].y)+s[2].x*(s[0].y-s[1].y);
  const affine=(v:number[])=>[
    (v[0]*(s[1].y-s[2].y)+v[1]*(s[2].y-s[0].y)+v[2]*(s[0].y-s[1].y))/den,
    (v[0]*(s[2].x-s[1].x)+v[1]*(s[0].x-s[2].x)+v[2]*(s[1].x-s[0].x))/den,
    (v[0]*(s[1].x*s[2].y-s[2].x*s[1].y)+v[1]*(s[2].x*s[0].y-s[0].x*s[2].y)+v[2]*(s[0].x*s[1].y-s[1].x*s[0].y))/den,
  ];
  return {x:affine(d.map(p=>p.x)),y:affine(d.map(p=>p.y))};
}
