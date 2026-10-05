import assert from 'node:assert/strict';

export async function checkRefresh(browser,base,errors){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
  await page.addInitScript(()=>{if(!localStorage.getItem('refresh-seeded')){localStorage.setItem('refresh-seeded','true');localStorage.setItem('jelly-coins','10000');localStorage.setItem('jelly-profile',JSON.stringify({daily:'2020-01-01',dailyCount:17}));}});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  const close=async()=>{await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('.overlay').waitFor({state:'detached'});};
  const closeContents=async()=>{await page.getByRole('button',{name:'Закрыть содержимое'}).click();await page.locator('.contents-overlay').waitFor({state:'detached'});};
  const jump=async label=>{await page.getByRole('navigation',{name:'Разделы магазина'}).getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(650);};
  await page.getByRole('button',{name:'Магазин',exact:true}).click();await page.waitForTimeout(400);
  assert.equal(await page.getByRole('button',{name:/Посмотреть содержимое/}).count(),0);
  for(const [category,label,name] of [['skins','Персонажи','Конфетти'],['backgrounds','Фоны','Лазурная лагуна'],['boxes','Боксы','Бамбуковый дзен']]){
    await jump(label);const section=page.locator(`[data-category=${category}]`);
    await section.getByRole('button',{name:`Показать ${name}`,exact:true}).click();await page.waitForTimeout(700);
    await section.locator('.rail-card[data-centred=true]').click();await page.getByRole('dialog',{name:`Содержимое: ${name}`}).waitFor();
    if(category==='skins')assert.equal(await page.locator('.contents-grid figure').count(),11);
    else assert.ok((await page.locator('.contents-preview img').boundingBox()).height>140,'Item details have a full-size preview');
    await closeContents();
  }
  await jump('Персонажи');const skin=page.locator('[data-category=skins]');
  await skin.getByRole('button',{name:'Показать Фруктовая семья',exact:true}).click();await page.waitForTimeout(700);
  const touch=await page.context().newCDPSession(page),rail=await skin.locator('.snap-viewport').boundingBox();
  const send=(type,x,y)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await send('touchStart',rail.x+rail.width*.86,rail.y+100);
  for(let i=1;i<=8;i++){await send('touchMove',rail.x+rail.width*.86-i*36,rail.y+100);await page.waitForTimeout(20);}
  await send('touchEnd');await page.waitForTimeout(700);
  assert.equal(await skin.locator('.shop-current').textContent(),'Шушистики','A long swipe advances exactly one card');
  assert.equal(await page.locator('.contents-overlay').count(),0,'Swiping does not trigger the card tap');
  const edge=async(selector,bottom)=>{
    const scroll=page.locator(selector);
    await scroll.evaluate((el,bottom)=>el.scrollTop=bottom?el.scrollHeight:0,bottom);await page.waitForTimeout(80);
    const bounds=await scroll.boundingBox(),x=bounds.x+5,y=bounds.y+Math.min(180,bounds.height*.5),direction=bottom?-1:1;
    await send('touchStart',x,y);
    for(let i=1;i<=6;i++){await send('touchMove',x,y+direction*i*20);await page.waitForTimeout(20);}
    const excess=await scroll.evaluate(el=>new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m42);
    assert.ok(direction*excess>1&&Math.abs(excess)<12,'Elastic displacement stays small at either boundary');
    await send('touchMove',x,y+direction*60);await page.waitForTimeout(40);
    assert.ok(await scroll.evaluate((el,bottom)=>bottom?el.scrollTop<el.scrollHeight-el.clientHeight-2:el.scrollTop>2,bottom),'Reversing an edge pull immediately scrolls back into content');
    await send('touchEnd');await page.waitForTimeout(700);
    assert.ok(await scroll.evaluate(el=>Math.abs(new DOMMatrix(getComputedStyle(el.firstElementChild).transform).m42)<.2),'Edge spring settles without lingering stretch');
  };
  await edge('.shop-scroll',false);await edge('.shop-scroll',true);
  await jump('Персонажи');await skin.getByRole('button',{name:'Показать Космические сладости',exact:true}).click();await page.waitForTimeout(700);
  assert.equal(await skin.getByRole('button',{name:/Купить за|Открыть за видео/}).count(),0,'Bundle exclusives have no direct purchase');
  await skin.getByRole('button',{name:/Только в космическом наборе/}).click();await page.getByRole('dialog',{name:'Содержимое: Космический набор'}).waitFor();
  assert.equal(await page.locator('.contents-item').count(),3);await closeContents();
  await page.getByRole('button',{name:'Купить Космический набор за 5720'}).click();await close();
  await page.getByRole('button',{name:'Подарки',exact:true}).click();await page.getByRole('button',{name:'Забрать ежедневный подарок'}).click();
  assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')).owned.includes('boxes:cloud')));
  await edge('.rewards-scroll',false);await edge('.rewards-scroll',true);await close();await touch.detach();
  await page.reload({waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')).selected),{skins:'cosmos',backgrounds:'cosmos',boxes:'cosmos'});
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);
  assert.ok(await page.locator('.ambient-background').evaluate(el=>getComputedStyle(el,'::before').backgroundImage.includes('cosmos-wide.webp')),'Rotation selects separately expanded art');
  assert.ok((await page.locator('canvas').boundingBox()).height>300,'Landscape keeps the game container comfortably sized');
  await page.screenshot({path:'test-results/cosmic-landscape.png'});
  await page.close();console.log('✓ card tap previews, one-card swipes, both elastic boundaries in shop and gifts, exclusive bundle purchase, daily cloud box and panoramic rotation');
}
