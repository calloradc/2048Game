import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true, args: ['--no-sandbox'],
});
const base = process.env.GAME_URL || 'http://localhost:5173/';
const gameURL = new URL(base);
if (gameURL.hostname === 'localhost') gameURL.hostname = '127.0.0.1';
const host = createServer((request, response) => {
  const params = new URL(request.url, 'http://localhost').searchParams;
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(`<!doctype html><iframe sandbox="allow-scripts allow-same-origin" style="width:${Number(params.get('width'))}px;height:${Number(params.get('height'))}px;border:0" src="${gameURL.href}"></iframe>`);
});
await new Promise(resolve => host.listen(0, '127.0.0.1', resolve));
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    for (const [width, height] of [[390,844], [850,750], [844,390]]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, locale: 'ru-RU', reducedMotion });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const rotate = CanvasRenderingContext2D.prototype.rotate;
        CanvasRenderingContext2D.prototype.rotate = function(angle) {
          if (this.canvas === document.querySelector('canvas')) window.previewAngle = angle;
          return rotate.call(this, angle);
        };
      });
      await page.goto(`http://127.0.0.1:${host.address().port}/?width=${width}&height=${height}`);
      await page.frameLocator('iframe').locator('canvas').waitFor();
      const frame = page.frames().find(frame => frame.parentFrame());
      await frame.locator('.loading').waitFor({ state: 'detached' });
      const environment = await frame.evaluate(() => ({ width: innerWidth, height: innerHeight, embedded: window !== window.top, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }));
      assert.deepEqual(environment, { width, height, embedded: true, reduced: reducedMotion === 'reduce' });
      const checkAim = async animated => {
        const canvas = frame.locator('canvas'), bounds = await canvas.boundingBox();
        const y = bounds.y + 50;
        await page.mouse.move(bounds.x + bounds.width * .25, y); await page.mouse.down();
        for (let i = 1; i <= 6; i++) { await page.mouse.move(bounds.x + bounds.width * (.25 + i * .08), y); await page.waitForTimeout(16); }
        if (animated) await frame.waitForFunction(() => Math.abs(window.previewAngle) > .03);
        else assert.equal(await frame.evaluate(() => window.previewAngle), 0);
        await canvas.dispatchEvent('pointercancel', { pointerId: 1 }); await page.mouse.up();
      };
      await checkAim(true);
      const openSettings = () => frame.getByRole('button', { name: 'Настройки', exact: true }).click();
      const closeSettings = async animated => {
        await frame.locator('.dialog-close').click();
        if (animated) assert.equal(await frame.locator('.overlay.is-leaving').count(), 1, 'Closing keeps the outgoing window for its animation');
        await frame.locator('.overlay').waitFor({ state: 'detached' });
      };
      await openSettings();
      assert.ok(parseFloat(await frame.locator('.dialog').evaluate(el => getComputedStyle(el).animationDuration)) > .1, 'Window entrance animates even when the host requests reduced motion');
      assert.equal(await frame.getByRole('switch', { name: 'Анимации', exact: true }).getAttribute('aria-checked'), 'true');
      await closeSettings(true);
      await frame.getByRole('button', { name: 'Магазин', exact: true }).click();
      assert.ok(await frame.locator('.rail-card-visual').evaluateAll(els => els.some(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m12) > .01)), 'Shop cards retain their rotations in the iframe');
      await frame.locator('.dialog-close').click(); await frame.locator('.overlay').waitFor({ state: 'detached' });
      await openSettings();
      await frame.getByRole('switch', { name: 'Анимации', exact: true }).click();
      assert.equal(await frame.getByRole('switch', { name: 'Анимации', exact: true }).getAttribute('aria-checked'), 'false');
      assert.ok(parseFloat(await frame.locator('.dialog').evaluate(el => getComputedStyle(el).animationDuration)) < .01);
      await closeSettings(false); await checkAim(false);
      await Promise.all([frame.waitForNavigation(), frame.evaluate(() => location.reload())]);
      await frame.locator('canvas').waitFor(); await frame.locator('.loading').waitFor({ state: 'detached' });
      await openSettings();
      assert.equal(await frame.getByRole('switch', { name: 'Анимации', exact: true }).getAttribute('aria-checked'), 'false', 'The explicit player choice survives reload');
      await frame.getByRole('switch', { name: 'Анимации', exact: true }).click();
      await closeSettings(true); await checkAim(true);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`✓ iframe ${width}×${height}, host motion=${reducedMotion}: rotations, window entrance/exit, aim spring and saved animation switch`);
    }
  }
} finally {
  await browser.close();
  host.closeAllConnections();
  await new Promise(resolve => host.close(resolve));
}
