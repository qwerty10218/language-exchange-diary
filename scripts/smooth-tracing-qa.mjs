import assert from 'node:assert/strict';
// Browser Pointer Events with changing CSS-pixel bias; every point remains a real move.
export async function smoothTracingQA(page,base,name,output){
 const results=[];
 for(const glyph of ['ㄴ','ㅌ','ㅒ','ㅇ']){
  await page.goto(base+'#alphabet');await page.reload();await page.locator('.language-tabs button').first().click();
  await page.getByRole('button',{name:new RegExp(`^${glyph}，`)}).click();await page.getByRole('button',{name:'進入書寫練習',exact:true}).click();
  const svg=page.locator('.writing:visible');await svg.waitFor({state:'visible'});const count=await svg.locator('.guide').count();assert.ok(count>0,`${glyph}: writing paths must be mounted`);
  for(let index=0;index<count;index++){
   await svg.evaluate(svg=>svg.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const input=await svg.evaluate((svg,index)=>{
    const path=svg.querySelectorAll('.guide')[index],l=path.getTotalLength(),m=svg.getScreenCTM(),a=path.getPointAtLength(0),b=path.getPointAtLength(4),dx=b.x-a.x,dy=b.y-a.y,span=Math.hypot(dx,dy),scale=Math.hypot(m.a,m.b);
    return Array.from({length:65},(_,i)=>{const p=path.getPointAtLength(l*i/64),normal=20*Math.cos(Math.PI*i/64),along=Math.min(20,l*scale*.08)*(1-i/64);return{x:m.a*p.x+m.c*p.y+m.e+(-dy*normal+dx*along)/span,y:m.b*p.x+m.d*p.y+m.f+(dx*normal+dy*along)/span};});
   },index);
   await page.mouse.move(input[0].x,input[0].y);await page.mouse.down();let prior=0,painted=0,headSeen=false,stalled=0,maxStalled=0;
   for(let j=1;j<input.length;j++){
    await page.mouse.move(input[j].x,input[j].y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const state=await svg.evaluate(svg=>({progress:1-Number(svg.querySelector('.live-ink').getAttribute('stroke-dashoffset')),head:!!svg.querySelector('.writing-head'),hint:svg.parentElement.querySelector('.feedback').textContent}));
    assert.ok(state.progress>=prior-1e-6);if(state.progress>prior+1e-5){painted++;stalled=0;}else if(state.progress<.9){stalled++;maxStalled=Math.max(maxStalled,stalled);}
    prior=state.progress;headSeen||=state.head;
    if(glyph==='ㄴ'&&j===34){
      const styles=await svg.evaluate(svg=>{const ink=svg.querySelector('.live-ink'),route=svg.querySelector('.active-route'),guide=svg.querySelector('.guide'),demo=[...svg.children].flatMap(e=>[...e.children]).find(e=>e.classList.contains('demo'));return{inkWidth:parseFloat(getComputedStyle(ink).strokeWidth)*Math.hypot(svg.getScreenCTM().a,svg.getScreenCTM().b),vectorEffect:getComputedStyle(ink).vectorEffect,routeWidth:getComputedStyle(route).strokeWidth,guideOpacity:getComputedStyle(guide).opacity,inkColor:getComputedStyle(ink).stroke};});
      assert.ok(Math.abs(styles.inkWidth-8)<.01);assert.equal(styles.vectorEffect,'none');assert.equal(styles.routeWidth,'3px');assert.equal(styles.guideOpacity,'0.22');
      const probe=await svg.evaluate(svg=>{const p=svg.querySelector('.guide'),q=p.getPointAtLength(p.getTotalLength()*.9),m=svg.getScreenCTM();return{x:m.a*q.x+m.c*q.y+m.e,y:m.b*q.x+m.d*q.y+m.f,focus:getComputedStyle(svg.querySelector('.live-ink')).stroke};});
      results.push({probe});
      await page.screenshot({path:`${output}/${name}-smooth-live.png`});
    }
   }
   assert.ok(headSeen);assert.ok(painted>=35,`${glyph}/${index}: only ${painted} painted frames`);assert.ok(maxStalled<=10,`${glyph}/${index}: ${maxStalled} stalled frames`);
   await page.mouse.up();await page.waitForFunction(index=>{const svg=[...document.querySelectorAll('.writing')].find(e=>e.getBoundingClientRect().width);return svg?.querySelectorAll('.completed-ink').length===index+1;},index,{timeout:5000});
   assert.equal(await svg.locator('.writing-head').count(),0,'No stale animation frame after release');
   results.push({glyph,index,painted,maxStalled});
  }
 }
 assert.equal(results.filter(r=>r.glyph).length,9);
 return results;
}
