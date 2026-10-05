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
  for(;throws<250;throws++){
    if(await page.getByRole('dialog',{name:'Игра окончена'}).count())break;
    if(await page.getByRole('dialog',{name:'Победа'}).count())await page.getByRole('button',{name:'Продолжить играть'}).click({force:true});
    await canvas.dispatchEvent('keydown',{key:'Enter'});await page.clock.runFor(650);
  }
  assert.ok(await page.getByRole('dialog',{name:'Игра окончена'}).count(),`Overflow loses after ${throws} ordinary drops`);
  assert.equal(await page.getByRole('button',{name:'Ещё разок',exact:true}).count(),0,'Ad rewards appear before replay');
  await page.getByRole('dialog',{name:'Предупреждение о рекламе'}).waitFor();
  await page.clock.runFor(1200);assert.equal(await page.getByRole('dialog',{name:'Межстраничная реклама'}).count(),0,'Warning lasts two visible seconds');
  await page.clock.runFor(1000);assert.equal(await page.getByRole('dialog',{name:'Межстраничная реклама'}).count(),1);
  await page.clock.runFor(2500);assert.equal(await page.getByRole('button',{name:'Ещё разок',exact:true}).count(),0,'Replay waits for the ad');
  await page.clock.runFor(1900);assert.equal(await page.getByRole('button',{name:'Ещё разок',exact:true}).count(),1,'Replay appears one second after the interstitial');await page.screenshot({path:'test-results/gameover.png'});
  const wallet=async()=>Number(await page.getByTestId('coins').getAttribute('data-coins'));
  const earned=await wallet();assert.ok(earned>0);
  await page.getByRole('button',{name:/Монеты за игру ×2/}).click({force:true});await page.clock.runFor(3500);
  assert.equal(await wallet(),earned*2);assert.equal(await page.getByRole('button',{name:/Монеты за игру ×2/}).count(),0);
  await page.getByRole('button',{name:/Спасти урожай/}).click({force:true});await page.clock.runFor(3500);await page.clock.runFor(400);
  assert.equal(await page.getByRole('dialog').count(),0,'Rewarded rescue resumes the real game');
  assert.ok(await wallet()>=earned*2,'Rescue preserves the doubled wallet; resumed merges may earn more coins');
  await canvas.dispatchEvent('keydown',{key:'Enter'});await page.clock.runFor(700);
  await page.screenshot({path:'test-results/revived.png'});
  let extra=0;
  for(;extra<200;extra++){
    if(await page.getByRole('dialog',{name:'Игра окончена'}).count())break;
    if(await page.getByRole('dialog',{name:'Победа'}).count())await page.getByRole('button',{name:'Продолжить играть'}).click({force:true});
    await canvas.dispatchEvent('keydown',{key:'Enter'});await page.clock.runFor(650);
  }
  assert.equal(await page.getByRole('dialog',{name:'Игра окончена'}).count(),1,'The revived round can finish normally');
  await page.clock.runFor(6500);
  assert.equal(await page.getByRole('dialog',{name:'Лидерборд'}).count(),0,'A record popup waits until a new round starts');
  await page.getByRole('button',{name:'Ещё разок',exact:true}).click({force:true});await page.clock.runFor(300);
  assert.equal(await page.getByTestId('score').textContent(),'0','A fresh round resets the score before showing rank progress');
  assert.equal(await page.getByRole('dialog',{name:'Лидерборд'}).count(),1,'A lost round beating its starting best shows the demo ranking');
  const firstRank=Number((await page.getByTestId('animated-rank').textContent()).replace(/\D/g,''));
  await page.clock.runFor(900);
  const middleRank=Number((await page.getByTestId('animated-rank').textContent()).replace(/\D/g,''));
  await page.clock.runFor(1500);
  const finalRank=Number((await page.getByTestId('animated-rank').textContent()).replace(/\D/g,''));
  assert.ok(firstRank>middleRank&&middleRank>=finalRank,'The displayed global rank animates upward');
  assert.ok(await page.locator('.leaderboard-summary').textContent().then(text=>text.includes('из 201')));
  await page.screenshot({path:'test-results/leaderboard.png'});
  await page.getByRole('button',{name:'Продолжить играть'}).click({force:true});await page.clock.runFor(400);
  await canvas.dispatchEvent('keydown',{key:'Enter'});await page.clock.runFor(700);
  assert.equal(await page.getByRole('dialog').count(),0,'Closing the leaderboard resumes the new round');
  await page.close();console.log(`✓ actual overflow after ${throws} drops, one-time rewards, rescue without a popup and animated record ranking after restarting`);
}
