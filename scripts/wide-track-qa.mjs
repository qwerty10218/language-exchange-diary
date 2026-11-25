import assert from 'node:assert/strict';
// Actual mouse/Pointer Events through the public UI, distances in client CSS px.
export async function wideTrackQA(page,base,name,output){
 const open=async()=>{
  await page.goto(base+'#alphabet');await page.reload();
  await page.locator('.language-tabs button').first().click();
  await page.getByRole('button',{name:/^ㅗ，/}).click();
  await page.getByRole('button',{name:'進入書寫練習',exact:true}).click();
  await page.locator('.writing:visible').evaluate(svg=>svg.scrollIntoView({block:'center',behavior:'instant'}));
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 };
 const canvas=()=>page.locator('.writing:visible');
 const points=async(index=0)=>canvas().evaluate((svg,index)=>{
  const path=svg.querySelectorAll('.guide')[index],l=path.getTotalLength(),m=svg.getScreenCTM();
  return Array.from({length:65},(_,i)=>{const p=path.getPointAtLength(l*i/64);return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};});
 },index);
 const gesture=async(input,{cancel=false,shot=false}={})=>{
  await page.mouse.move(input[0].x,input[0].y);await page.mouse.down();
  for(const p of input.slice(1)){await page.mouse.move(p.x,p.y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
  if(shot)await page.screenshot({path:`${output}/${name}-wide-track-35px.png`,fullPage:false});
  if(cancel)await canvas().evaluate(svg=>svg.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
  await page.mouse.up();
  await page.waitForFunction(()=>{const el=[...document.querySelectorAll('.writing')].find(el=>el.getBoundingClientRect().width);return el&&!['drawing','validating'].includes(el.dataset.phase);});
 };
 for(const offset of [0,20,30,35]){
  await open();const input=(await points()).map(p=>({x:p.x+offset,y:p.y}));
  await gesture(input,{shot:offset===35});
  assert.equal(await canvas().locator('.completed-ink').count(),1,`${name}/${offset}px: ${await page.locator('.guided-letter:visible .feedback').innerText()}`);
 }
 await open();const first=await points();
 for(const [input,cancel] of [[[...first].reverse(),false],[[first[0],first.at(-1)],false],[first.slice(0,4),false],[await points(1),false],[first,true]]){
  await gesture(input,{cancel});assert.equal(await canvas().locator('.completed-ink').count(),0);
 }
 // A gentle bias returning toward the line still fills the standard stroke.
 await gesture(first.map((p,i)=>({x:p.x+30*Math.sin(Math.PI*i/64),y:p.y})));
 assert.equal(await canvas().locator('.completed-ink').count(),1);
 return {offsets:[0,20,30,35],positive:5,negativeRejected:5};
}
