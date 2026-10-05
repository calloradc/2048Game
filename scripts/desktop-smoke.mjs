import assert from 'node:assert/strict';

export async function checkDesktop(browser,base,errors){
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2,locale:'en-US'});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
  await page.addInitScript(()=>{
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    window.__cachedDraws=[];
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
      if(image instanceof HTMLCanvasElement&&this.canvas===document.querySelector('.playfield canvas')){
        const matrix=this.getTransform();
        window.__cachedDraws.push({pixelWidth:image.width,outputWidth:args[2]*matrix.a,x:args[0]*matrix.a,y:args[1]*matrix.d});
        if(window.__cachedDraws.length>20)window.__cachedDraws.shift();
      }
      return draw.call(this,image,...args);
    };
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading-screen').waitFor({state:'detached'});
  assert.equal(await page.locator('canvas').evaluate(el=>getComputedStyle(el).cursor),'pointer');
  const clipping=await page.locator('.fruit-scroller').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.chain-fruit')].every(c=>{const b=c.getBoundingClientRect();return b.top>=r.top-.1&&b.bottom<=r.bottom+.1;});});
  assert.ok(clipping,'The entire character image and label fit vertically inside the desktop strip');
  await page.locator('canvas').dispatchEvent('keydown',{key:'Enter'});await page.waitForFunction(()=>window.__cachedDraws.length>0);
  assert.ok(await page.evaluate(()=>window.__cachedDraws.every(d=>Math.abs(d.pixelWidth-d.outputWidth)<.01&&Math.abs(d.x-Math.round(d.x))<.01&&Math.abs(d.y-Math.round(d.y))<.01)),'Resting cubes use the same pixel resolution and aligned coordinates as the live mesh');
  const metrics=()=>page.evaluate(()=>{const s=document.querySelector('.scene').getBoundingClientRect(),c=document.querySelector('canvas'),e=document.querySelector('.evolution').getBoundingClientRect();return{width:s.width*devicePixelRatio,height:s.height*devicePixelRatio,strip:e.width*devicePixelRatio,pixels:c.width,fits:s.x>=0&&s.y>=0&&s.right<=innerWidth+1&&s.bottom<=innerHeight+1};});
  const original=await metrics();const cdp=await page.context().newCDPSession(page);
  for(const zoom of [.8,1.25,1.5,2]){
    // Desktop page zoom changes CSS viewport and DPR in inverse proportions.
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:Math.round(1440/zoom),height:Math.round(900/zoom),deviceScaleFactor:2*zoom,mobile:false});await page.waitForTimeout(250);
    const current=await metrics();assert.ok(Math.abs(current.width-original.width)<2&&Math.abs(current.height-original.height)<2&&Math.abs(current.strip-original.strip)<2,`Physical UI size stays stable at ${zoom*100}%`);assert.equal(current.pixels,original.pixels,'Zoom keeps canvas pixels sharp');assert.ok(current.fits,'Zoom keeps all UI inside the visible viewport');
    await page.locator('.header-buttons button:last-child').click();await page.waitForTimeout(350);
    const dialog=await page.locator('.dialog').evaluate(el=>{const r=el.getBoundingClientRect();return{w:r.width*devicePixelRatio,h:r.height*devicePixelRatio};});
    assert.ok(Math.abs(dialog.w-740)<2&&Math.abs(dialog.h-1160)<2,'Settings dialog also preserves its physical size');
    await page.locator('.dialog-close').click();await page.locator('.overlay').waitFor({state:'detached'});
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:2,mobile:false});await page.waitForTimeout(200);await cdp.detach();
  await page.screenshot({path:'test-results/desktop-polish.png'});
  const hover=async selector=>{const button=page.locator(selector);await button.hover();await page.waitForTimeout(260);assert.ok(Number(await button.evaluate(el=>getComputedStyle(el).scale))>1,`${selector} has smooth hover feedback`);};
  await hover('.wallet');await hover('.header-buttons button:last-child');await page.locator('.header-buttons button:last-child').click();await page.waitForTimeout(400);await hover('.setting-row:first-child');await hover('.dialog-close');await page.locator('.dialog-close').click();await page.locator('.overlay').waitFor({state:'detached'});
  await page.locator('.shop-launch').click();await page.waitForTimeout(400);
  const inertia=async selector=>{
    const el=page.locator(selector);await el.evaluate(e=>e.scrollTop=250);await page.waitForTimeout(100);
    const b=await el.boundingBox(),x=b.x+8,y=b.y+b.height*.65;
    await page.mouse.move(x,y);await page.mouse.down();
    for(let i=1;i<=5;i++){await page.mouse.move(x,y-i*24);await page.waitForTimeout(16);}
    const released=await el.evaluate(e=>e.scrollTop);await page.mouse.up();await page.waitForTimeout(200);assert.ok(await el.evaluate(e=>e.scrollTop)>released+45,`${selector} has useful release inertia`);
  };
  await inertia('.shop-scroll');await page.locator('.dialog-close').click();await page.locator('.overlay').waitFor({state:'detached'});await page.locator('.utility-button:last-child').click();await page.waitForTimeout(400);await inertia('.rewards-scroll');
  await page.close();console.log('✓ desktop strip fits, pointer cursor, sharp resting cubes, stable physical size at 80–200% zoom, smooth hover feedback and stronger shop/gift inertia');
}
