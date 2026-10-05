import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import messages from './locales/messages.json';
import { LANGUAGES, setLanguage, t } from './i18n';
import { ALL_ITEMS, SKIN_NAMES } from './game/catalog';
import { BUNDLES } from './game/commerce';
import { prizeName } from './game/rewards';

afterEach(()=>setLanguage('ru'));
describe('Complete localization',()=>{
  it('covers every interface literal and every catalog name',()=>{
    const keys=new Set(Object.keys(messages));
    const files=['src/App.tsx',...readdirSync('src/ui').filter(file=>file.endsWith('.tsx')).map(file=>`src/ui/${file}`)];
    const missing:string[]=[];
    for(const file of files){
      const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      const visit=(node:ts.Node)=>{
        if(ts.isStringLiteral(node)&&/[А-Яа-яЁё]/.test(node.text)&&!keys.has(node.text))missing.push(`${file}: ${node.text}`);
        if(ts.isJsxText(node)&&/[А-Яа-яЁё]/.test(node.text))missing.push(`${file}: raw JSX ${node.text}`);
        ts.forEachChild(node,visit);
      };visit(ast);
    }
    setLanguage('ru');
    const names=[...ALL_ITEMS.flatMap(item=>[item.name,item.description]),...BUNDLES.flatMap(bundle=>[bundle.name,bundle.caption]),...Object.keys(SKIN_NAMES).flatMap(skin=>SKIN_NAMES[skin])];
    expect(missing).toEqual([]);
    expect(names.filter(name=>!keys.has(name))).toEqual([]);
  });
  it('provides four complete translations with identical interpolation fields',()=>{
    const tokens=(value:string)=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
    for(const [source,translations] of Object.entries(messages)){
      expect(translations).toHaveLength(4);
      for(const translation of translations){expect(translation.trim()).not.toBe('');expect(translation).not.toMatch(/[А-Яа-яЁё]/);expect(tokens(translation)).toEqual(tokens(source));}
    }
  });
  it('changes catalog, characters and plural forms immediately in every language',()=>{
    for(const [code] of LANGUAGES){
      setLanguage(code);
      expect(t('Купить за {n}',{n:125})).not.toContain('{n}');
      if(code!=='ru')expect([...ALL_ITEMS.flatMap(item=>[item.name,item.description]),...Object.keys(SKIN_NAMES).flatMap(skin=>SKIN_NAMES[skin])].join(' ')).not.toMatch(/[А-Яа-яЁё]/);
    }
    setLanguage('en');expect(prizeName({type:'shakes',amount:21})).toBe('+21 shakes');
    setLanguage('ru');expect(prizeName({type:'shakes',amount:21})).toBe('+21 встряска');
  });
});
