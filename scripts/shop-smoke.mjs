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
  const section=category=>page.locator(`[data-category=${category}]`);
  const waitItem=async(category,name)=>{
    await page.waitForFunction(({category,name})=>{
      const s=document.querySelector(`[data-category=${category}]`),card=s.querySelector('.rail-card[data-centred=true]'),rail=s.querySelector('.snap-viewport'),item=s.querySelector('.shop-current');
      if(!card||item.textContent!==name)return false;
      const a=card.getBoundingClientRect(),b=rail.getBoundingClientRect();return Math.abs(a.left+a.width/2-b.left-b.width/2)<2&&card.querySelector('article').getAttribute('aria-label')===name;
    },{category,name});
  };
  const next=async(category,name)=>{await section(category).getByRole('button',{name:'Следующий товар'}).click();await waitItem(category,name);};
  const watch=async(button)=>{await button.click();await page.getByRole('dialog',{name:'Имитация рекламы'}).waitFor();await page.locator('.ad-overlay').waitFor({state:'detached'});};
  await openShop();await page.waitForTimeout(400);
  assert.deepEqual(await page.locator('.shop-collection').evaluateAll(els=>els.map(el=>el.dataset.category)),['skins','backgrounds','boxes'],'All three collections are stacked on one page');
  assert.equal(await page.locator('svg').count(),0,'Every visible icon is raster artwork');
  assert.deepEqual(await page.getByRole('dialog',{name:'Магазин',exact:true}).boundingBox(),{x:0,y:0,width:390,height:844});
  assert.ok(await page.locator('.scene').evaluate(el=>el.inert));
  assert.ok(await section('skins').locator('.snap-viewport').evaluate(el=>getComputedStyle(el).scrollSnapType.includes('mandatory')));
  assert.ok(await section('skins').locator('.snap-viewport').evaluate(el=>{
    const rail=el.getBoundingClientRect(),cards=[...el.querySelectorAll('.rail-card')].filter(c=>{const r=c.getBoundingClientRect();return r.right>rail.left&&r.left<rail.right;}),central=cards.find(c=>c.dataset.centred==='true'),centre=rail.left+rail.width/2;
    return cards.filter(c=>c.getBoundingClientRect().left+c.getBoundingClientRect().width/2<centre-5).length>=2&&cards.filter(c=>c.getBoundingClientRect().left+c.getBoundingClientRect().width/2>centre+5).length>=2&&new DOMMatrixReadOnly(getComputedStyle(central).transform).a>.98&&cards.some(c=>new DOMMatrixReadOnly(getComputedStyle(c).transform).a<.6);
  }),'Two smaller cards are visible on each side of the full-size card');
  await section('skins').getByRole('button',{name:'Предыдущий товар'}).click();await waitItem('skins','Кристаллики');
  await next('skins','Фруктовая семья');await next('skins','Шушистики');
  await page.screenshot({path:'test-results/shop-skins.png'});
  await section('skins').getByRole('button',{name:'Купить за 180'}).click();assert.equal(await coins(),220);
  await section('skins').getByRole('button',{name:'Выбрать',exact:true}).click();await section('skins').getByRole('button',{name:'Уже в игре'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.chain-fruit img').src.includes('/skins/fuzzies/'));
  await next('backgrounds','Сакура на закате');
  await section('backgrounds').getByRole('button',{name:'Купить за 120'}).click();assert.equal(await coins(),100);
  await section('backgrounds').getByRole('button',{name:'Выбрать',exact:true}).click();await section('backgrounds').getByRole('button',{name:'Уже в игре'}).waitFor();
  assert.ok(await page.locator('.ambient-background').evaluate(el=>getComputedStyle(el,'::before').backgroundImage.includes('backgrounds/sunset.webp')));
  await page.screenshot({path:'test-results/shop-backgrounds.png'});
  await next('boxes','Розовый кварц');assert.ok(await section('boxes').getByRole('button',{name:'Нужно ещё 50'}).isDisabled());
  await page.getByRole('button',{name:'+75 монет за видео',exact:true}).click();await page.getByRole('button',{name:'Закрыть без награды'}).click();assert.equal(await coins(),100);
  assert.equal(await section('boxes').locator('.shop-current').textContent(),'Розовый кварц');
  await watch(page.getByRole('button',{name:'+75 монет за видео',exact:true}));assert.equal(await coins(),175);await page.waitForTimeout(400);assert.equal(await coins(),175);
  await section('boxes').getByRole('button',{name:'Купить за 150'}).click();assert.equal(await coins(),25);
  await section('boxes').getByRole('button',{name:'Выбрать',exact:true}).click();await section('boxes').getByRole('button',{name:'Уже в игре'}).waitFor();
  await page.screenshot({path:'test-results/shop-boxes.png'});
  assert.equal(await section('skins').locator('.shop-current').textContent(),'Шушистики','Rails keep independent selections');
  await next('skins','Суши-пати');
  for(let i=1;i<=3;i++){
    await watch(section('skins').getByRole('button',{name:/Открыть за видео/}));
    const profile=await page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')));
    assert.equal(profile.videos['skins:sushi'],i);assert.equal(profile.owned.includes('skins:sushi'),i===3);
  }
  assert.equal(await coins(),25);
  await section('skins').getByRole('button',{name:'Выбрать',exact:true}).click();await section('skins').getByRole('button',{name:'Уже в игре'}).waitFor();await close();
  await page.getByRole('button',{name:'Подарки',exact:true}).click();await page.getByRole('button',{name:/Ежедневный подарок/}).click();assert.equal(await coins(),50);
  assert.ok(await page.getByRole('button',{name:/До завтра!/}).isDisabled());
  const shakeCount=await page.locator('.shake-button>b').textContent();await watch(page.getByRole('button',{name:/Добавить встряску/}));assert.equal(Number(await page.locator('.shake-button>b').textContent()),Number(shakeCount)+1);
  await page.screenshot({path:'test-results/gifts.png'});await close();
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  const sound=page.getByRole('switch',{name:'Звук'}),vibration=page.getByRole('switch',{name:'Вибрация'});
  await sound.click();assert.equal(await sound.getAttribute('aria-checked'),'false');await vibration.click();assert.equal(await vibration.getAttribute('aria-checked'),'false');await page.screenshot({path:'test-results/settings.png'});await close();
  await page.reload({waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});assert.equal(await coins(),50);
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')));assert.equal(restored.selected.skins,'sushi');assert.equal(restored.selected.backgrounds,'sunset');assert.equal(restored.selected.boxes,'rose');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();assert.equal(await sound.getAttribute('aria-checked'),'false');assert.equal(await vibration.getAttribute('aria-checked'),'false');await close();
  const field=await page.locator('canvas').boundingBox();await page.touchscreen.tap(field.x+field.width*.5,field.y+field.height*.13);await page.waitForTimeout(1500);await page.screenshot({path:'test-results/selected-theme.png'});
  await openShop();await page.waitForTimeout(350);
  const rail=await section('skins').locator('.snap-viewport').boundingBox(),touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rail.x+rail.width*.62,y:rail.y+rail.height*.45}]});
  for(let i=1;i<=8;i++){await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rail.x+rail.width*.62-i*9,y:rail.y+rail.height*.45}]});await page.waitForTimeout(70);}
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(900);
  assert.notEqual(await section('skins').locator('.shop-current').textContent(),'Суши-пати','Native horizontal swipe selects a new item');
  await section('skins').getByRole('button',{name:'Показать Кристаллики',exact:true}).click();await waitItem('skins','Кристаллики');
  await section('skins').locator('.snap-viewport').focus();await page.keyboard.press('ArrowLeft');await waitItem('skins','Вкусный переполох');
  await page.locator('.shop-scroll').evaluate(el=>el.scrollTop=0);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rail.x+rail.width/2,y:rail.y+rail.height*.7}]});
  for(let i=1;i<=8;i++){await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rail.x+rail.width/2,y:rail.y+rail.height*.7-i*17}]});await page.waitForTimeout(50);}
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();await page.waitForTimeout(350);
  assert.ok(await page.locator('.shop-scroll').evaluate(el=>el.scrollTop>60),'A vertical gesture over cards scrolls the page');
  await page.locator('.shop-scroll').evaluate(el=>el.scrollTop=0);
  await section('skins').getByRole('button',{name:'Показать Фруктовая семья',exact:true}).click();await waitItem('skins','Фруктовая семья');
  const mouseRail=await section('skins').locator('.snap-viewport').boundingBox(),mouseX=mouseRail.x+mouseRail.width*.65,mouseY=mouseRail.y+mouseRail.height*.45;
  await page.mouse.move(mouseX,mouseY);await page.mouse.down();await page.mouse.move(mouseX-80,mouseY,{steps:4});await page.mouse.up();await waitItem('skins','Шушистики');
  for(const [w,h] of [[320,568],[360,640],[844,390]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);
    assert.deepEqual(await page.getByRole('dialog',{name:'Магазин',exact:true}).boundingBox(),{x:0,y:0,width:w,height:h});
    const play=await page.getByRole('button',{name:'Играть',exact:true}).boundingBox();assert.ok(play.y>=0&&play.y+play.height<=h+1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight));
    await page.locator('.shop-scroll').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`test-results/shop-${w}x${h}.png`});
  }
  await page.close();console.log('✓ stacked shop, circular floating cards, both touch gestures, purchases, theme persistence, ads, daily gift and settings');
}
