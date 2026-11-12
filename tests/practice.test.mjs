import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGuidedStroke, resample } from '../src/stroke-engine.mjs';
import { points } from './path-samples.mjs';
const chars=JSON.parse(readFileSync(new URL('../data/phase0.strokes.json',import.meta.url),'utf8')).characters;
const run=(expected,raw)=>{const t=createGuidedStroke(expected);t.start(raw[0]);raw.slice(1).forEach(p=>t.add(p));t.finish();return t;};
for(const c of chars)for(const [i,d]of c.paths.entries()){
  const path=points(d),raw=resample(path,Math.max(40,Math.ceil(path.length/2)));
  test(`${c.display} ${i+1}：較大偏移、抖動及停頓仍通過`,()=>{
    for(const input of [raw.map(p=>({x:p.x+70,y:p.y+30})),raw.flatMap((p,n)=>Array(3).fill({x:p.x+18*Math.sin(n),y:p.y+18*Math.cos(n)}))]){
      const t=run(path,input);assert.equal(t.result.ok,true,t.result.reason);
    }
  });
  test(`${c.display} ${i+1}：離開13%磁吸半徑再回來，進度暫停後可繼續`,()=>{
    const t=createGuidedStroke(path),mid=Math.floor(raw.length*.4);t.start(raw[0]);raw.slice(1,mid+1).forEach(p=>t.add(p));
    const p=raw[mid],next=raw[mid+1],len=Math.hypot(next.x-p.x,next.y-p.y),normal={x:-(next.y-p.y)/len,y:(next.x-p.x)/len};
    for(const offset of [40,80,120,160])t.add({x:p.x+normal.x*offset,y:p.y+normal.y*offset});
    assert.equal(t.recovering,true);const frozen=t.progress;
    t.add({x:p.x+normal.x*165,y:p.y+normal.y*165});assert.equal(t.progress,frozen);
    for(const offset of [120,80,40,0])t.add({x:p.x+normal.x*offset,y:p.y+normal.y*offset});
    assert.equal(t.recovering,false);assert.equal(t.invalid,'');
    raw.slice(mid+1).forEach(p=>t.add(p));assert.equal(t.finish().ok,true,t.result.reason);
  });
}
test('偏離後不能把遠處後段當作回線位置',()=>{
  const path=[{x:300,y:100},{x:300,y:900}],t=createGuidedStroke(path);t.start(path[0]);
  for(let y=120;y<=300;y+=20)t.add({x:300,y});
  for(let x=340;x<=460;x+=40)t.add({x,y:300});assert.equal(t.recovering,true);
  const frozen=t.progress;
  for(let y=320;y<=750;y+=20)t.add({x:460,y});
  for(let x=420;x>=300;x-=40)t.add({x,y:750});
  assert.equal(t.recovering,true);assert.equal(t.progress,frozen);
  for(let y=770;y<=900;y+=20)t.add({x:300,y});assert.equal(t.finish().ok,false);
});
test('短筆的倒寫與只碰頭尾仍被拒絕',()=>{
  const path=points(chars[0].paths[1]);
  assert.equal(run(path,[...resample(path,40)].reverse()).result.ok,false);
  assert.equal(run(path,[path[0],path.at(-1)]).result.ok,false);
  assert.equal(run(path,resample(path,40).slice(0,20)).result.ok,false);
});
test('短暫離線時仍向前移動，回到附近引導線也能繼續',()=>{
  const path=[{x:300,y:100},{x:300,y:900}],t=createGuidedStroke(path);t.start(path[0]);
  for(let y=110;y<=250;y+=10)t.add({x:300,y});
  for(let x=340;x<=460;x+=40)t.add({x,y:250});
  assert.equal(t.recovering,true);const frozen=t.progress;
  for(let y=260;y<=320;y+=10)t.add({x:460,y});assert.equal(t.progress,frozen);
  for(let x=420;x>=300;x-=40)t.add({x,y:320});assert.equal(t.recovering,false);
  for(let y=330;y<=900;y+=10)t.add({x:300,y});assert.equal(t.finish().ok,true,t.result.reason);
});
