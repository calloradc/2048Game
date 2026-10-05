import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const track = await readFile(new URL('../public/assets/audio/playground.ogg', import.meta.url));
const shortLoop = await readFile(new URL('../public/assets/audio/splash-03.ogg', import.meta.url));
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
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({ streamUrl }) => {
    const NativeAudio = window.Audio;
    window.musicElements = [];window.musicStarts = [];
    window.Audio = class extends NativeAudio {
      constructor(...args) { super(...args);window.musicElements.push(this); }
    };
    const fetch = window.fetch.bind(window);
    window.fetch = (url,...args) => fetch(String(url).includes('/audio/playground.ogg')?streamUrl:url,...args);
    const musicSources = new WeakSet();
    const connect = AudioBufferSourceNode.prototype.connect;
    AudioBufferSourceNode.prototype.connect = function(destination,...args) {
      if(destination instanceof GainNode&&Math.abs(destination.gain.value-.2)<1e-6)musicSources.add(this);
      return connect.call(this,destination,...args);
    };
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function(time,offset,...args) {
      if(musicSources.has(this))window.musicStarts.push({source:this,time,offset,stopped:false});
      return start.call(this,time,offset,...args);
    };
    AudioBufferSourceNode.prototype.stop = function(...args) {
      const event=window.musicStarts.find(event=>event.source===this);if(event)event.stopped=true;
      return stop.apply(this,args);
    };
  }, { streamUrl: `http://127.0.0.1:${server.address().port}/music.ogg` });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.locator('.loading').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.waitForFunction(() => window.musicStarts.some(event=>!event.stopped&&event.source.context.state==='running'&&event.source.context.currentTime>event.time+.1), undefined, { timeout: 10000 });
  assert.ok(responses.length > 0 && responses.every(response => !response.writableEnded), 'Music starts while the remaining file is still withheld');
  assert.equal(await page.evaluate(()=>window.musicElements.length),0,'No native audio element is even created');
  assert.equal(await page.locator('audio,video').count(), 0, 'No player is attached to the page');
  assert.equal(await page.evaluate(()=>navigator.mediaSession?.playbackState??'none'),'none','Music does not register playback with the native media session');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>window.musicStarts.every(event=>event.stopped||event.source.context.state==='closed'));
  const paused=await page.evaluate(()=>window.musicStarts.length);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.musicStarts.length),paused,'Background music stays stopped');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(previous=>window.musicStarts.length>previous,paused);
  assert.ok(await page.evaluate(previous=>window.musicStarts.slice(previous).some(event=>event.offset>0),paused),'Resume preserves the position inside a decoded chunk');
  assert.deepEqual(errors,[]);
  console.log('✓ streaming Web Audio starts before the complete OGG download, creates no native media player/session, and pauses/resumes at the same position');
  await page.close();

  const fallback=await browser.newPage({locale:'ru-RU'});
  fallback.on('pageerror',error=>errors.push(error.message));
  await fallback.addInitScript(()=>{
    window.Worker=class { constructor(){throw new DOMException('Workers blocked by the WebView','SecurityError');} };
    window.fallbackMusic=[];window.audioElements=0;
    const Audio=window.Audio;window.Audio=class extends Audio {constructor(...args){super(...args);window.audioElements++;}};
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(time,...args){
      if(this.loop)window.fallbackMusic.push({source:this,time});
      return start.call(this,time,...args);
    };
  });
  await fallback.goto(process.env.GAME_URL || 'http://localhost:5173/',{waitUntil:'networkidle'});
  await fallback.locator('.loading').waitFor({state:'detached'});
  await fallback.getByRole('button',{name:'Настройки',exact:true}).click();
  await fallback.waitForFunction(()=>window.fallbackMusic.some(event=>event.source.context.state==='running'&&event.source.context.currentTime>event.time+.1));
  assert.equal(await fallback.evaluate(()=>window.audioElements),0,'The full-download fallback also creates no native media element');
  assert.deepEqual(errors,[]);await fallback.close();
  console.log('✓ WebViews blocking workers fall back to looping decoded Web Audio, still without a native player');

  const loop=await browser.newPage({locale:'ru-RU'});
  loop.on('pageerror',error=>errors.push(error.message));
  await loop.route('**/audio/playground.ogg',route=>route.fulfill({body:shortLoop,contentType:'audio/ogg'}));
  await loop.addInitScript(()=>{
    window.loopChunks=[];const musicSources=new WeakSet();
    const connect=AudioBufferSourceNode.prototype.connect,start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.connect=function(destination,...args){
      if(destination instanceof GainNode&&Math.abs(destination.gain.value-.2)<1e-6)musicSources.add(this);
      return connect.call(this,destination,...args);
    };
    AudioBufferSourceNode.prototype.start=function(time,...args){
      if(musicSources.has(this))window.loopChunks.push({source:this,time});
      return start.call(this,time,...args);
    };
  });
  await loop.goto(process.env.GAME_URL || 'http://localhost:5173/',{waitUntil:'domcontentloaded'});
  await loop.locator('.loading').waitFor({state:'detached'});
  await loop.getByRole('button',{name:'Настройки',exact:true}).click();
  await loop.waitForFunction(()=>window.loopChunks.filter(event=>event.source.context.state==='running').length>=5);
  const looping=await loop.evaluate(()=>{
    const events=window.loopChunks.filter(event=>event.source.context.state==='running');
    return {streamed:events.every(event=>!event.source.loop),
      gaps:events.slice(1).map((event,index)=>event.time-events[index].time-events[index].source.buffer.duration),
      retainedSeconds:events.reduce((sum,event)=>sum+Math.max(0,event.time+event.source.buffer.duration-Math.max(event.time,event.source.context.currentTime)),0)};
  });
  assert.ok(looping.streamed,'Repeated iterations use streamed chunks');
  assert.ok(looping.gaps.every(gap=>Math.abs(gap)<.001),'Music loops without a gap at the file boundary');
  assert.ok(looping.retainedSeconds<=8.8,'Music buffers only a few seconds ahead');
  assert.deepEqual(errors,[]);await loop.close();
  console.log('✓ streamed music loops seamlessly and retains a bounded queue of decoded audio');
} finally {
  for (const response of responses) response.end(track.subarray(262144));
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
