import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true, args: ['--no-sandbox'],
});
const base = process.env.GAME_URL || 'http://localhost:5173/';
const errors = [];
await mkdir('test-results', { recursive: true });
try {
  const loading = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let releaseAsset;
  const assetGate=new Promise(resolve=>{releaseAsset=resolve;});
  await loading.route('**/wood-sign.webp',async route=>{await assetGate;await route.continue();});
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
    await page.addInitScript(() => { Math.random = () => 0.01; });
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
      return Math.abs(field.y-canvas.y)<1 && Math.abs(field.height-canvas.height)<1 && document.fonts.check('900 14px Nunito');
    }), 'Canvas stays inside its field; Nunito loaded');
    assert.ok(metrics.x >= -1 && metrics.y >= -1 && metrics.bottom <= height + 1 && metrics.right <= width + 1, `Scene fits ${width}×${height}`);
    if (width === 390) {
      const canvas = page.locator('canvas'), bounds = await canvas.boundingBox();
      assert.equal(await page.getByTestId('score').textContent(), '0', 'Start is empty');
      await page.screenshot({path:'test-results/empty-start.png'});
      await page.touchscreen.tap(bounds.x + bounds.width * 77 / 420, bounds.y + bounds.height * 0.13);
      await page.waitForTimeout(1000);
      assert.equal(await page.getByTestId('score').textContent(), '0', 'One fruit cannot merge');
      await page.touchscreen.tap(bounds.x + bounds.width * 77 / 420, bounds.y + bounds.height * 0.13);
      await page.waitForFunction(() => Number(document.querySelector('[data-testid="score"]').textContent.replace(/\D/g, '')) >= 4);
      assert.equal(await page.getByTestId('coins').textContent(),'1','A merge rewards coins');
      assert.equal(await page.locator('.chain-fruit[data-level="1"]').getAttribute('data-discovered'),'true');
      const shakeButton=page.getByRole('button',{name:/Встряхнуть/});
      await shakeButton.click();
      assert.match(await shakeButton.textContent(), /2/);
      await page.getByRole('button', {name:'Пауза', exact:true}).click();
      await page.waitForTimeout(100);
      const paused = await canvas.evaluate(c => c.toDataURL());
      await page.waitForTimeout(500);
      assert.equal(await canvas.evaluate(c => c.toDataURL()), paused, 'Pause freezes the world');
      await page.getByRole('button', {name:'Продолжить',exact:true}).click();
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
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:swipeX,y:swipeY}]});
      for(let dx=20;dx<=140;dx+=20) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:swipeX-dx,y:swipeY}]});
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>document.querySelector('.fruit-scroller').scrollLeft>60);
      await page.waitForTimeout(400);
      await page.locator('.fruit-scroller').evaluate(el=>el.scrollTo({left:0,behavior:'instant'}));
      await cdp.detach();
      await page.screenshot({path:'test-results/collection.png'});
      await page.getByRole('button',{name:'Баланс монет'}).click();
      assert.match(await page.getByRole('dialog').textContent(),/25 монет/);
      await page.getByRole('button',{name:'За сочным урожаем!'}).click();
      await page.screenshot({path:'test-results/mobile.png'});
      const record = await page.locator('.best-card strong').textContent();
      const coins=await page.getByTestId('coins').textContent();
      const discoveries=await page.locator('.chain-fruit[data-discovered="true"]').count();
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>!document.querySelector('.loading'));
      assert.equal(await page.locator('.best-card strong').textContent(), record, 'Record survives a reload');
      assert.equal(await page.getByTestId('coins').textContent(),coins,'Wallet survives a reload');
      assert.equal(await page.locator('.chain-fruit[data-discovered="true"]').count(),discoveries,'Discoveries survive a reload');
      await page.getByRole('button', {name:'Начать заново'}).click();
      await page.getByRole('dialog').getByRole('button', {name:'Начать заново',exact:true}).click();
      assert.equal(await page.getByTestId('score').textContent(), '0');
      assert.equal(await page.getByTestId('coins').textContent(),coins,'Restart keeps earned coins');
    }
    await page.screenshot({path:`test-results/screen-${width}x${height}.png`});
    await page.close();
    console.log(`✓ ${width}×${height}: no scroll, all controls fit`);
  }
  const paid=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await paid.addInitScript(()=>localStorage.setItem('jelly-coins','25'));
  await paid.goto(base,{waitUntil:'networkidle'});
  await paid.waitForFunction(()=>!document.querySelector('.loading'));
  const shake=paid.getByRole('button',{name:/Встряхнуть/});
  for(let i=0;i<3;i++)await shake.click();
  assert.equal(await paid.getByTestId('coins').textContent(),'25','Free shakes keep coins');
  await shake.click();
  assert.equal(await paid.getByTestId('coins').textContent(),'0','Extra shake costs 25 coins');
  assert.ok(await shake.isDisabled(),'An unaffordable shake is disabled');
  await paid.close();
  assert.deepEqual(errors, [], 'No browser errors or missing assets');
  console.log('✓ touch drop, merge, carousel, coin rewards, paid shakes, pause, dialogs and saved progress');
} finally { await browser.close(); }
