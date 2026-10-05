import { describe, expect, it } from 'vitest';
import { compactBalance } from './compactBalance';

describe('Compact balance labels',()=>{
  it.each([
    [999,'999'],[1000,'1K'],[1543,'1.5K'],[1200,'1.2K'],
    [999950,'1M'],[1543000,'1.5M'],[1000000000,'1B'],[1000000000000,'1T'],
  ])('formats %s as %s',(amount,label)=>expect(compactBalance(amount as number)).toBe(label));
});
