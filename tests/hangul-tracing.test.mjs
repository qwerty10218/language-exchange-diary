import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTracingStroke,tracingOptions,HANGUL_SETTINGS,validateTracingSettings} from '../src/tracing-engine.mjs';
import {samplePath} from '../scripts/writing-qa.mjs';
const index=JSON.parse(fs.readFileSync(new URL('../data/writing-index.json',import.meta.url),'utf8'));
const hangul=index.characters.filter(c=>c.language==='ko');
const expectedCounts=[1,2,1,2,4,3,3,4,8,2,4,1,2,4,3,2,3,4,3,2,3,2,3,2,3,2,3,1,1,3,4,3,4,4,5,3,4,5,3,2];
const simulate=(samples,index,input,options={})=>{const trace=createTracingStroke(samples,index,options);trace.start(input[0]);for(const point of input.slice(1))trace.add(point);return trace;};
test('40 音依原規格完整，沒有以一筆取代多筆或宣稱人工驗證',()=>{
  assert.equal(hangul.length,40);assert.deepEqual(hangul.map(c=>c.strokeCount),expectedCounts);
  assert.ok(hangul.every(c=>c.technicalStatus==='passed'&&c.humanStatus==='pending'));
  assert.ok(fs.readFileSync(new URL('../public/strokes/hangul/CC-BY-4.0.txt',import.meta.url),'utf8').includes('Attribution 4.0 International'));
});
for(const c of hangul) {
  const samples=c.paths.map(samplePath);
  test(`${c.display}：每筆標準、抖動、偏移與停頓均可完成；完成後重啟乾淨`,()=>{
    for(let i=0;i<samples.length;i++) {
      const options=tracingOptions(c,i);
      for(const variant of [samples[i],samples[i].map((p,n)=>({x:p.x+18+Math.sin(n)*4,y:p.y+12+Math.cos(n)*4}))]) {
        const trace=simulate(samples,i,variant,options);
        assert.equal(trace.finish().ok,true,`${c.display} ${i+1} ${trace.result.reason}`);
        assert.ok(trace.progress>=options.completion);trace.afterAnimation(i===samples.length-1);
        assert.equal(trace.phase,i===samples.length-1?'completed':'waiting');
      }
      const stopped=[];for(const p of samples[i])stopped.push(p,p,p);
      assert.equal(simulate(samples,i,stopped,options).finish().ok,true);
      const fresh=createTracingStroke(samples,i,options);assert.equal(fresh.phase,'waiting');assert.equal(fresh.progress,0);assert.deepEqual(fresh.rawPoints,[]);assert.deepEqual(fresh.snappedPoints,[]);
    }
  });
  test(`${c.display}：倒寫、錯序、半筆、跳段、超框、取消均不接受`,()=>{
    for(let i=0;i<samples.length;i++) {
      const ps=samples[i],options=tracingOptions(c,i);
      assert.equal(simulate(samples,i,[...ps].reverse(),options).finish().ok,false,`${c.display} reversed ${i}`);
      for(let j=0;j<samples.length;j++)if(i!==j)assert.equal(simulate(samples,i,samples[j],options).finish().ok,false,`${c.display} wrong ${j}->${i}`);
      assert.equal(simulate(samples,i,ps.slice(0,Math.floor(ps.length*.5)),options).finish().ok,false);
      const skipped=[ps[0],ps[1],...ps.slice(Math.floor(ps.length*.85))];assert.equal(simulate(samples,i,skipped,options).finish().ok,false);
      const out=simulate(samples,i,[ps[0],{x:-10,y:ps[0].y}],options);assert.equal(out.finish().ok,false);
      const cancelled=simulate(samples,i,ps.slice(0,Math.floor(ps.length*.4)),options);cancelled.cancel();assert.equal(cancelled.finish().ok,false);assert.equal(cancelled.canAutoComplete(),false);
      assert.equal(cancelled.phase,'rejected');
    }
  });
}
test('短暫離開磁吸距離後可在附近回線繼續，不會永久卡住',()=>{
  const line=Array.from({length:161},(_,i)=>({x:100+i*5,y:400}));
  const trace=createTracingStroke([line],0);trace.start(line[0]);
  for(const p of line.slice(1,65))trace.add(p);
  trace.add({x:420,y:480});trace.add({x:420,y:550});assert.equal(trace.recovering,true);
  trace.add({x:450,y:480});trace.add({x:460,y:400});
  for(const p of line.slice(73))trace.add(p);
  assert.equal(trace.recovering,false);assert.equal(trace.finish().ok,true,trace.result.reason);
});
test('圓圈終點等於起點也不能靠點兩端完成，逆向圓圈確實拒絕',()=>{
  const c=hangul.find(c=>c.display==='ㅇ'),samples=c.paths.map(samplePath),ps=samples[0];
  const dots=simulate(samples,0,[ps[0],ps[0],ps.at(-1),ps.at(-1)]);assert.equal(dots.finish().ok,false);
  const reverse=simulate(samples,0,[...ps].reverse());assert.match(reverse.finish().reason,/方向/);
});
test('沿線模式不使用先前4%短拉完成，全域設定嚴格且無字元覆寫',()=>{
  const c=hangul.find(c=>c.display==='ㅏ'),samples=c.paths.map(samplePath);
  const trace=simulate(samples,0,samples[0].slice(0,30));assert.equal(trace.canAutoComplete(),false);
  assert.equal(HANGUL_SETTINGS.strictOrder,true);assert.equal(HANGUL_SETTINGS.rejectBackwards,true);assert.deepEqual(HANGUL_SETTINGS.overrides,{});
  assert.deepEqual(validateTracingSettings(),[]);
  assert.ok(validateTracingSettings({...HANGUL_SETTINGS,rejectBackwards:false}).length);
  assert.ok(validateTracingSettings({...HANGUL_SETTINGS,completion:.2}).length);
});
test('代表字的轉折、圓形與多筆結構：中段倒退會被拒絕',()=>{
  for(const glyph of ['ㅏ','ㄱ','ㅁ','ㄹ','ㅇ','ㅆ','ㅘ','ㅙ','ㅢ','ㅎ']) {
    const c=hangul.find(c=>c.display===glyph),samples=c.paths.map(samplePath),ps=samples.at(-1),middle=Math.floor(ps.length*.6);
    const trace=simulate(samples,samples.length-1,[...ps.slice(0,middle),...ps.slice(0,middle).reverse()],tracingOptions(c,samples.length-1));
    assert.equal(trace.finish().ok,false,glyph);assert.match(trace.result.reason,/方向/,glyph);
  }
});
