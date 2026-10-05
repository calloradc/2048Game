import assert from 'node:assert/strict';

export async function checkGameover(browser,base,errors){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
  await page.addInitScript(()=>{Math.random=()=>.99;});
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading').waitFor({state:'detached'});
  await page.clock.install();
  await page.clock.runFor(600);
  const canvas=page.locator('canvas');
  for(let i=0;i<15;i++)await canvas.dispatchEvent('keydown',{key:'ArrowLeft'});
  let throws=0;
  for(;throws<150;throws++){
    if(await page.getByRole('dialog',{name:'Игра окончена'}).count())break;
    if(await page.getByRole('dialog',{name:'Победа'}).count())await page.getByRole('button',{name:'Продолжить играть'}).click({force:true});
    await canvas.dispatchEvent('keydown',{key:'Enter'});await page.clock.runFor(650);
  }
  assert.ok(await page.getByRole('dialog',{name:'Игра окончена'}).count(),`Overflow loses after ${throws} ordinary drops`);
  assert.equal(await page.getByRole('button',{name:'Ещё разок',exact:true}).count(),0,'Ad rewards appear before replay');
  await page.clock.runFor(1100);assert.equal(await page.getByRole('button',{name:'Ещё разок',exact:true}).count(),1,'Replay appears after one second');await page.screenshot({path:'test-results/gameover.png'});
  const wallet=async()=>Number((await page.getByTestId('coins').textContent()).replace(/\D/g,''));
  const earned=await wallet();assert.ok(earned>0);
  await page.getByRole('button',{name:/Монеты за игру ×2/}).click({force:true});await page.clock.runFor(3500);
  assert.equal(await wallet(),earned*2);assert.equal(await page.getByRole('button',{name:/Монеты за игру ×2/}).count(),0);
  await page.getByRole('button',{name:/Спасти урожай/}).click({force:true});await page.clock.runFor(3500);await page.clock.runFor(400);
  assert.equal(await page.getByRole('dialog').count(),0,'Rewarded rescue resumes the real game');
  assert.ok(await wallet()>=earned*2,'Rescue preserves the doubled wallet; resumed merges may earn more coins');
  await canvas.dispatchEvent('keydown',{key:'Enter'});await page.clock.runFor(700);
  await page.screenshot({path:'test-results/revived.png'});
  await page.close();console.log(`✓ actual overflow after ${throws} drops, one-time coin doubling and rewarded rescue`);
}
