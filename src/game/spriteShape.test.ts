import { describe, expect, it } from 'vitest';
import { FruitWorld } from './physics';
import { bodyUV, bodyRect, SPRITE_FANS, spriteFans, textureTransform, type UV } from './spriteShape';
import { CATALOG } from './catalog';

const area = (points: UV[]) => Math.abs(points.reduce((sum,p,i)=>{
  const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;
},0))/2;

describe('Fruit texture follows the physical flesh',()=>{
  it('covers the whole source image once, including leaves outside the body',()=>{
    for(const fans of SPRITE_FANS) {
      expect(fans.reduce((sum,polygon)=>sum+area(polygon),0)).toBeCloseTo(256*256,7);
      for(const polygon of fans)for(const p of polygon) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-7);expect(p.x).toBeLessThanOrEqual(256+1e-7);
        expect(p.y).toBeGreaterThanOrEqual(-1e-7);expect(p.y).toBeLessThanOrEqual(256+1e-7);
      }
    }
  });
  it('keeps measured texture edges on their collider nodes during an impact',()=>{
    for(let level=0;level<11;level++) {
      const world=new FruitWorld(),cube=world.add(level,210,300);
      world.setVelocity(cube,1,9);
      for(let frame=0;frame<45;frame++) {
        world.step();const uv=bodyUV(level);
        for(let i=0;i<8;i++) {
          const indices=[8,i,(i+1)%8],source=indices.map(j=>uv[j]),target=indices.map(j=>cube.nodes[j]);
          const {x:a,y:b}=textureTransform(source,target);
          source.forEach((p,j)=>{
            expect(a[0]*p.x+a[1]*p.y+a[2]).toBeCloseTo(target[j].x,7);
            expect(b[0]*p.x+b[1]*p.y+b[2]).toBeCloseTo(target[j].y,7);
          });
        }
      }
      world.destroy();
    }
  });
  it('maps every new square face uniformly and covers all decorations',()=>{
    for(const skin of CATALOG.skins)for(let level=0;level<11;level++){
      if(skin.id==='fruit'&&level<7)continue;
      const [left,top,right,bottom]=bodyRect(level,skin.id);
      expect(right-left).toBe(bottom-top);
      expect(spriteFans(skin.id)[level].reduce((sum,polygon)=>sum+area(polygon),0)).toBeCloseTo(256*256,6);
      const world=new FruitWorld(),cube=world.add(level,210,250),uv=bodyUV(level,skin.id);
      const {x,y}=textureTransform([uv[8],uv[0],uv[1]],[cube.nodes[8],cube.nodes[0],cube.nodes[1]]);
      expect(x[0]).toBeCloseTo(y[1],8);expect(x[1]).toBeCloseTo(0,8);expect(y[0]).toBeCloseTo(0,8);world.destroy();
    }
  });
});
