import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGuidedStroke, resample, screenToSvg, insideSquare, GUIDE_DEFAULTS } from '../src/stroke-engine.mjs';
import { points } from './path-samples.mjs';
const chars = JSON.parse(readFileSync(new URL('../data/phase0.strokes.json', import.meta.url), 'utf8')).characters;
const dense = path => resample(path, Math.ceil(path.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-path[i].x,p.y-path[i].y),0)/8)+1);
const trace = (expected, raw) => { const t=createGuidedStroke(expected); t.start(raw[0]); raw.slice(1).forEach(p=>t.add(p)); t.finish(); return t; };
for (const c of chars) {
  const paths=c.paths.map(points);
  for (const [i, path] of paths.entries()) {
    const raw=dense(path);
    test(`${c.display} 第${i+1}筆：正常、偏移、抖動通過，保留原始軌跡，顯示中心線`,()=>{
      for(const data of [raw, raw.map(p=>({x:p.x+22,y:p.y-18})),raw.map((p,n)=>({x:p.x+6*Math.sin(n*2),y:p.y+6*Math.cos(n*2)}))]) {
        const t=trace(path,data);
        assert.equal(t.result.ok,true,t.result.reason);
        assert.deepEqual(t.rawPoints,data);
        assert.ok(t.progress>=.85);
        assert.equal(t.phase,'accepted');t.afterAnimation(true);assert.equal(t.phase,'completed');
      }
      const offset=trace(path,raw.map(p=>({x:p.x+22,y:p.y-18})));
      assert.notDeepEqual(offset.snappedPoints[0],offset.rawPoints[0]);
    });
    test(`${c.display} 第${i+1}筆：反向、端點點擊、半筆、離框拒絕`,()=>{
      for(const data of [[...raw].reverse(),[raw[0],raw.at(-1)],raw.slice(0,Math.floor(raw.length*.45)),[...raw.slice(0,5),{x:-10,y:20},...raw.slice(5)]]) {
        const t=trace(path,data);assert.equal(t.result.ok,false);assert.equal(t.phase,'rejected');
      }
      assert.match(trace(path,[...raw].reverse()).result.reason,/方向/);
    });
  }
  test(`${c.display} 第二筆不能代替第一筆`,()=>assert.equal(trace(paths[0],dense(paths[1])).result.ok,false));
}
test('あ 自交叉不能從交點跳到後段；循序通過同一交點可以',()=>{
  const path=points(chars[1].paths[2]),raw=dense(path);
  assert.equal(trace(path,raw).result.ok,true);
  // Locate the two well-separated visits near the same geometric point.
  let pair=null;
  for(let i=10;i<raw.length*.6;i++)for(let j=i+Math.floor(raw.length*.2);j<raw.length-10;j++)
    if(Math.hypot(raw[i].x-raw[j].x,raw[i].y-raw[j].y)<25)pair=[i,j];
  assert.ok(pair,'fixture must have an actual crossing');
  const jump=trace(path,[...raw.slice(0,pair[0]),...raw.slice(pair[1])]);
  assert.equal(jump.result.ok,false);
});
test('只接近終點不完成；連續進度不可因終點接近而增加',()=>{
  const path=[{x:100,y:100},{x:800,y:100},{x:800,y:800},{x:120,y:120}];
  const t=trace(path,[{x:100,y:100},{x:105,y:105},{x:115,y:115},{x:120,y:120}]);
  assert.equal(t.result.ok,false);assert.ok(t.progress<.1);
});
test('cancel/lost capture/resize 使用同一取消流程，pointerup 不能完成',()=>{
  const path=points(chars[0].paths[0]),raw=dense(path);
  for(const reason of ['pointercancel','lostpointercapture','resize']){
    const t=createGuidedStroke(path);assert.equal(t.phase,'waiting');t.start(raw[0]);assert.equal(t.phase,'drawing');
    raw.slice(1).forEach(p=>t.add(p));t.cancel();t.add(raw.at(-1));
    assert.equal(t.finish().ok,false,reason);assert.equal(t.phase,'rejected');assert.deepEqual(t.snappedPoints,[]);
  }
});
test('接受動畫後才能進下一筆，重複 pointerup 不會重複完成',()=>{
  const path=points(chars[0].paths[0]),t=trace(path,dense(path));assert.equal(t.phase,'accepted');
  t.finish();assert.equal(t.phase,'accepted');t.afterAnimation();assert.equal(t.phase,'waiting');
});
test('CTM 反矩陣包含邊框、平移與等比例縮放；旋轉後重新取矩陣',()=>{
  let scale=2,tx=30,ty=50;
  const svg={getScreenCTM:()=>({inverse:()=>({scale,tx,ty})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(m){return{x:(this.x-m.tx)/m.scale,y:(this.y-m.ty)/m.scale}}})};
  assert.deepEqual(screenToSvg(svg,230,450),{x:100,y:200});scale=.5;tx=10;ty=20;
  assert.deepEqual(screenToSvg(svg,60,120),{x:100,y:200});
  assert.equal(screenToSvg({...svg,getScreenCTM:()=>null},1,1),null);
  assert.equal(insideSquare({x:1025,y:0}),false);
});
test('設定集中且可覆寫短筆參數，不更改全域初值',()=>{
  assert.equal(GUIDE_DEFAULTS.startRadius,.15);assert.equal(GUIDE_DEFAULTS.snapRadius,.13);
  assert.equal(GUIDE_DEFAULTS.maxDeviation,.20);assert.equal(GUIDE_DEFAULTS.completion,.75);assert.equal(GUIDE_DEFAULTS.closeRatio,.60);
  const path=points(chars[0].paths[1]);createGuidedStroke(path,{snapRadius:.04});assert.equal(GUIDE_DEFAULTS.snapRadius,.13);
});
test('較低事件頻率的真實拖曳仍可沿中心線前進',()=>{
  const path=points(chars[0].paths[0]);
  const raw=resample(path,11).map(p=>({x:p.x+26,y:p.y}));
  const t=trace(path,raw);assert.equal(t.result.ok,true,t.result.reason);
});
test('從正確起點寫到中段再明顯倒寫不能通過',()=>{
  const path=points(chars[0].paths[0]),raw=dense(path),half=Math.floor(raw.length/2);
  const backwards=[...raw.slice(0,half),...raw.slice(0,half).reverse(),...raw];
  assert.equal(trace(path,backwards).result.ok,false);
});
test('停留在20%以外不能完成，原始貼近率不足60%不能靠磁吸過關',()=>{
  const path=points(chars[0].paths[0]),raw=dense(path);
  const outside=raw.map((p,i)=>({x:p.x+Math.min(i*15,230),y:p.y}));
  assert.equal(trace(path,outside).result.ok,false);
  // Remain within max deviation but outside snap range for most of the motion.
  const poor=raw.flatMap(p=>[{x:p.x+125,y:p.y},{x:p.x+145,y:p.y},{x:p.x+125,y:p.y}]);
  const t=trace(path,poor);
  assert.equal(t.invalid,'');assert.ok(t.progress>=.85);
  assert.ok(t.closeTravel/t.rawTravel<.60);assert.equal(t.result.ok,false);
  assert.match(t.result.reason,/多沿著/);
});
