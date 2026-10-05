import { describe, expect, it } from 'vitest';
import { mergeSaves, validateSave, type GameSave } from './storage';
import type { Profile } from '../game/profile';
const profile=(extra:Partial<Profile>={}):Profile=>({owned:['skins:fruit','backgrounds:meadow','boxes:glass'],selected:{skins:'fruit',backgrounds:'meadow',boxes:'glass'},videos:{},daily:'',dailyCount:0,shakeTokens:0,bundles:[],coinVideo:0,...extra});
const save=(extra:Partial<GameSave>={}):GameSave=>({version:1,updatedAt:100,best:100,coins:50,profile:profile(),settings:{muted:false},...extra});
describe('Cloud progress reconciliation',()=>{
  it('retains local progress when cloud is empty, invalid or a newer default',()=>{
    expect(validateSave({})).toBeNull();
    expect(mergeSaves(save(),null)).toEqual(save());
    expect(mergeSaves(save(),save({updatedAt:200,best:0,coins:0}))).toEqual(save());
  });
  it('takes the current wallet instead of resurrecting spent coins',()=>{
    const local=save({updatedAt:200,coins:10}),cloud=save({coins:1000,best:200});
    expect(mergeSaves(local,cloud)).toMatchObject({coins:10,best:200,updatedAt:200});
  });
  it('restores newer cloud progress while retaining purchases and daily claims',()=>{
    const local=save({profile:profile({owned:[...profile().owned,'skins:sushi'],daily:'2026-10-05',dailyCount:3,videos:{'skins:sushi':3}})});
    const cloud=save({updatedAt:200,coins:20,profile:profile({owned:[...profile().owned,'boxes:rose'],daily:'2026-10-04',videos:{'skins:sushi':1}})});
    const merged=mergeSaves(local,cloud);
    expect(merged.coins).toBe(20);expect(merged.profile?.owned).toContain('skins:sushi');expect(merged.profile?.owned).toContain('boxes:rose');
    expect(merged.profile).toMatchObject({daily:'2026-10-05',dailyCount:3,videos:{'skins:sushi':3}});
  });
});
