import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {svgPathProperties} from 'svg-path-properties';
import {createTracingStroke} from '../src/tracing-engine.mjs';
import {createGuidedStroke} from '../src/stroke-engine.mjs';
import {createBlockStroke} from '../src/block-tracing.mjs';
import {composeSyllable} from '../src/hangul-blocks.mjs';
const chars=JSON.parse(fs.readFileSync(new URL('../data/writing-index.json',import.meta.url))).characters;
export function screenOffsetStudy(){
 const rows=[];
 for(const side of [280,360,600])for(const offset of [0,20,30,35])for(const glyph of ['트','라','면','친','구','ㅇ','ㅌ','あ','の','き','ア','ホ']){
 const c=chars.find(c=>c.display===glyph)??composeSyllable(glyph,chars),paths=c.paths.map(d=>{const p=new svgPathProperties(d),l=p.getTotalLength();return Array.from({length:161},(_,i)=>p.getPointAtLength(l*i/160));});
 for(let i=0;i<paths.length;i++){
  const space={toScreen:p=>({x:p.x*side/1024,y:p.y*side/1024}),contains:()=>true};
  const create=screen=>c.strokeFrames?createBlockStroke(paths,i,c.strokeFrames[i],{},screen?space:{}):c.language==='ko'?createTracingStroke(paths,i,{},screen?space:{}):createGuidedStroke(paths[i],{},screen?space:{});
  const a=paths[i][0],b=paths[i][1],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
  const input=paths[i].map(p=>({x:p.x-dy/length*offset*1024/side,y:p.y+dx/length*offset*1024/side}));
  const row={side,offset,glyph,stroke:i};
  for(const screen of [false,true]){const t=create(screen);t.start(input[0]);input.slice(1).forEach(p=>t.add(p));row[screen?'after':'before']=t.finish();}
  rows.push(row);
 }
 }return rows;
}
test('504 fixed screen-offset representative gestures improve without hiding ambiguous starts',()=>{
 const rows=screenOffsetStudy(),failed=rows.filter(r=>!r.after.ok);
 assert.deepEqual(failed.map(r=>[r.side,r.offset,r.glyph,r.stroke]),[[280,35,'면',3]]);
 assert.ok(rows.filter(r=>r.after.ok).length>rows.filter(r=>r.before.ok).length);
 for(const offset of [0,20,30,35])console.log(JSON.stringify({offset,total:rows.filter(r=>r.offset===offset).length,before:rows.filter(r=>r.offset===offset&&r.before.ok).length,after:rows.filter(r=>r.offset===offset&&r.after.ok).length}));
});
