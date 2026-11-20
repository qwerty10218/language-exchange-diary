import assert from 'node:assert/strict';
// Run in a regular desktop context too; viewport width alone does not change
// Playwright's isMobile flag or the browser's input configuration.
export async function guidedWritingLayoutQA(page,base,name,output){
  await page.goto(base+'#library');await page.locator('#word-search').fill('なに');await page.locator('.entry-word-link').click();await page.getByRole('button',{name:'練習這個詞',exact:true}).click();await page.waitForSelector('.writing:visible');
  for(const width of [320,375,390,430,768,1440])for(const [mode,colorScheme] of [['hant','light'],['hans','dark']]){
    await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme,reducedMotion:'reduce'});await page.locator('.script-switch button').nth(mode==='hans'?1:0).click();
    assert.equal(await page.locator('.guided-session:visible > h1').innerText(),'なに');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    for(const target of await page.locator('.guided-session:visible button:visible,.guided-session:visible summary').all()){
      const box=await target.boundingBox();assert.ok(box.width>=44&&box.height>=44);
    }
    if(width===390||width===1440)await page.screenshot({path:`${output}/${name}-word-writing-${width}-${mode}.png`,fullPage:true});
  }
  await page.locator('.script-switch button').first().click();
  await page.getByRole('button',{name:'示範／重播',exact:true}).click();await page.waitForSelector('.writing:visible .animated');
  // Restarting a replay must leave a single demonstration, not a second timer.
  await page.getByRole('button',{name:'示範／重播',exact:true}).click();
  assert.equal(await page.locator('.writing:visible .animated').count(),1);
  await page.locator('nav a[href="#alphabet"]').click();await page.locator('nav a[href="#writing"]').click();
  assert.match(await page.locator('.guided-session:visible .guided-progress').innerText(),/1／2/);
  await guidedWritingReturnQA(page,base);
}
export async function guidedWritingReturnQA(page,base){
  await page.goto(base+'#library');await page.locator('.script-switch button').first().click();await page.locator('.language-tabs button').last().click();
  await page.locator('#word-search').fill('なに');await page.locator('.entry-word-link').click();await page.getByRole('button',{name:'練習這個詞',exact:true}).click();
  assert.equal(await page.locator('.guided-session:visible > h1').getAttribute('lang'),'ja');
  await page.locator('nav a[href="#library"]').click();await page.locator('.language-tabs button').first().click();
  await page.locator('.letter-filter-toggle').click();await page.getByRole('button',{name:'篩選包含 ㅁ 的單字',exact:true}).click();
  await page.locator('nav a[href="#writing"]').click();await page.getByRole('button',{name:'← 返回單字',exact:true}).click();
  await page.locator('.word-detail > button').first().click();
  assert.equal(await page.locator('.language-tabs button').last().getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.active-letter-filter').count(),0,'Returning to a Japanese session clears an incompatible Korean filter');
  assert.equal(await page.locator('#word-search').inputValue(),'なに');
}
export async function guidedWritingQA(page,base,name,output){
  const nav=async target=>{await page.locator(`nav a[href="#${target}"]`).click();};
  const open=async(text,ko=false)=>{
    await nav('library');await page.locator('.language-tabs button').nth(ko?0:1).click();
    await page.locator('#word-search').fill(text);await page.locator('.entry-word-link').filter({has:page.locator('.entry-original',{hasText:new RegExp(`^${text}$`)})}).click();
    await page.getByRole('button',{name:'練習這個詞',exact:true}).click();await page.waitForSelector('.writing:visible');
  };
  const canvas=()=>page.locator('.writing:visible');
  const current=()=>canvas().getAttribute('aria-label');
  const stroke=async(index,{reverse=false,short=false,cancel=false,wrong=false}={})=>{
    await canvas().evaluate(svg=>svg.scrollIntoView({block:'center',behavior:'instant'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const origin=await canvas().boundingBox();
    const points=await canvas().evaluate((svg,index)=>{
      const path=svg.querySelectorAll('.guide')[index],length=path.getTotalLength(),matrix=svg.getScreenCTM();
      return Array.from({length:65},(_,i)=>{const p=path.getPointAtLength(length*i/64);const q=new DOMPoint(p.x,p.y).matrixTransform(matrix);return {x:q.x,y:q.y};});
    },index);
    if(reverse)points.reverse();if(short)points.splice(4);
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
    for(const point of points.slice(1))await page.mouse.move(point.x,point.y);
    if(cancel)await canvas().evaluate(svg=>svg.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
    await page.mouse.up();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    const end=await canvas().boundingBox();assert.ok(Math.abs(end.y-origin.y)<1,'Canvas must not move when feedback wraps during a gesture');
    if(!reverse&&!short&&!cancel&&!wrong&&await canvas().locator('.completed-ink').count()!==index+1){
      await page.screenshot({path:`${output}/${name}-guided-failure.png`,fullPage:true});
      throw new Error(`${name}: stroke ${index+1}: ${await page.locator('.guided-letter:visible .feedback').innerText()}`);
    }
  };
  const finish=async()=>{
    const label=await current(),step=await page.locator('.guided-session:visible .guided-progress').innerText();console.log(name,'tracing',label);const count=await canvas().locator('.guide').count();
    for(let i=0;i<count;i++){
      await stroke(i);
      if(i+1<count)await page.waitForFunction(i=>[...document.querySelectorAll('.writing')].find(el=>el.getBoundingClientRect().width)?.querySelectorAll('.completed-ink').length>=i+1,i);
    }
    await page.waitForFunction(step=>document.querySelector('[data-active-writing] .guided-progress')?.innerText!==step,step);
  };
  await page.goto(base+'#library');await open('なに');assert.match(await current(),/^な /);
  for(const options of [{reverse:true},{short:true},{cancel:true}]){await stroke(0,options);assert.equal(await canvas().locator('.completed-ink').count(),0);assert.match(await current(),/^な /);}
  await stroke(1,{wrong:true});assert.equal(await canvas().locator('.completed-ink').count(),0);
  await stroke(0);await canvas().locator('.completed-ink').first().waitFor({state:'attached'});
  await nav('alphabet');await page.locator('.alphabet-grid button').filter({hasText:'あ'}).first().click();await page.getByRole('button',{name:'進入書寫練習',exact:true}).click();await open('なに');assert.equal(await canvas().locator('.completed-ink').count(),1);
  // Finish remaining strokes, verifying release advances automatically without submit.
  const count=await canvas().locator('.guide').count();
  for(let i=1;i<count;i++){await stroke(i);if(i+1<count)await page.waitForFunction(i=>[...document.querySelectorAll('.writing')].find(el=>el.getBoundingClientRect().width)?.querySelectorAll('.completed-ink').length>=i+1,i);}
  await nav('alphabet');await page.waitForTimeout(1000);assert.match(await page.locator('[data-active-writing] .guided-progress').innerText(),/1／2/);await nav('writing');
  await page.waitForFunction(()=>[...document.querySelectorAll('.writing')].find(el=>el.getBoundingClientRect().width)?.getAttribute('aria-label')?.startsWith('に '));
  await finish();assert.match(await page.locator('.guided-finish:visible').innerText(),/練習完成/);
  await page.getByRole('button',{name:'再練一次',exact:true}).click();assert.match(await current(),/^な /);
  for(const width of [320,375,390,430,768,1440]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${output}/${name}-guided-${width}.png`});
  }
  await page.setViewportSize({width:390,height:900});
  await open('라면',true);for(const options of [{reverse:true},{short:true},{cancel:true}]){await stroke(0,options);assert.equal(await canvas().locator('.completed-ink').count(),0);}await stroke(1,{wrong:true});assert.equal(await canvas().locator('.completed-ink').count(),0);for(const letter of ['라','면']){assert.ok((await current()).startsWith(letter+' '));await finish();}
  assert.ok(await page.locator('.guided-finish:visible').count());
  await open('우동',true);for(const letter of ['우','동']){assert.ok((await current()).startsWith(letter+' '));await finish();}
  await open('심심하다',true);for(const letter of ['심','심','하','다']){assert.ok((await current()).startsWith(letter+' '));await finish();}
  await open('美しい');assert.match(await page.locator('.guided-session:visible > .notice').innerText(),/部分字母尚未開放/);
  assert.doesNotMatch(await current(),/^う /);
  await nav('alphabet');await page.locator('.language-tabs button').last().click();
  await page.locator('.alphabet-grid button').filter({hasText:'あ'}).first().click();
  await page.getByRole('button',{name:'進入書寫練習',exact:true}).click();await finish();assert.ok(await page.locator('.guided-finish:visible').count());
}
