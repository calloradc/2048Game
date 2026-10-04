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
    assert.ok(metrics.x >= -1 && metrics.y >= -1 && metrics.bottom <= height + 1 && metrics.right <= width + 1, `Scene fits ${width}×${height}`);
    if (width === 390) {
      const canvas = page.locator('canvas'), bounds = await canvas.boundingBox();
      await page.touchscreen.tap(bounds.x + bounds.width * 77 / 420, bounds.y + bounds.height * 0.13);
      await page.waitForFunction(() => Number(document.querySelector('[data-testid="score"]').textContent.replace(/\D/g, '')) >= 4);
      await page.getByRole('button', {name:'Встряхнуть'}).click();
      assert.match(await page.getByRole('button', {name:'Встряхнуть'}).textContent(), /2/);
      await page.getByRole('button', {name:'Пауза', exact:true}).click();
      await page.waitForTimeout(100);
      const paused = await canvas.evaluate(c => c.toDataURL());
      await page.waitForTimeout(500);
      assert.equal(await canvas.evaluate(c => c.toDataURL()), paused, 'Pause freezes the world');
      await page.getByRole('button', {name:'Продолжить',exact:true}).click();
      await page.getByRole('button', {name:'Как играть',exact:true}).click();
      await page.getByRole('button', {name:'Понятно, играем!'}).click();
      await page.getByRole('button', {name:'Посмотреть все 11 фруктов'}).click();
      assert.equal(await page.locator('.collection-grid > div').count(), 11);
      await page.screenshot({path:'test-results/collection.png'});
      await page.getByRole('button', {name:'За арбузом!'}).click();
      await page.screenshot({path:'test-results/mobile.png'});
      const record = await page.locator('.best-card strong').textContent();
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('.best-card strong').textContent(), record, 'Record survives a reload');
      await page.getByRole('button', {name:'Начать заново'}).click();
      await page.getByRole('dialog').getByRole('button', {name:'Начать заново',exact:true}).click();
      assert.equal(await page.getByTestId('score').textContent(), '0');
    }
    await page.screenshot({path:`test-results/screen-${width}x${height}.png`});
    await page.close();
    console.log(`✓ ${width}×${height}: no scroll, all controls fit`);
  }
  assert.deepEqual(errors, [], 'No browser errors or missing assets');
  console.log('✓ touch drop, merge, shake, pause, dialogs, restart and saved record');
} finally { await browser.close(); }
