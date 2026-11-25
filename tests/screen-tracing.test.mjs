import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {svgPathProperties} from 'svg-path-properties';
import {createTracingStroke,tracingOptions} from '../src/tracing-engine.mjs';
import {createGuidedStroke} from '../src/stroke-engine.mjs';
import {createBlockStroke} from '../src/block-tracing.mjs';
import {composeSyllable} from '../src/hangul-blocks.mjs';
const characters=JSON.parse(fs.readFileSync(new URL('../data/writing-index.json',import.meta.url))).characters;
const space=side=>({toScreen:p=>({x:p.x*side/1024,y:p.y*side/1024}),contains:p=>p.x>=-100&&p.x<=1124&&p.y>=-100&&p.y<=1124});
const points=d=>{const path=new svgPathProperties(d),length=path.getTotalLength();return Array.from({length:161},(_,i)=>path.getPointAtLength(length*i/160));};
function run(trace,input){trace.start(input[0]);input.slice(1).forEach(p=>trace.add(p));return trace.finish();}
for(const side of [280,360,600])for(const offset of [0,20,30,35])test(`CSS corridor ${side}px canvas / ${offset}px transverse offset`,()=>{
 const line=Array.from({length:81},(_,i)=>({x:180+i*8,y:500}));
 const input=line.map(p=>({...p,y:p.y+offset*1024/side}));
 for(const factory of [()=>createTracingStroke([line],0,{},space(side)),()=>createGuidedStroke(line,{},space(side))]){const result=run(factory(),input);assert.equal(result.ok,true,result.reason);}
});
for(const glyph of ['트','라','면','친','구','ㅇ','ㅌ','あ','の','き','ア','ホ'])test(`screen-space exact representative ${glyph}`,()=>{
 const character=characters.find(c=>c.display===glyph)??composeSyllable(glyph,characters),strokes=character.paths.map(points);
 for(let i=0;i<strokes.length;i++){
  const trace=character.strokeFrames?createBlockStroke(strokes,i,character.strokeFrames[i],{},space(300)):character.language==='ko'?createTracingStroke(strokes,i,{},space(300)):createGuidedStroke(strokes[i],{},space(300));
  const result=run(trace,strokes[i]);assert.equal(result.ok,true,`${glyph}/${i}: ${result.reason}`);
 }
});
test('wide corridor rejects reversed, teleported, stationary and wrong-order gestures',()=>{
 const line=Array.from({length:81},(_,i)=>({x:180+i*8,y:400})),other=line.map(p=>({...p,y:650}));
 for(const input of [[...line].reverse(),[line[0],line.at(-1)],Array.from({length:80},(_,i)=>({x:180+i%2*10,y:400+i%3*10})),other])assert.equal(run(createTracingStroke([line,other],0,{},space(300)),input).ok,false);
});
test('excursion freezes progress and permits returning without restarting',()=>{
 const line=Array.from({length:81},(_,i)=>({x:180+i*8,y:500})),trace=createTracingStroke([line],0,{},space(300));
 trace.start(line[0]);line.slice(1,41).forEach(p=>trace.add(p));const progress=trace.progress;
 for(let i=1;i<=25;i++)trace.add({x:500,y:500+i*6});
 assert.equal(trace.recovering,true);assert.equal(trace.progress,progress);
 for(let i=24;i>=0;i--)trace.add({x:500,y:500+i*6});
 line.slice(41).forEach(p=>trace.add(p));assert.equal(trace.finish().ok,true,trace.result.reason);
});

test('all 129 technically available characters trace in screen space; cancel cannot pass',()=>{
 for(const c of characters.filter(c=>c.technicalStatus==='passed')){
  const paths=c.paths.map(points);
  for(let i=0;i<paths.length;i++){
   const t=c.language==='ko'?createTracingStroke(paths,i,{},space(300)):createGuidedStroke(paths[i],{}, {...space(300),strokes:paths,index:i});
   const result=run(t,paths[i]);assert.equal(result.ok,true,`${c.display}/${i}:${result.reason}`);
  }
 }
 const t=createTracingStroke([[{x:100,y:400},{x:900,y:400}]],0,{},space(300));t.start({x:100,y:400});t.cancel();assert.equal(t.result.ok,false);
});
test('CTM rotation, zoom and anisotropic block frames keep CSS-pixel offsets',()=>{
 const frame={sx:.2,sy:.8,tx:300,ty:50};
 const raw=Array.from({length:81},(_,i)=>({x:300+i,y:500}));
 for(const zoom of [.3,.6]){
  const s={contains:()=>true,toScreen:p=>({x:-zoom*p.y+800,y:zoom*p.x+20})};
  const input=raw.map(p=>({x:p.x,y:p.y+30/zoom}));
  const trace=createBlockStroke([raw],0,frame,{},s);assert.equal(run(trace,input).ok,true);
 }
});
test('local route tracking rejects a chord skipping a turn and repeated endpoint taps',()=>{
 const turn=[...Array.from({length:41},(_,i)=>({x:100+i*10,y:300})),...Array.from({length:40},(_,i)=>({x:500,y:310+i*10}))];
 const diagonal=Array.from({length:81},(_,i)=>({x:100+i*5,y:300+i*5}));
 assert.equal(run(createTracingStroke([turn],0,{},space(300)),diagonal).ok,false);
 const taps=[...Array.from({length:10},()=>turn[0]),turn.at(-1)];assert.equal(run(createTracingStroke([turn],0,{},space(300)),taps).ok,false);
});

test('before/after negative acceptance study: reverse, jump, wrong-order, scribble and short pulls',()=>{
 let total=0,before=0,after=0;
 for(const side of [280,360,600])for(const offset of [0,20,30,35]){
  const line=Array.from({length:81},(_,i)=>({x:180+i*8,y:400})),other=line.map(p=>({...p,y:700}));
  const bias=input=>input.map(p=>({...p,y:p.y+offset*1024/side}));
  const inputs=[[...line].reverse(),[line[0],line.at(-1)],other,line.slice(0,4),Array.from({length:80},(_,i)=>({x:180+(i%2)*10,y:400+(i%3)*10}))];
  for(const input of inputs){total++;before+=+run(createTracingStroke([line,other],0),bias(input)).ok;after+=+run(createTracingStroke([line,other],0,{},space(side)),bias(input)).ok;}
 }
 console.log(JSON.stringify({negativeStudy:{total,beforeAccepted:before,afterAccepted:after}}));assert.equal(before,0);assert.equal(after,0);
});

test('fresh sparse straight samples bridge safely but do not invent real observations',()=>{
 const line=Array.from({length:81},(_,i)=>({x:100+i*10,y:500}));
 const input=Array.from({length:7},(_,i)=>({x:100+i*800/6,y:500,time:i*16}));
 const trace=createTracingStroke([line],0,{},space(500));assert.equal(run(trace,input).ok,true,trace.result.reason);
 assert.equal(trace.observed,7);assert.ok(trace.bridgedSamples>0);
 const jump=createTracingStroke([line],0,{},space(500));assert.equal(run(jump,[input[0],input.at(-1)]).ok,false);
});

test('endpoint overshoot stays forward and bounded at phone and desktop scales',()=>{
 const line=Array.from({length:81},(_,i)=>({x:130+i*9.3,y:500}));
 for(const side of [330,620]){
  const input=Array.from({length:6},(_,i)=>({x:130+i*744/6,y:512,time:i*16}));input.push({x:1050,y:512,time:96});
  const trace=createTracingStroke([line],0,{},space(side));assert.equal(run(trace,input).ok,true,trace.result.reason);
 }
});

test('changing start bias never turns a valid 30px corridor into a false excursion',()=>{
 const line=Array.from({length:81},(_,i)=>({x:100,y:100+300*i/80}));
 const input=line.map((p,i)=>({x:p.x+15-45*i/80,y:p.y+25*(1-i/80),time:i*16}));
 const t=createTracingStroke([line],0,{}, {toScreen:p=>p,contains:()=>true});
 assert.equal(run(t,input).ok,true,t.result.reason);
 assert.equal(t.recovering,false);
});
test('rejoining the corridor resumes valid progress on the same pointer sample',()=>{
 const line=Array.from({length:81},(_,i)=>({x:100+i*4,y:100}));
 const t=createTracingStroke([line],0,{}, {toScreen:p=>p,contains:()=>true});t.start(line[0]);line.slice(1,41).forEach(p=>t.add(p));
 for(let y=105;y<=145;y+=5)t.add({x:260,y});
 assert.equal(t.recovering,true);const before=t.progress;
 for(let y=140;y>135;y-=5)t.add({x:260,y});
 t.add({x:264,y:134});assert.equal(t.recovering,false);assert.ok(t.progress>before);
});

test('variable lateral drift stays continuous on turns, circles and crossing kana',()=>{
 for(const glyph of ['ㄴ','ㅌ','ㅇ','の','あ','트','라','면','친','구']){
 const c=characters.find(c=>c.display===glyph)??composeSyllable(glyph,characters),paths=c.paths.map(points),side=330;
 for(let i=0;i<paths.length;i++){
  const a=paths[i][0],b=paths[i][1],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;
  const input=paths[i].map((p,j)=>{const bias=20*Math.cos(Math.PI*j/(paths[i].length-1));return {x:p.x-dy/l*bias*1024/side,y:p.y+dx/l*bias*1024/side,time:j*16};});
  const t=c.strokeFrames?createBlockStroke(paths,i,c.strokeFrames[i],{},space(side)):c.language==='ko'?createTracingStroke(paths,i,{},space(side)):createGuidedStroke(paths[i],{},space(side));
  const result=run(t,input);assert.equal(result.ok,true,`${glyph}/${i}:${result.reason}`);
 }
 }
});

test('adaptive tracking never widens the lateral corridor after reaching an endpoint',()=>{
 const line=Array.from({length:81},(_,i)=>({x:100+i*4,y:100}));
 const t=createTracingStroke([line],0,{}, {toScreen:p=>p,contains:()=>true});t.start(line[0]);line.slice(1).forEach(p=>t.add(p));
 for(let y=105;y<=160;y+=5)t.add({x:420,y});assert.equal(t.finish().ok,false);
});
test('release hint uses the same full criteria as finish, including real sample count',()=>{
 const line=Array.from({length:81},(_,i)=>({x:100+i*3,y:100}));
 const t=createTracingStroke([line],0,{}, {toScreen:p=>p,contains:()=>true});
 t.start({x:100,y:100,time:0});t.add({x:220,y:100,time:16});t.add({x:340,y:100,time:32});
 assert.ok(t.progress>=.85);assert.equal(t.readyToRelease,false);assert.equal(t.finish().ok,false);
 const normal=createTracingStroke([line],0,{}, {toScreen:p=>p,contains:()=>true});normal.start(line[0]);line.slice(1).forEach(p=>normal.add(p));assert.equal(normal.readyToRelease,true);assert.equal(normal.finish().ok,true);
});

test('rounding ㄴ with changing longitudinal bias cannot freeze before its corner',()=>{
 const c=characters.find(c=>c.display==='ㄴ'),path=points(c.paths[0]),s=space(330),a=path[0],b=path[1],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),t=createTracingStroke([path],0,{},s);
 const raw=path.map((p,i)=>{const normal=20*Math.cos(Math.PI*i/160),along=20*(1-i/160);return{x:p.x+(-dy*normal+dx*along)/l*1024/330,y:p.y+(dx*normal+dy*along)/l*1024/330};});
 t.start(raw[0]);let prior=0,stalled=0,maxStalled=0;
 for(const p of raw.slice(1)){t.add(p);if(t.progress>prior+1e-6)stalled=0;else if(t.progress<.9)maxStalled=Math.max(maxStalled,++stalled);prior=t.progress;}
 assert.ok(maxStalled<=10,`${maxStalled} frozen samples`);assert.equal(t.finish().ok,true,t.result.reason);
});

test('fast desktop mouse drag with 10px offset and same-frame coalesced timestamps stays continuous',()=>{
 const line=Array.from({length:81},(_,i)=>({x:100+i*10,y:500}));
 // Simulate fast desktop mouse (jumps with slight wobble + coalesced elapsed=0 sample)
 const input=[
  {x:100,y:512,time:100},
  {x:220,y:516,time:116},
  {x:360,y:508,time:116},
  {x:520,y:514,time:132},
  {x:700,y:510,time:148},
  {x:900,y:512,time:164},
 ];
 const trace=createTracingStroke([line],0,{},space(500));
 const result=run(trace,input);
 assert.equal(result.ok,true,result.reason);
});
