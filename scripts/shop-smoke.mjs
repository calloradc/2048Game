import assert from 'node:assert/strict';

export async function checkShop(browser,base,errors){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
  await page.addInitScript(()=>{if(!localStorage.getItem('shop-test-seeded')){localStorage.setItem('jelly-coins','400');localStorage.setItem('shop-test-seeded','true');}});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  const coins=async()=>Number((await page.getByTestId('coins').textContent()).replace(/\D/g,''));
  const openShop=()=>page.getByRole('button',{name:'Магазин',exact:true}).click();
  const close=async()=>{await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('.overlay').waitFor({state:'detached'});};
  const next=async(name)=>{await page.getByRole('button',{name:'Следующий товар'}).click();await page.waitForFunction(n=>document.querySelector('.shop-current')?.textContent===n,name);await page.waitForTimeout(350);};
  const watch=async(button)=>{await button.click();await page.getByRole('dialog',{name:'Имитация рекламы'}).waitFor();await page.locator('.ad-overlay').waitFor({state:'detached'});};
  await openShop();await page.waitForTimeout(400);
  assert.equal(await page.locator('.drop-label,.footer-caption').count(),0,'Removed surplus plaques');
  assert.equal(await page.locator('.score-card strong').evaluate(el=>getComputedStyle(el).color),'rgb(255, 253, 243)','White score on wood');
  assert.equal(await page.getByRole('tab').count(),3);
  assert.deepEqual(await page.getByRole('dialog',{name:'Магазин',exact:true}).boundingBox(),{x:0,y:0,width:390,height:844},'Shop fills the actual viewport outside the scaled game');
  assert.ok(await page.locator('.scene').evaluate(el=>el.inert),'Game controls are inert beneath the shop');
  assert.ok(await page.locator('.snap-viewport').evaluate(el=>getComputedStyle(el).scrollSnapType.includes('mandatory')),'Shop snaps natively');
  await next('Шушистики');
  assert.ok(await page.locator('.shop-card').evaluateAll(cards=>{
    const selected=cards.find(c=>c.dataset.centred==='true');return selected&&new DOMMatrixReadOnly(getComputedStyle(selected).transform).a>.96&&cards.some(c=>new DOMMatrixReadOnly(getComputedStyle(c).transform).a<.9);
  }),'Central card is bigger than edge cards');
  await page.screenshot({path:'test-results/shop-skins.png'});
  await page.getByRole('button',{name:'Купить за 180'}).click();assert.equal(await coins(),220);
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await page.getByRole('button',{name:'Уже в игре'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.chain-fruit img').src.includes('/skins/fuzzies/'));
  await page.getByRole('tab',{name:'Фоны',exact:true}).click();await next('Сакура на закате');
  await page.getByRole('button',{name:'Купить за 120'}).click();assert.equal(await coins(),100);
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await page.getByRole('button',{name:'Уже в игре'}).waitFor();
  assert.ok(await page.locator('.ambient-background').evaluate(el=>getComputedStyle(el,'::before').backgroundImage.includes('backgrounds/sunset.webp')));
  await page.screenshot({path:'test-results/shop-backgrounds.png'});
  await page.getByRole('tab',{name:'Боксы',exact:true}).click();await next('Розовый кварц');
  assert.ok(await page.getByRole('button',{name:'Нужно ещё 50'}).isDisabled());
  await page.getByRole('button',{name:'+75 монет за видео',exact:true}).click();
  await page.getByRole('button',{name:'Закрыть без награды'}).click();assert.equal(await coins(),100,'Cancelled video awards nothing');
  assert.equal(await page.locator('.shop-current').textContent(),'Розовый кварц','Video retains carousel position');
  await watch(page.getByRole('button',{name:'+75 монет за видео',exact:true}));
  assert.equal(await coins(),175,'Complete video awards exactly 75');await page.waitForTimeout(400);assert.equal(await coins(),175);
  await page.getByRole('button',{name:'Купить за 150'}).click();assert.equal(await coins(),25);
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await page.getByRole('button',{name:'Уже в игре'}).waitFor();
  await page.screenshot({path:'test-results/shop-boxes.png'});
  await page.getByRole('tab',{name:'Персонажи',exact:true}).click();
  assert.equal(await page.locator('.shop-current').textContent(),'Шушистики','Tab retains its position');
  await next('Суши-пати');
  for(let i=1;i<=3;i++){
    await watch(page.getByRole('button',{name:/Открыть за видео/}));
    const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')));
    assert.equal(profile.videos['skins:sushi'],i);
    assert.equal(profile.owned.includes('skins:sushi'),i===3);
  }
  assert.equal(await coins(),25,'Ad unlock never spends wallet coins');
  await page.getByRole('button',{name:'Выбрать',exact:true}).click();await page.getByRole('button',{name:'Уже в игре'}).waitFor();
  await close();
  await page.getByRole('button',{name:'Подарки',exact:true}).click();
  await page.getByRole('button',{name:/Ежедневный подарок/}).click();assert.equal(await coins(),50);
  assert.ok(await page.getByRole('button',{name:/До завтра!/}).isDisabled());
  const shakeCount=await page.locator('.shake-button>b').textContent();
  await watch(page.getByRole('button',{name:/Добавить встряску/}));
  assert.equal(Number(await page.locator('.shake-button>b').textContent()),Number(shakeCount)+1);
  await page.screenshot({path:'test-results/gifts.png'});await close();
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const sound=page.getByRole('switch',{name:'Звук'}),vibration=page.getByRole('switch',{name:'Вибрация'});
  await sound.click();assert.equal(await sound.getAttribute('aria-checked'),'false');
  await vibration.click();assert.equal(await vibration.getAttribute('aria-checked'),'false');
  await page.screenshot({path:'test-results/settings.png'});await close();
  await page.reload({waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  assert.equal(await coins(),50);
  assert.ok((await page.locator('.chain-fruit img').first().getAttribute('src')).includes('/skins/sushi/'));
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')));
  assert.equal(restored.selected.skins,'sushi');assert.equal(restored.selected.backgrounds,'sunset');assert.equal(restored.selected.boxes,'rose');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();assert.equal(await sound.getAttribute('aria-checked'),'false');assert.equal(await vibration.getAttribute('aria-checked'),'false');await close();
  const field=await page.locator('canvas').boundingBox();
  await page.touchscreen.tap(field.x+field.width*.5,field.y+field.height*.13);await page.waitForTimeout(1500);
  await page.screenshot({path:'test-results/selected-theme.png'});
  await openShop();
  await page.waitForTimeout(350);
  const rail=await page.locator('.snap-viewport').boundingBox(),touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rail.x+rail.width*.8,y:rail.y+rail.height*.3}]});
  for(let i=1;i<=8;i++){
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rail.x+rail.width*(.8-i*.075),y:rail.y+rail.height*.3}]});
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(100);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
  await page.waitForFunction(()=>document.querySelector('.shop-current')?.textContent==='Шушистики');
  await page.getByRole('button',{name:'Показать Кристаллики',exact:true}).click();
  await page.waitForFunction(()=>{const card=document.querySelector('.shop-card[data-theme=crystals]').getBoundingClientRect(),rail=document.querySelector('.snap-viewport').getBoundingClientRect();return Math.abs(card.left+card.width/2-rail.left-rail.width/2)<2;});
  assert.equal(await page.locator('.shop-card[data-centred=true]').getAttribute('data-theme'),'crystals','Visible card and purchase target agree after dot navigation');
  await page.locator('.snap-viewport').focus();await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>document.querySelector('.shop-current')?.textContent==='Вкусный переполох');
  for(const [w,h] of [[320,568],[360,640],[844,390]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);
    const rect=await page.getByRole('dialog',{name:'Магазин',exact:true}).boundingBox();assert.deepEqual(rect,{x:0,y:0,width:w,height:h},`Shop fills ${w}×${h}`);
    const play=await page.getByRole('button',{name:'Играть',exact:true}).boundingBox();assert.ok(play.y>=0&&play.y+play.height<=h+1,'Return to game is visible without scrolling');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight));
    await page.screenshot({path:`test-results/shop-${w}x${h}.png`});
  }
  await page.close();
  console.log('✓ shop purchases, native snapping, theme persistence, cancelled/completed ads, 3-video skin unlock, daily gift and settings');
}
