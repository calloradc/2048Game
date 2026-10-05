import assert from 'node:assert/strict';

export async function checkUiMotion(browser,base,errors){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()}: ${response.url()}`);});
  await page.addInitScript(()=>localStorage.setItem('jelly-coins','5000'));
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading-screen').waitFor({state:'detached'});
  const open=()=>page.getByRole('button',{name:'Магазин',exact:true}).click();
  const close=async()=>{await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('.overlay').waitFor({state:'detached'});};
  const nav=page.getByRole('navigation',{name:'Разделы магазина'});
  const jump=async(label,id)=>{
    await nav.getByRole('button',{name:label,exact:true}).click();
    await page.waitForFunction(id=>{
      const el=document.querySelector('.shop-scroll'),target=el.querySelector(`[data-shop-section="${id}"]`);
      return Math.abs(el.scrollTop-Math.min(el.scrollHeight-el.clientHeight,Math.max(0,target.offsetTop-8)))<2;
    },id);
  };
  await page.screenshot({path:'test-results/shop-button-circle.png',animations:'disabled'});
  await open();await page.waitForTimeout(700);
  await page.screenshot({path:'test-results/shop-opening.png',animations:'disabled'});
  const pillStart=await page.locator('.shop-nav-pill').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
  const selection=await page.evaluate(()=>new Promise(resolve=>{
    const nav=document.querySelector('.shop-nav'),ids=[],positions=[],start=performance.now();
    [...nav.querySelectorAll('button')].find(button=>button.textContent==='Наборы').click();
    const sample=now=>{
      ids.push(nav.querySelector('[aria-current=true]').textContent);
      positions.push(new DOMMatrix(getComputedStyle(nav.querySelector('.shop-nav-pill')).transform).m41);
      if(now-start<700)requestAnimationFrame(sample);else resolve({ids,positions});
    };requestAnimationFrame(sample);
  }));
  assert.ok(selection.ids.every(id=>id==='Наборы'),'Clicked section stays highlighted throughout anchor scrolling');
  assert.ok(selection.positions.some(x=>x>pillStart+2&&x<selection.positions.at(-1)-2),'The highlight travels between tabs');
  const bundle=page.locator('.bundle-card.cozy');
  for(const [name,category] of [['Сакура на закате','backgrounds'],['Розовый кварц','boxes'],['Шушистики','skins']]){
    await jump('Наборы','bundles');
    await bundle.getByRole('button',{name:`Посмотреть ${name}`,exact:true}).click();
    await page.waitForFunction(({name,category})=>{
      const section=document.querySelector(`[data-category="${category}"]`),rail=section.querySelector('.snap-viewport'),card=section.querySelector('.rail-card[data-centred=true]');
      if(!card||section.querySelector('.shop-current').textContent!==name)return false;
      const a=card.getBoundingClientRect(),b=rail.getBoundingClientRect();
      return Math.abs(a.left+a.width/2-b.left-b.width/2)<1;
    },{name,category});
  }
  await page.locator('.shop-scroll').evaluate(el=>{el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));el.scrollTop=el.querySelector('[data-category=backgrounds]').offsetTop-el.clientHeight*.4;});
  await page.waitForFunction(()=>document.querySelector('.shop-nav [aria-current=true]').textContent==='Фоны');
  await jump('Персонажи','skins');
  const rail=page.locator('[data-category=skins] .snap-viewport');
  await rail.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForTimeout(500);
  const arrows=await page.locator('[data-category=skins] .shop-arrow .ui-icon').evaluateAll(els=>els.map(el=>({src:el.src,mirror:new DOMMatrix(getComputedStyle(el).transform).m11})));
  assert.equal(arrows[0].src,arrows[1].src);assert.equal(arrows[0].mirror,-1);assert.equal(arrows[1].mirror,1);
  const bounds=await rail.boundingBox(),touch=await page.context().newCDPSession(page);
  const x=bounds.x+bounds.width*.55,y=bounds.y+bounds.height*.55;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(const offset of [-24,-48,-72,-40,-12,-42,-65]){
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+offset,y}]});await page.waitForTimeout(30);
  }
  await page.waitForTimeout(70);const held=await rail.evaluate(el=>el.scrollLeft);
  await page.waitForTimeout(250);
  assert.ok(Math.abs(await rail.evaluate(el=>el.scrollLeft)-held)<1,'Pausing a reversing swipe never starts a competing snap');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  await page.waitForFunction(()=>{
    const rail=document.querySelector('[data-category=skins] .snap-viewport'),card=rail.querySelector('.rail-card[data-centred=true]');
    const a=card.getBoundingClientRect(),b=rail.getBoundingClientRect();return rail.dataset.moving==='false'&&Math.abs(a.left+a.width/2-b.left-b.width/2)<1;
  });
  await jump('Наборы','bundles');await page.waitForTimeout(450);
  assert.equal(await bundle.evaluate(el=>el.dataset.entered),'true');
  await jump('Персонажи','skins');await jump('Наборы','bundles');
  assert.equal(await bundle.evaluate(el=>getComputedStyle(el).opacity),'1','Previously revealed cards never fade back out');
  await bundle.getByRole('button',{name:'Купить Уютный набор за 1800'}).click();
  const toast=page.locator('.toast');await toast.waitFor({state:'visible'});
  const toastBounds=await toast.boundingBox();assert.ok(toastBounds.y<64,'Notifications appear at the top');
  await page.mouse.move(toastBounds.x+toastBounds.width*.4,toastBounds.y+toastBounds.height*.7);
  await page.mouse.down();await page.mouse.move(toastBounds.x+toastBounds.width*.4,toastBounds.y-55,{steps:6});await page.mouse.up();
  await toast.waitFor({state:'detached'});
  await jump('Монеты','supplies');
  await page.getByRole('button',{name:'Купить 1 встрясок за 125'}).click();
  await toast.waitFor({state:'visible'});const nextToast=await toast.boundingBox();
  await page.mouse.move(nextToast.x+nextToast.width*.35,nextToast.y+nextToast.height*.5);await page.mouse.down();
  await page.mouse.move(nextToast.x+nextToast.width*.35+110,nextToast.y+nextToast.height*.5,{steps:6});await page.mouse.up();await toast.waitFor({state:'detached'});
  await page.screenshot({path:'test-results/shop-motion.png',animations:'disabled'});
  await close();await page.getByRole('button',{name:'Подарки',exact:true}).click();
  await page.locator('[data-day="6"]').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.daily-background-preview .item-image').evaluate(el=>getComputedStyle(el).objectFit),'cover');
  await page.screenshot({path:'test-results/rewards-photo-preview.png',animations:'disabled'});
  await page.getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.locator('.rewards-fullscreen.is-leaving').waitFor({state:'attached'});
  assert.equal(await page.locator('.rewards-dialog').evaluate(el=>getComputedStyle(el).animationName),'sheet-out');
  await page.locator('.overlay').waitFor({state:'detached'});
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await page.getByRole('button',{name:'Начать заново',exact:true}).click();
  await page.getByRole('dialog',{name:'Новая игра'}).waitFor();await close();
  await page.close();console.log('✓ continuous tab highlight, exact bundle links, reversing swipes, stable card reveals, mirrored arrows, cropped prize photo, top notification swipes and closing sheets');
}
