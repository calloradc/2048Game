import assert from 'node:assert/strict';

export async function checkLocalization(browser,base,errors){
  const expected={ru:['Магазин','Настройки','Забрать','Вишня'],en:['Shop','Settings','Claim','Cherry'],tr:['Mağaza','Ayarlar','Al','Kiraz'],it:['Negozio','Impostazioni','Ritira','Ciliegia'],pt:['Loja','Configurações','Resgatar','Cereja']};
  for(const language of Object.keys(expected)){
    const page=await browser.newPage({viewport:{width:320,height:568},isMobile:true,hasTouch:true,locale:language});
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
    await page.goto(base,{waitUntil:'networkidle'});await page.locator('.loading-screen').waitFor({state:'detached'});
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    assert.equal(await page.locator('.chain-fruit.discovered span').textContent(),expected[language][3]);
    const translated=async selector=>{
      if(language==='ru')return;
      const leftovers=await page.locator(selector).evaluate(el=>{
        const strings=[];const visit=node=>{if(node.nodeType===Node.TEXT_NODE)strings.push(node.textContent);else if(node.nodeType===Node.ELEMENT_NODE){if(node.tagName==='OPTION')return;for(const a of node.attributes)if(['aria-label','aria-roledescription','alt','title'].includes(a.name))strings.push(a.value);for(const child of node.childNodes)visit(child);}};visit(el);return strings.filter(s=>/[А-Яа-яЁё]/.test(s));
      });assert.deepEqual(leftovers,[],`${language}: translated text and accessibility labels in ${selector}`);
    };
    const close=async()=>{await page.locator('.dialog-close').click();await page.locator('.overlay').waitFor({state:'detached'});};
    await translated('.scene');
    await page.locator('.header-buttons button').last().click();assert.equal(await page.locator('.dialog h1').textContent(),expected[language][1]);await translated('.dialog');
    // A change of language must rerender the open dialog and survive a reload.
    await page.locator('.language-setting select').selectOption(language==='en'?'it':'en');
    assert.equal(await page.locator('.dialog h1').textContent(),language==='en'?'Impostazioni':'Settings');
    await page.locator('.language-setting select').selectOption(language);await close();
    for(const trigger of ['.utility-button:first-child','.wallet']){await page.locator(trigger).click();await translated('.dialog');await close();}
    await page.locator('.shop-launch').click();await page.waitForTimeout(350);assert.equal(await page.locator('.shop-heading h1').textContent(),expected[language][0]);await translated('.shop-dialog');
    const skin=page.locator('[data-category=skins]');await skin.locator('.rail-card[data-centred=true]').click();await page.locator('.contents-dialog').waitFor();
    assert.equal(await page.locator('.contents-grid figure').count(),11);assert.equal(await page.locator('.contents-grid figcaption').first().textContent(),expected[language][3]);await translated('.contents-dialog');
    await page.locator('.contents-dialog .dialog-close').click();await page.locator('.contents-overlay').waitFor({state:'detached'});
    await page.locator('.shop-quick-coins').click();await page.locator('.ad-dialog').waitFor();await translated('.ad-dialog');await page.locator('.ad-dialog .text-button').click();await page.locator('.ad-overlay').waitFor({state:'detached'});
    await close();await page.locator('.utility-button:last-child').click();await translated('.rewards-dialog');assert.equal(await page.locator('.daily-claim').textContent(),expected[language][2]);
    await page.waitForTimeout(350);await page.screenshot({path:`test-results/localization-${language}.png`});await page.locator('.daily-claim').click();await translated('.toast');await close();
    await page.reload({waitUntil:'networkidle'});await page.locator('.loading-screen').waitFor({state:'detached'});assert.equal(await page.locator('html').getAttribute('lang'),language);
    await page.close();
  }
  console.log('✓ five complete languages, catalog and character names, accessibility labels, ads, rewards, notifications and persisted language choice');
}
