import assert from 'node:assert/strict';

// Real browser pointer gestures through the public word flow; no direct calls
// to the recognizer or programmatically accepted ink.
export async function tracingRecoveryQA(page,base,name,output,{debug=false}={}){
  await page.goto(base+'#library');
  await page.locator('.language-tabs button').first().click();
  await page.locator('#word-search').fill('다이어트');
  await page.locator('.entry-word-link').click();
  await page.getByRole('button',{name:'練習這個詞',exact:true}).click();
  const canvas=()=>page.locator('.writing:visible');
  const feedback=()=>page.locator('.guided-letter:visible .feedback');
  const count=()=>canvas().locator('.completed-ink').count();
  const points=async index=>{
    await canvas().evaluate(svg=>svg.scrollIntoView({block:'center',behavior:'instant'}));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    return canvas().evaluate((svg,index)=>{
      const p=svg.querySelectorAll('.guide')[index],l=p.getTotalLength();
      return Array.from({length:81},(_,i)=>{const q=p.getPointAtLength(l*i/80);return {x:q.x,y:q.y};});
    },index);
  };
  const gesture=async(input,{cancel=false,lost=false,beforeUp}={})=>{
    const origin=await canvas().boundingBox();
    const matrix=await canvas().evaluate(svg=>{const m=svg.getScreenCTM();return {a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f};});
    const move=async p=>{
      await page.mouse.move(matrix.a*p.x+matrix.c*p.y+matrix.e,matrix.b*p.x+matrix.d*p.y+matrix.f);
      // WebKit can acknowledge mouse commands before delivering their events.
      // Sample at rendered frames, as a real finger would, rather than flood IPC.
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
    };
    await move(input[0]);await page.mouse.down();
    for(const p of input.slice(1))await move(p);
    if(beforeUp)await beforeUp(move);
    if(cancel)await canvas().evaluate(svg=>svg.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
    if(lost)await canvas().evaluate(svg=>svg.releasePointerCapture(1));
    await page.mouse.up();
    await page.waitForFunction(()=>{const svg=[...document.querySelectorAll('.writing')].find(el=>el.getBoundingClientRect().width);return svg&&!['drawing','validating'].includes(svg.dataset.phase);});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
    const end=await canvas().boundingBox();assert.ok(Math.abs(end.y-origin.y)<1,`Canvas shifted during tracing: ${JSON.stringify({origin,end})}`);
  };
  // Reach 트 through the real word, preserving the preceding completed blocks.
  for(let block=0;block<3;block++){
    const label=await canvas().getAttribute('aria-label');
    const strokes=await canvas().locator('.guide').count();
    for(let i=0;i<strokes;i++){await gesture(await points(i));assert.equal(await count(),i+1,await feedback().innerText());}
    await page.waitForFunction(label=>[...document.querySelectorAll('.writing')].find(el=>el.getBoundingClientRect().width)?.getAttribute('aria-label')!==label,label);
  }
  assert.equal(await canvas().getAttribute('aria-label'),'트 書寫區');
  const first=await points(0);
  for(const [input,options,reason] of [[await points(1),{},/筆順/],[[...first].reverse(),{},/筆順|方向/],[first.slice(0,4),{},/短/],[first,{cancel:true},/取消/],[first,{lost:true},/取消/]]){
    await gesture(input,options);assert.equal(await count(),0);assert.match(await feedback().innerText(),reason);
  }
  await gesture(first.map(p=>({x:p.x+12,y:p.y+12})));assert.equal(await count(),1);
  const second=await points(1);
  await gesture(second.map((p,i)=>({x:p.x,y:p.y+45*i/80})),{beforeUp:async move=>{
    assert.match(await feedback().innerText(),/放開即可/);
    await page.screenshot({path:`${output}/${name}-tracing-endpoint.png`,fullPage:false});
    await move({x:second.at(-1).x,y:second.at(-1).y+20});await move(second.at(-1));
  }});
  assert.equal(await count(),2,await feedback().innerText());
  const third=await points(2),tip=third[20];
  const scale=await canvas().evaluate(svg=>Math.hypot(svg.getScreenCTM().a,svg.getScreenCTM().b));
  const outward=Array.from({length:6},(_,i)=>({x:tip.x+((i+1)*8)/scale,y:tip.y}));
  const excursion=[...outward,...outward.slice(0,-1).reverse(),tip];
  await gesture([...third.slice(0,21),...outward]);
  assert.equal(await count(),2);assert.match(await feedback().innerText(),/放開.*重畫/);
  await gesture([...third.slice(0,21),...excursion,...third.slice(21)]);
  assert.equal(await count(),3,await feedback().innerText());
  const fourth=await points(3),end=fourth.at(-1);
  const out=Array.from({length:15},(_,i)=>({x:end.x+(1250-end.x)*(i+1)/15,y:end.y}));
  await gesture([...fourth,...out,...out.slice().reverse(),end]);
  assert.equal(await count(),3);assert.match(await feedback().innerText(),/字框/);
  await gesture([...fourth,...Array.from({length:13},(_,i)=>({x:end.x+(1030-end.x)*(i+1)/13,y:end.y}))]);await page.waitForSelector('.guided-finish:visible');
  if(debug){
    const rows=await page.evaluate(()=>window.__writingDebug);
    assert.ok(rows.some(r=>r.event==='finish'&&r.result?.ok===false));
    assert.ok(rows.some(r=>r.metrics?.recovering));
    assert.ok(rows.some(r=>r.metrics?.frame&&r.client&&r.svgPoint&&r.metrics.sourcePoint));
    await pointerComfortQA(page,base,name,output);
    return rows;
  }
  await pointerComfortQA(page,base,name,output);
}

export async function pointerComfortQA(page,base,name,output){
  await page.locator('nav a[href="#alphabet"]').click();
  await page.locator('.language-tabs button').first().click();
  await page.getByRole('button',{name:/^ㅗ，/}).click();
  await page.getByRole('button',{name:'進入書寫練習',exact:true}).click();
  const canvas=page.locator('.writing:visible');
  for(let index=0;index<2;index++){
    await canvas.evaluate(svg=>svg.scrollIntoView({block:'center',behavior:'instant'}));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const points=await canvas.evaluate((svg,index)=>{
      const path=svg.querySelectorAll('.guide')[index],length=path.getTotalLength(),m=svg.getScreenCTM(),count=index===0?41:6;
      const source=Array.from({length:count},(_,i)=>{const p=path.getPointAtLength(length*i/(index===0?count-1:count));return {x:p.x+ (index===0?12:0),y:p.y+(index===1?12:0)};});
      const end=source.at(-1);source.push(index===0?{x:end.x,y:end.y+70}:{x:1050,y:end.y});
      return source.map(p=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}));
    },index);
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
    for(const p of points.slice(1)){await page.mouse.move(p.x,p.y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
    await page.waitForFunction(()=>[...document.querySelectorAll('.guided-letter .feedback')].find(el=>el.getBoundingClientRect().width)?.textContent.includes('放開即可'),null,{timeout:5000});
    assert.match(await page.locator('.guided-letter:visible .feedback').innerText(),/放開即可/);
    if(index===1)await page.screenshot({path:`${output}/${name}-o-comfort.png`});
    await page.mouse.up();
    await page.waitForFunction(n=>[...document.querySelectorAll('.writing')].find(s=>s.getBoundingClientRect().width)?.querySelectorAll('.completed-ink').length===n,index+1);
  }
  await page.waitForSelector('.guided-finish:visible');
}
