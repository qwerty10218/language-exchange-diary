import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGuidedStroke, GUIDE_DEFAULTS } from '../src/stroke-engine.mjs';
import { points } from './path-samples.mjs';
const chars=JSON.parse(readFileSync(new URL('../data/phase0.strokes.json',import.meta.url),'utf8')).characters;
for(const c of chars)for(const [i,d]of c.paths.entries()){
  const path=points(d);
  test(`${c.display} ${i+1}：正確起拉即可補完，不必描完整筆`,()=>{
    const t=createGuidedStroke(path);t.start(path[0]);
    let n=1;for(;n<path.length;n++){t.add(path[n]);if(t.canAutoComplete())break;}
    assert.ok(n<path.length*.5,'trigger should occur in the first half');
    assert.ok(t.progress<.75,'does not require the old 75% completion');
    assert.equal(t.finishDirection().ok,true);assert.equal(t.phase,'accepted');
    const rawCount=t.rawPoints.length;
    // After release no new input is needed for the animation/next-stroke transition.
    t.add(path.at(-1));assert.equal(t.rawPoints.length,rawCount);
    t.afterAnimation(i===c.paths.length-1);
    assert.equal(t.phase,i===c.paths.length-1?'completed':'waiting');
  });
  test(`${c.display} ${i+1}：點擊、細小抖動及反向起拉不能補完`,()=>{
    const start=path[0],tip=path[Math.min(12,path.length-1)],len=Math.hypot(tip.x-start.x,tip.y-start.y),dx=(tip.x-start.x)/len,dy=(tip.y-start.y)/len;
    for(const input of [[start,start],[start,{x:start.x+2,y:start.y+2},start],[start,{x:start.x-dx*20,y:start.y-dy*20},{x:start.x-dx*50,y:start.y-dy*50}]]){
      const t=createGuidedStroke(path);t.start(input[0]);input.slice(1).forEach(p=>t.add(p));
      assert.equal(t.canAutoComplete(),false);assert.equal(t.finishDirection().ok,false);
    }
  });
}
test('只點遠處終點或先拉第二筆，不會自動完成第一筆',()=>{
  for(const c of chars){
    const path=points(c.paths[0]),wrong=points(c.paths[1]);
    for(const input of [[path[0],path.at(-1)],wrong.slice(0,25)]){
      const t=createGuidedStroke(path);t.start(input[0]);input.slice(1).forEach(p=>t.add(p));assert.equal(t.finishDirection().ok,false);
    }
  }
});
test('觸發前 pointercancel 不會補完；起拉距離集中管理',()=>{
  const path=points(chars[0].paths[0]),t=createGuidedStroke(path);t.start(path[0]);t.add(path[2]);t.cancel();
  assert.equal(t.finishDirection().ok,false);assert.equal(t.canAutoComplete(),false);
  assert.equal(GUIDE_DEFAULTS.autoTriggerDistance,.04);
});
