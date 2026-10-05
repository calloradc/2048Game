import assert from 'node:assert/strict';
import { installYandexMock } from './yandex-mock.mjs';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { checkShop } from './shop-smoke.mjs';
import { checkGameover } from './gameover-smoke.mjs';
import { checkRewardsAndOffers } from './rewards-smoke.mjs';
import { checkShopBehavior } from './shop-behavior-smoke.mjs';
import { checkUiMotion } from './ui-motion-smoke.mjs';
import { checkRefresh } from './refresh-smoke.mjs';
import { checkLocalization } from './localization-smoke.mjs';
import { checkDesktop } from './desktop-smoke.mjs';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true, args: ['--no-sandbox'],
});
const createPage=browser.newPage.bind(browser);
browser.newPage=async options=>{const page=await createPage({locale:'ru-RU',...options});await installYandexMock(page);return page;};
const base = process.env.GAME_URL || 'http://localhost:5173/';
const errors = [];
await mkdir('test-results', { recursive: true });
try {
  const loading = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let releaseAsset;
  const assetGate=new Promise(resolve=>{releaseAsset=resolve;});
  await loading.route('**/countryside.webp',async route=>{await assetGate;await route.continue();});
  await loading.goto(base,{waitUntil:'domcontentloaded'});
  await loading.locator('.loading-screen').waitFor({state:'visible'});
  const splash=await loading.locator('.loading-screen').boundingBox();
  assert.deepEqual(splash,{x:0,y:0,width:390,height:844},'Loading fills the viewport');
  assert.ok(await loading.locator('.scene').evaluate(el=>el.inert),'Game waits for assets');
  assert.ok(Number(await loading.getByRole('progressbar').getAttribute('aria-valuenow'))<100);
  await loading.screenshot({path:'test-results/loading.png'});
  releaseAsset();
  await loading.locator('.loading-screen').waitFor({state:'detached'});
  assert.ok(!await loading.locator('.scene').evaluate(el=>el.inert));
  await loading.close();
  console.log('✓ fullscreen loading waits for assets and reports real progress');
  for (const [width, height] of [[390,844], [360,640], [320,568], [768,1024], [1440,900], [844,390]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 600, hasTouch: true, deviceScaleFactor: 2 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
    await page.addInitScript(() => {
      Math.random=()=>0.01;
      const rotate=CanvasRenderingContext2D.prototype.rotate;
      CanvasRenderingContext2D.prototype.rotate=function(angle){
        if(this.canvas===document.querySelector('canvas'))window.__jellyPreviewAngle=angle;
        return rotate.call(this,angle);
      };
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('.loading'));
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const r = document.querySelector('.scene').getBoundingClientRect();
      return { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, x: r.x, y: r.y, bottom: r.bottom, right: r.right };
    });
    assert.equal(metrics.w, width); assert.equal(metrics.h, height);
    assert.ok(await page.evaluate(() => {
      const field=document.querySelector('.playfield').getBoundingClientRect(),canvas=document.querySelector('canvas').getBoundingClientRect();
      return Math.abs(field.y-canvas.y-70*field.width/420)<1 && Math.abs(field.y+field.height-canvas.y-canvas.height)<1 && document.fonts.check('900 14px Nunito');
    }), 'Canvas stays inside its field; Nunito loaded');
    assert.ok(metrics.x >= -1 && metrics.y >= -1 && metrics.bottom <= height + 1 && metrics.right <= width + 1, `Scene fits ${width}×${height}`);
    assert.ok(await page.locator('.ambient-background').evaluate(el=>{
      const r=el.getBoundingClientRect();return r.left<=0&&r.right>=innerWidth&&r.top<=0&&r.bottom>=innerHeight&&getComputedStyle(el,'::before').backgroundSize==='cover'&&getComputedStyle(el,'::before').filter==='none'&&getComputedStyle(document.querySelector('.scene'),'::before').backgroundImage==='none';
    }),'A single sharp cover background fills the entire viewport without scene edges');
    if (width === 390) {
      const canvas = page.locator('canvas'), bounds = await canvas.boundingBox();
      assert.equal(await page.getByTestId('score').textContent(), '0', 'Start is empty');
      assert.ok(await page.locator('.utility-button').evaluateAll(els=>els.every(el=>el.textContent.trim()==='')),'Help and gift buttons have no visual labels');
      assert.ok(await page.locator('.shop-launch').evaluate(el=>{const art=el.querySelector('.shop-launch-art'),s=getComputedStyle(art);return getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.borderRadius==='50%'&&getComputedStyle(el.querySelector('.shop-launch-label')).color==='rgb(255, 255, 255)'&&el.querySelector('img').src.includes('icon-shop-basket-red.webp');}),'Shop has a translucent circle and a white outlined label');
      assert.equal(await page.locator('.hint').count(),0,'The extra drop hint has been removed');
      assert.equal(await page.locator('.playfield .shop-launch,.playfield .next-fruit').count(),0,'Shop and next preview have a separate toolbar');
      assert.ok(await page.locator('.score-card').evaluate(el=>{
        const number=el.querySelector('strong'),label=el.querySelector('.small-label');
        return Math.abs(number.getBoundingClientRect().left-label.getBoundingClientRect().left)<1&&parseFloat(getComputedStyle(number).webkitTextStrokeWidth)===0&&getComputedStyle(el.parentElement).backgroundImage==='none';
      }),'Score uses a real CSS panel and plain, left-aligned text');
      const aimTouch=await page.context().newCDPSession(page),aimY=bounds.y+60;
      await aimTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.x+bounds.width*.3,y:aimY}]});
      for(let step=1;step<=6;step++){
        await aimTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:bounds.x+bounds.width*(.3+step*.075),y:aimY}]});
        await page.waitForTimeout(20);
      }
      await page.waitForFunction(()=>window.__jellyPreviewAngle>.03);
      await aimTouch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
      await page.waitForFunction(()=>Math.abs(window.__jellyPreviewAngle)<.01);
      await aimTouch.detach();
      await page.screenshot({path:'test-results/empty-start.png'});
      await page.touchscreen.tap(bounds.x + bounds.width * 77 / 420, bounds.y + bounds.height * 0.22);
      await page.waitForTimeout(1000);
      assert.equal(await page.getByTestId('score').textContent(), '0', 'One fruit cannot merge');
      await page.touchscreen.tap(bounds.x + bounds.width * 77 / 420, bounds.y + bounds.height * 0.22);
      await page.waitForFunction(() => Number(document.querySelector('[data-testid="score"]').textContent.replace(/\D/g, '')) >= 4);
      assert.equal(await page.getByTestId('coins').textContent(),'1','A merge rewards coins');
      assert.equal(await page.locator('.chain-fruit[data-level="1"]').getAttribute('data-discovered'),'true');
      const shakeButton=page.getByRole('button',{name:/Встряхнуть/});
      await shakeButton.click();
      assert.match(await shakeButton.textContent(), /2/);
      await page.getByRole('button', {name:'Настройки', exact:true}).click();
      assert.ok(await page.getByRole('dialog').evaluate(el=>el.getAnimations().some(a=>a.playState==='running')),'Dialog animates into view');
      await page.waitForTimeout(100);
      const paused = await canvas.evaluate(c => c.toDataURL());
      await page.waitForTimeout(500);
      assert.equal(await canvas.evaluate(c => c.toDataURL()), paused, 'Pause freezes the world');
      await page.getByRole('button', {name:'Вернуться в игру',exact:true}).click();
      await page.locator('.overlay.is-leaving').waitFor();
      assert.equal(await page.getByRole('dialog').getAttribute('aria-label'),'Настройки','Exit retains the previous dialog');
      await page.locator('.overlay').waitFor({state:'detached'});
      await page.getByRole('button', {name:'Как играть',exact:true}).click();
      await page.getByRole('button', {name:'Понятно, играем!'}).click();
      assert.equal(await page.locator('.chain-fruit').count(),11);
      assert.equal(await page.locator('.chain-fruit b').count(),0,'No numeric fruit labels');
      assert.equal(await page.locator('.chain-fruit.locked img').first().evaluate(el=>getComputedStyle(el).filter),'brightness(0)','Undiscovered fruit are black silhouettes');
      await page.getByRole('button',{name:'Следующие фрукты'}).click();
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft>=179);
      await page.getByRole('button',{name:'Предыдущие фрукты'}).click();
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft<2);
      const strip=await page.locator('.fruit-scroller').boundingBox();
      const cdp=await page.context().newCDPSession(page);
      const swipeX=strip.x+strip.width-20,swipeY=strip.y+strip.height/2;
      const pull=async(dx)=>{
        const x=strip.x+strip.width/2;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:swipeY}]});
        for(let step=1;step<=6;step++){
          await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/6,y:swipeY}]});
          await page.waitForTimeout(20);
        }
      };
      const translate=()=>page.locator('.fruit-chain').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
      assert.ok(await page.locator('.fruit-scroller').evaluate(el=>getComputedStyle(el).maskImage!=='none'),'Carousel edges fade');
      assert.equal(await page.locator('.chain-arrow img.ui-icon').count(),10,'Fruit progression uses generated raster arrows');
      await pull(100);
      const leftStretch=await translate();assert.ok(leftStretch>15&&leftStretch<100,'Left edge stretches with resistance');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.fruit-chain')).transform).m41)<.1&&document.querySelector('.fruit-scroller').scrollLeft<1);
      await page.locator('.fruit-scroller').focus();await page.keyboard.press('End');
      await page.waitForFunction(()=>document.querySelector('.carousel-arrow.next').disabled);
      await pull(-100);
      assert.ok(await translate() < -15,'Right edge also stretches');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.fruit-chain')).transform).m41)<.1&&document.querySelector('.carousel-arrow.next').disabled);
      await page.locator('.fruit-scroller').focus();await page.keyboard.press('Home');
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft<1);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:swipeX,y:swipeY}]});
      for(let dx=20;dx<=140;dx+=20) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:swipeX-dx,y:swipeY}]});
        await page.waitForTimeout(20);
      }
      const releasedAt=await page.locator('.fruit-scroller').evaluate(el=>el.scrollLeft);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(x=>document.querySelector('.fruit-scroller').scrollLeft>x+10,releasedAt);
      await page.locator('.fruit-scroller').focus();await page.keyboard.press('Home');
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft<1);
      await cdp.detach();
      await page.mouse.move(strip.x+strip.width/2,swipeY);
      await page.mouse.wheel(0,120);
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft>30);
      await page.locator('.fruit-scroller').focus();await page.keyboard.press('Home');
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft<1);
      await page.mouse.move(swipeX,swipeY);await page.mouse.down();
      await page.mouse.move(swipeX-110,swipeY,{steps:6});await page.mouse.up();
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft>90);
      await page.locator('.fruit-scroller').focus();await page.keyboard.press('Home');
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft<1);
      await page.screenshot({path:'test-results/collection.png'});
      await page.getByRole('button',{name:'Баланс монет'}).click();
      assert.match(await page.getByRole('dialog').textContent(),/125 монет/);
      await page.getByRole('button',{name:'За сочным урожаем!'}).click();
      await page.locator('.overlay').waitFor({state:'detached'});
      assert.ok(await page.locator('.scene').evaluate((el,original)=>{
        const r=el.getBoundingClientRect(),shell=document.querySelector('.game-screen');
        return Math.abs(r.x-original.x)<1&&Math.abs(r.y-original.y)<1&&shell.scrollLeft===0&&shell.scrollTop===0;
      },metrics),'Focus, edge gestures and dialogs never shift the game screen');
      await page.screenshot({path:'test-results/mobile.png'});
      const record = await page.locator('.best-card strong').textContent();
      const coins=await page.getByTestId('coins').textContent();
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>!document.querySelector('.loading'));
      assert.equal(await page.locator('.best-card strong').textContent(), record, 'Record survives a reload');
      assert.equal(await page.getByTestId('coins').textContent(),coins,'Wallet survives a reload');
      assert.equal(await page.locator('.chain-fruit[data-discovered="true"]').count(),1,'A fresh round resets discovered fruit');
      await page.getByRole('button', {name:'Настройки',exact:true}).click();
      await page.getByRole('button', {name:'Начать заново',exact:true}).click();
      await page.getByRole('dialog').getByRole('button', {name:'Начать заново',exact:true}).click();
      await page.locator('.overlay').waitFor({state:'detached'});
      assert.equal(await page.getByTestId('score').textContent(), '0');
      assert.equal(await page.getByTestId('coins').textContent(),coins,'Restart keeps earned coins');
    }
    await page.screenshot({path:`test-results/screen-${width}x${height}.png`});
    await page.close();
    console.log(`✓ ${width}×${height}: no scroll, all controls fit`);
  }
  const paid=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await paid.addInitScript(()=>localStorage.setItem('jelly-coins','125'));
  await paid.goto(base,{waitUntil:'networkidle'});
  await paid.waitForFunction(()=>!document.querySelector('.loading'));
  const shake=paid.getByRole('button',{name:/Встряхнуть/});
  for(let i=0;i<3;i++)await shake.click();
  assert.equal(await paid.getByTestId('coins').textContent(),'125','Free shakes keep coins');
  await shake.click();
  assert.equal(await paid.getByTestId('coins').textContent(),'0','Extra shake costs 125 coins');
  assert.ok(await shake.isDisabled(),'An unaffordable shake is disabled');
  await paid.close();
  await checkShop(browser,base,errors);
  await checkRewardsAndOffers(browser,base,errors);
  await checkUiMotion(browser,base,errors);
  await checkShopBehavior(browser,base,errors);
  await checkGameover(browser,base,errors);
  await checkRefresh(browser,base,errors);
  await checkLocalization(browser,base,errors);
  await checkDesktop(browser,base,errors);
  assert.deepEqual(errors, [], 'No browser errors or missing assets');
  console.log('✓ preview tilt, elastic edges, inertia, fading masks, animated dialogs, touch drop, merges and saved progress');
} finally { await browser.close(); }
