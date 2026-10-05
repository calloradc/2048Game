import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const track = await readFile(new URL('../public/assets/audio/playground.ogg', import.meta.url));
const responses = [];
const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'audio/ogg', 'Access-Control-Allow-Origin': '*' });
  response.write(track.subarray(0, 262144));
  // Deliberately withhold the rest until the browser starts playing.
  responses.push(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true, args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ locale: 'ru-RU' });
  await page.addInitScript(({ streamUrl }) => {
    const NativeAudio = window.Audio;
    window.musicElements = [];
    window.Audio = class extends NativeAudio {
      constructor() {
        super(); this.crossOrigin = 'anonymous'; this.src = streamUrl;
        window.musicElements.push(this);
      }
    };
  }, { streamUrl: `http://127.0.0.1:${server.address().port}/music.ogg` });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.locator('.loading').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.waitForFunction(() => window.musicElements.some(music => !music.paused && music.currentTime > 0.1), undefined, { timeout: 10000 });
  assert.ok(responses.length > 0 && responses.every(response => !response.writableEnded), 'Music starts while the remaining file is still withheld');
  assert.equal(await page.locator('audio,video').count(), 0, 'No player is attached to the page');
  console.log('✓ background music starts before the full OGG file arrives, with no visible player');
} finally {
  for (const response of responses) response.end(track.subarray(262144));
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
