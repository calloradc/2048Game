import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true, args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ locale: 'ru-RU' });
  const errors = [];
  const musicRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('playground.ogg')) musicRequests.push(request.resourceType()); });
  await page.addInitScript(() => {
    localStorage.setItem('jelly-coins', '5000');
    window.audioStarts = [];
    window.musicElements = [];
    const NativeAudio = window.Audio;
    window.Audio = class extends NativeAudio {
      constructor(src) { super(src); window.musicElements.push(this); }
    };
    const scheduledValues = new WeakMap();
    const setValue = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function(value, time) {
      scheduledValues.set(this, value);
      return setValue.call(this, value, time);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(time, ...args) {
      window.audioStarts.push({ time, pitch: scheduledValues.get(this.playbackRate) ?? this.playbackRate.value, duration: this.buffer.duration, loop: this.loop });
      return start.call(this, time, ...args);
    };
  });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.locator('.loading').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.waitForFunction(() => window.audioStarts.filter(source => !source.loop).length === 2);
  const button = await page.evaluate(() => window.audioStarts);
  await page.waitForFunction(() => window.musicElements.some(music => !music.paused && music.currentTime > 0));
  assert.equal(await page.evaluate(() => window.musicElements.filter(music => music.getAttribute('src')).length), 1, 'Music uses one streaming audio element after StrictMode cleanup');
  assert.ok(await page.evaluate(() => { const music = window.musicElements.find(music => music.getAttribute('src')); return music.loop && !music.controls && !music.isConnected; }), 'Music loops without a visible player');
  assert.ok(musicRequests.length && musicRequests.every(type => type === 'media'), 'Music streams through media requests instead of fetching a full decoded buffer');
  assert.equal(button[0].time, button[1].time, 'Both button layers start together');
  button.map(source => source.duration).sort((a,b) => a-b).forEach((duration,i) => assert.ok(Math.abs(duration - [0.144, 0.230][i]) < 0.02));
  await page.getByRole('button', { name: 'Вернуться в игру', exact: true }).click();
  await page.locator('.overlay').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Магазин', exact: true }).click();
  const skins = page.locator('[data-category=skins]');
  await skins.getByRole('button', { name: 'Следующий товар' }).click();
  await skins.getByRole('button', { name: /Купить за/ }).waitFor();
  await page.evaluate(() => { window.audioStarts = []; });
  await skins.getByRole('button', { name: /Купить за/ }).click();
  await page.waitForFunction(() => window.audioStarts.some(source => Math.abs(source.duration - 0.8485) < 0.02));
  assert.equal(await page.evaluate(() => window.audioStarts.filter(source => Math.abs(source.duration - 0.8485) < 0.02).length), 1, 'A successful purchase plays Sell once');
  const sellCount = () => page.evaluate(() => window.audioStarts.filter(source => Math.abs(source.duration - 0.8485) < 0.02).length);
  const watch = async button => {
    await page.evaluate(() => { window.audioStarts = []; });
    await button.click();
    await page.locator('.ad-overlay').waitFor({ state: 'visible' });
    await page.locator('.ad-overlay').waitFor({ state: 'detached' });
  };
  await watch(page.locator('.shop-quick-coins'));
  assert.equal(await sellCount(), 1, 'Advertising coins play Sell once');
  await watch(page.locator('.supply-card.coins .supply-video'));
  assert.equal(await sellCount(), 0, 'The first coin-pack video gives no coins and no Sell');
  await watch(page.locator('.supply-card.coins .supply-video'));
  assert.equal(await sellCount(), 1, 'The completed coin pack plays Sell once');
  await page.locator('.dialog-close').click();
  await page.locator('.overlay').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    window.audioStarts = []; window.oscillatorStarts = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function(...args) { window.oscillatorStarts++; return start.apply(this, args); };
  });
  await page.locator('canvas').click({ position: { x: 100, y: 100 } });
  await page.locator('canvas').press('Enter');
  assert.equal(await page.evaluate(() => window.oscillatorStarts), 0, 'Pointer and keyboard drops have no synthesized sound');

  const result = await page.evaluate(async () => {
    const { GameAudio } = await import('/src/game/audio.ts');
    const audio = new GameAudio();
    const buffers = await Promise.all(audio.samples.values());
    const durations = buffers.map(buffer => buffer?.duration);
    audio.unlock();
    await new Promise(resolve => setTimeout(resolve, 100));
    window.audioStarts = [];
    const originalNow = performance.now.bind(performance);
    let now = 0;
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
    const groups = [];
    for (const time of [0, 700, 1400, 2900]) {
      now = time; audio.play('merge');
      await new Promise(resolve => setTimeout(resolve, 20));
      groups.push(window.audioStarts.splice(0));
    }
    now = 4900;
    for (const offset of [0, 0, 10, 30, 79]) { now = 4900 + offset; audio.play('merge'); }
    await new Promise(resolve => setTimeout(resolve, 20));
    const burst = window.audioStarts.splice(0);
    now = 4980; audio.play('merge');
    await new Promise(resolve => setTimeout(resolve, 30));
    const nextMerge = window.audioStarts.splice(0);
    const liveMergeSources = audio.activeSources.size;
    audio.muted = true;
    audio.play('merge'); audio.play('button'); audio.play('purchase');
    await new Promise(resolve => setTimeout(resolve, 20));
    const mutedGain = audio.master.gain.value;
    const mutedStarts = window.audioStarts.length;
    const mutedMusic = audio.music.paused;
    audio.muted = false;
    await new Promise(resolve => setTimeout(resolve, 20));
    const restoredGain = audio.master.gain.value;
    audio.play('merge');
    await new Promise(resolve => setTimeout(resolve, 20));
    window.dispatchEvent(new Event('blur'));
    audio.play('button');
    await new Promise(resolve => setTimeout(resolve, 20));
    const blurred = { state: audio.context.state, paused: audio.music.paused, sources: audio.activeSources.size };
    window.dispatchEvent(new Event('focus'));
    await new Promise(resolve => setTimeout(resolve, 40));
    const focused = { state: audio.context.state, paused: audio.music.paused, sources: audio.activeSources.size };
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 20));
    const hidden = { state: audio.context.state, paused: audio.music.paused };
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(resolve => setTimeout(resolve, 40));
    audio.destroy();
    await new Promise(resolve => setTimeout(resolve, 20));
    Object.defineProperty(performance, 'now', { configurable: true, value: originalNow });
    return { durations, groups, burst, nextMerge, liveMergeSources, mutedGain, mutedStarts, mutedMusic, restoredGain, blurred, focused, hidden, state: audio.context.state };
  });
  assert.equal(result.durations.length, 6);
  assert.ok(result.durations.every(duration => duration > 0), 'All six OGG effects decode in the browser');
  assert.deepEqual(result.groups.map(group => group.length), [4, 4, 4, 4]);
  for (const group of result.groups) {
    assert.equal(new Set(group.map(source => source.time)).size, 1, 'All merge layers start simultaneously');
    assert.equal(new Set(group.map(source => source.pitch)).size, 1, 'All merge layers share their pitch');
    group.map(source => source.duration).sort((a,b) => a-b).forEach((duration,i) => assert.ok(Math.abs(duration - [0.230, 0.559, 0.712, 0.772][i]) < 0.02));
  }
  result.groups.forEach((group, i) => assert.ok(Math.abs(group[0].pitch - [1, 1.06, 1.12, 1][i]) < 0.00001, 'Pitch rises within the rolling 1.5-second window and resets at 1.5 seconds'));
  assert.equal(result.burst.length, 4, 'Simultaneous and nearby merges play just one four-layer cue');
  assert.equal(result.nextMerge.length, 4, 'The next distinct merge still plays');
  assert.ok(Math.abs(result.nextMerge[0].pitch - 1.06) < 0.00001, 'Suppressed duplicates do not raise the pitch');
  assert.ok(result.liveMergeSources <= 4, 'New merge audio replaces the previous cue instead of overlapping');
  assert.equal(result.mutedGain, 0); assert.equal(result.mutedStarts, 0); assert.equal(result.restoredGain, 1);
  assert.equal(result.mutedMusic, true);
  assert.deepEqual(result.blurred, { state: 'suspended', paused: true, sources: 0 });
  assert.deepEqual(result.focused, { state: 'running', paused: false, sources: 0 });
  assert.deepEqual(result.hidden, { state: 'suspended', paused: true });
  assert.equal(result.state, 'closed', 'Destroy releases audio resources');
  assert.deepEqual(errors, []);
  console.log('✓ OGG decoding, streaming music without a player, button layers, purchase, merge pitch, mute, focus/visibility pause and cleanup');
} finally { await browser.close(); }
