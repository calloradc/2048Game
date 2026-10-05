import { describe, expect, it } from 'vitest';
import { nativePixelRatio } from './useGameViewport';

describe('Desktop zoom baseline',()=>{
  it('recognizes initial browser zoom while preserving monitor density',()=>{
    for(const zoom of [.5,.8,1,1.25,1.5,2,3])for(const density of [1,1.5,2])expect(nativePixelRatio(density*zoom,1440/zoom,1440)).toBeCloseTo(density);
  });
  it('keeps embedded and unavailable window dimensions intact',()=>{
    expect(nativePixelRatio(2,700,1440,true)).toBe(2);
    expect(nativePixelRatio(2,700,0)).toBe(2);
  });
});
