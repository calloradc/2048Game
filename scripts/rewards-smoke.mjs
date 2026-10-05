import assert from 'node:assert/strict';

export async function checkRewardsAndOffers(browser,base,errors){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
  await page.addInitScript(()=>{
    if(localStorage.getItem('daily-offers-seeded'))return;
    localStorage.setItem('daily-offers-seeded','true');localStorage.setItem('jelly-coins','1000');
    localStorage.setItem('jelly-profile',JSON.stringify({daily:'2020-01-01',dailyCount:3}));
  });
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  const profile=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('jelly-profile')));
  const coins=async()=>Number((await page.getByTestId('coins').textContent()).replace(/\D/g,''));
  const close=async()=>{await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('.overlay').waitFor({state:'detached'});};
  const watch=async(button)=>{await button.click();await page.getByRole('dialog',{name:'Имитация рекламы'}).waitFor();await page.locator('.ad-overlay').waitFor({state:'detached'});};
  await page.getByRole('button',{name:'Подарки',exact:true}).click();
  await page.getByRole('button',{name:'Забрать ежедневный подарок'}).click();
  assert.ok((await profile()).owned.includes('boxes:lunar'));assert.equal((await profile()).dailyCount,4);
  await page.getByRole('button',{name:'Надеть Лунное стекло'}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('jelly-profile')).selected.boxes==='lunar');
  await page.screenshot({path:'test-results/daily-exclusive.png'});await close();
  await page.getByRole('button',{name:'Магазин',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-category=boxes] .shop-current').textContent.startsWith('Лунное стекло'));
  assert.ok(await page.locator('[data-category=boxes] .shop-arrow.next').isDisabled(),'Shop opens on the equipped last box');
  const header=await page.locator('.shop-heading').boundingBox(),quick=await page.locator('.shop-quick-coins').boundingBox();
  assert.ok(quick.y>=header.y+header.height-1&&quick.x>195,'Coin video button stays at the top right under the header');
  const nav=page.getByRole('navigation',{name:'Разделы магазина'}),navPosition=await nav.boundingBox();
  await nav.getByRole('button',{name:'Наборы',exact:true}).click();
  await page.getByRole('button',{name:'Купить Уютный набор за 360'}).click();
  assert.equal(await coins(),640);assert.equal((await profile()).shakeTokens,3);
  for(const key of ['skins:fuzzies','backgrounds:sunset','boxes:rose'])assert.ok((await profile()).owned.includes(key));
  assert.ok(await page.locator('.bundle-card.cozy .primary-button').isDisabled());
  await page.screenshot({path:'test-results/shop-offers.png'});
  await nav.getByRole('button',{name:'Монеты',exact:true}).click();
  await page.getByRole('button',{name:'Купить 5 встрясок за 100'}).click();assert.equal(await coins(),540);assert.equal((await profile()).shakeTokens,8);
  await watch(page.locator('.supply-card.coins .supply-video'));assert.equal(await coins(),540);assert.equal((await profile()).coinVideo,1);
  await watch(page.locator('.supply-card.coins .supply-video'));assert.equal(await coins(),690);assert.equal((await profile()).coinVideo,0);
  assert.deepEqual(await nav.boundingBox(),navPosition,'Section navigation stays fixed while scrolling and buying');
  await close();
  await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Начать заново',exact:true}).click();await page.locator('.overlay').waitFor({state:'detached'});
  assert.equal(Number(await page.locator('.shake-button>b').textContent()),11,'Restart keeps the purchased bank plus three free shakes');
  await page.reload({waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  assert.equal((await profile()).shakeTokens,8);assert.equal(await coins(),690);
  await page.getByRole('button',{name:'Подарки',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Забрать ежедневный подарок'}).count(),0,'Reload cannot reclaim today’s prize');await close();
  for(let i=0;i<4;i++)await page.getByRole('button',{name:/Встряхнуть/}).click();
  assert.equal((await profile()).shakeTokens,7,'Free shakes are used before consuming the persistent bank');assert.equal(await coins(),690);
  await page.close();
  console.log('✓ real exclusive daily prize, equipped shop entry, fixed top navigation, one-time bundles, persistent shake packs and two-view coin packs');
}
