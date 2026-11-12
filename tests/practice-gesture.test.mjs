import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGuidedStroke} from '../src/stroke-engine.mjs';
import {createTracingStroke,tracingOptions} from '../src/tracing-engine.mjs';
import {strokeOptions} from '../src/writing-config.mjs';
import {samplePath} from '../scripts/writing-qa.mjs';
const characters=JSON.parse(fs.readFileSync(new URL('../data/writing-index.json',import.meta.url))).characters.filter(c=>c.technicalStatus==='passed');
for(const c of characters) {
  test(`${c.display}：目前頁面逐筆判定拒絕點擊、抖動、短拉與跳段，標準描寫通過`,()=>{
    const paths=c.paths.map(samplePath);
    for(let i=0;i<paths.length;i++) {
      const ps=paths[i],start=ps[0];
      const make=()=>c.language==='ko'?createTracingStroke(paths,i,tracingOptions(c,i)):createGuidedStroke(ps,strokeOptions(c,i));
      for(const input of [[start,start],[start,{x:start.x+1,y:start.y+1},start,start],ps.slice(0,Math.max(2,Math.floor(ps.length*.2))),[start,start,ps.at(-1),ps.at(-1)]]) {
        const trace=make();trace.start(input[0]);input.slice(1).forEach(p=>trace.add(p));
        assert.equal(trace.finish().ok,false,`${c.display} ${i+1}: ${input.length} points`);
      }
      const standard=make();standard.start(ps[0]);ps.slice(1).forEach(p=>standard.add(p));
      assert.equal(standard.finish().ok,true,`${c.display} ${i+1}: ${standard.result.reason}`);
      const cancelled=make();cancelled.start(ps[0]);ps.slice(1).forEach(p=>cancelled.add(p));cancelled.cancel();assert.equal(cancelled.finish().ok,false);
    }
  });
}
