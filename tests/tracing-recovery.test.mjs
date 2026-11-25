import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {svgPathProperties} from 'svg-path-properties';
import {composeSyllable,transformPoint,inversePoint} from '../src/hangul-blocks.mjs';
import {createBlockStroke} from '../src/block-tracing.mjs';
import {createTracingStroke,tracingOptions} from '../src/tracing-engine.mjs';
import {recordWritingDiagnostic} from '../src/writing-diagnostics.mjs';

const characters=JSON.parse(fs.readFileSync(new URL('../data/writing-index.json',import.meta.url))).characters;
const line=Array.from({length:161},(_,i)=>({x:100+i*5,y:400}));
test('visible block bounds, not the inverse source square, govern touch containment',()=>{
  const frame={sx:.3,sy:.3,tx:200,ty:200};
  const source=line.map(p=>({x:p.x-100,y:p.y}));
  const strokes=[source.map(p=>transformPoint(p,frame))];
  const trace=createBlockStroke(strokes,0,frame,{});
  const input=source.map(p=>transformPoint({x:p.x-20,y:p.y},frame));
  trace.start(input[0]);input.slice(1).forEach(p=>trace.add(p));
  assert.equal(trace.finish().ok,true,trace.invalid);
  const outside=createBlockStroke(strokes,0,frame,{});
  outside.start(strokes[0][0]);outside.add({x:-1,y:320});
  assert.equal(outside.finish().ok,false);
});

test('real 가 / 감 vowel strokes may cross source bounds while remaining on the canvas',()=>{
  for(const [glyph,dy] of [['가',120],['감',-120]]){
    const block=composeSyllable(glyph,characters),frame=block.strokeFrames[1];
    const strokes=block.paths.map(d=>{const p=new svgPathProperties(d),l=p.getTotalLength();return Array.from({length:201},(_,i)=>p.getPointAtLength(l*i/200));});
    const source=strokes[1].map(p=>{const q=inversePoint(p,frame);return {x:q.x,y:q.y+dy};});
    const input=source.map(p=>transformPoint(p,frame));
    assert.ok(source.some(p=>p.y<0||p.y>1024));assert.ok(input.every(p=>p.x>=0&&p.y>=0&&p.x<=1024&&p.y<=1024));
    const t=createBlockStroke(strokes,1,frame,tracingOptions(characters.find(c=>c.id===frame.sourceId),frame.sourceIndex));
    t.start(input[0]);input.slice(1).forEach(p=>t.add(p));assert.equal(t.finish().ok,true,t.result?.reason);
  }
});

test('off-line return never masquerades as reversal or buys progress',()=>{
  const trace=createTracingStroke([line],0);trace.start(line[0]);
  line.slice(1,65).forEach(p=>trace.add(p));
  const frozen=trace.progress;
  // Leave normal to the line, drift ahead while off-line, then return to ink tip.
  for(const p of [{x:420,y:480},{x:420,y:550},{x:470,y:550},{x:520,y:550},{x:470,y:550},{x:420,y:550},{x:420,y:480},{x:420,y:400}])trace.add(p);
  assert.equal(trace.invalid,'');
  assert.equal(trace.recovering,false);
  assert.equal(trace.progress,frozen);
  line.slice(65).forEach(p=>trace.add(p));
  assert.equal(trace.finish().ok,true,trace.result.reason);
});

test('returning exactly to frozen ink clears recovery even without forward motion',()=>{
  const trace=createTracingStroke([line],0);trace.start(line[0]);line.slice(1,65).forEach(p=>trace.add(p));
  for(const y of [480,550,480,400])trace.add({x:420,y});
  assert.equal(trace.recovering,false);
});

test('recovery cannot skip the middle or excuse subsequent backwards writing',()=>{
  for(const shortcut of [false,true]){
    const trace=createTracingStroke([line],0);trace.start(line[0]);line.slice(1,65).forEach(p=>trace.add(p));
    for(const y of [480,550,480,400])trace.add({x:420,y});
    const input=shortcut?line.slice(130):line.slice(45,64).reverse();
    input.forEach(p=>trace.add(p));
    assert.equal(trace.finish().ok,false);
    assert.match(trace.result.reason,shortcut?/不連續|未完成/:/方向/);
  }
});

test('release off-line asks for a new stroke, not an impossible mid-gesture return',()=>{
  const t=createTracingStroke([line],0);t.start(line[0]);line.slice(1,65).forEach(p=>t.add(p));
  t.add({x:420,y:480});t.add({x:420,y:550});
  assert.equal(t.recovering,true);const result=t.finish();
  assert.equal(result.ok,false);assert.match(result.reason,/放開.*重畫/);
  assert.equal(t.diagnostics.reason,result.reason);
});

test('100% ink does not promise release success when the endpoint is still offset',()=>{
  const trace=createTracingStroke([line],0);trace.start(line[0]);
  line.slice(1).forEach((p,i)=>trace.add({x:p.x,y:p.y+100*i/159}));
  assert.equal(trace.progress,1);assert.equal(trace.endpoint.ready,false);
  assert.match(trace.diagnostics.reason,/終點/);
  assert.ok(trace.diagnostics.endDistance>trace.diagnostics.endpointLimit);
  // Normal-to-line correction, not backtracking, reaches the original endpoint.
  trace.add({x:900,y:450});trace.add({x:900,y:400});
  assert.equal(trace.endpoint.ready,true);assert.equal(trace.finish().ok,true);
});

test('developer samples are bounded, retain coordinate transforms and never persist',()=>{
  const target={},svg={getBoundingClientRect:()=>({x:10,y:20,width:300,height:300}),getScreenCTM:()=>({a:.3,b:0,c:0,d:.3,e:10,f:20})};
  for(let i=0;i<1005;i++)recordWritingDiagnostic(target,'pointermove',svg,{client:{x:i,y:20},svgPoint:{x:100,y:200}});
  assert.equal(target.__writingDebug.length,1000);
  assert.equal(target.__writingDebug[0].client.x,5);
  assert.equal(target.__writingDebug.at(-1).svgMatrix.a,.3);
});

for(const glyph of ['트','라','면','우','동','값','괜'])test(`${glyph}: offset, wrong stroke, reverse, short, outside and cancel remain strict`,()=>{
  const block=composeSyllable(glyph,characters);
  const strokes=block.paths.map(d=>{const p=new svgPathProperties(d),l=p.getTotalLength();return Array.from({length:201},(_,i)=>p.getPointAtLength(l*i/200));});
  for(let i=0;i<strokes.length;i++){
    const frame=block.strokeFrames[i],options=tracingOptions(characters.find(c=>c.id===frame.sourceId),frame.sourceIndex);
    const run=input=>{const t=createBlockStroke(strokes,i,frame,options);t.start(input[0]);input.slice(1).forEach(p=>t.add(p));return t;};
    for(const offset of [0,12,-12])assert.equal(run(strokes[i].map(p=>({x:p.x+offset,y:p.y+offset}))).finish().ok,true,`${glyph} ${i}`);
    for(const input of [[...strokes[i]].reverse(),strokes[i].slice(0,4),strokes[(i+1)%strokes.length],[...strokes[i],{x:1100,y:748}]])assert.equal(run(input).finish().ok,false);
    const t=run(strokes[i]);t.cancel();assert.equal(t.finish().ok,false);
  }
});
