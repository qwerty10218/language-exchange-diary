import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {svgPathProperties} from 'svg-path-properties';
import {composeSyllable,syllableParts} from '../src/hangul-blocks.mjs';
import {createBlockStroke} from '../src/block-tracing.mjs';
import {tracingOptions} from '../src/tracing-engine.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const characters=JSON.parse(read('../data/writing-index.json')).characters;
const entries=JSON.parse(read('../data/ko.entries.json'));
const displays=[...new Set([...entries.flatMap(e=>[...e.text.normalize('NFC')]),...'다라면우동권꽉값괜의'].filter(syllableParts))].sort();
const signature=createHash('sha256').update(['../data/writing-index.json','../data/hangul-settings.json','../src/hangul-blocks.mjs','../src/block-tracing.mjs','../src/tracing-engine.mjs','../src/stroke-engine.mjs'].map(read).join('\n')).digest('hex');
export function checkBlock(character){
  const strokes=character.paths.map(path=>{const p=new svgPathProperties(path),length=p.getTotalLength(),count=Math.max(101,Math.ceil(length/2));return Array.from({length:count},(_,i)=>p.getPointAtLength(length*i/(count-1)));});
  const checks={forward:true,reverse:true,short:true,cancel:true,bounds:true,order:true};
  for(let index=0;index<strokes.length;index++){
    const frame=character.strokeFrames[index],source=characters.find(c=>c.id===frame.sourceId),options=tracingOptions(source,frame.sourceIndex);
    const run=points=>{const trace=createBlockStroke(strokes,index,frame,options);trace.start(points[0]);points.slice(1).forEach(p=>trace.add(p));return trace.finish().ok;};
    checks.forward&&=run(strokes[index]);if(strokes.length>1)checks.order&&=!run(strokes[(index+1)%strokes.length]);checks.reverse&&=!run([...strokes[index]].reverse());checks.short&&=!run(strokes[index].slice(0,3));
    const trace=createBlockStroke(strokes,index,frame,options);trace.start(strokes[index][0]);trace.cancel();checks.cancel&&=!trace.finish().ok;
    checks.bounds&&=strokes[index].every(p=>p.x>=0&&p.y>=0&&p.x<=1024&&p.y<=1024);
  }
  return checks;
}
const results=displays.map(display=>{const character=composeSyllable(display,characters);const checks=character?checkBlock(character):{available:false};return {display,technicalStatus:Object.values(checks).every(Boolean)?'passed':'failed',checks};});
const report={version:1,signature,humanStatus:'pending',characters:results};
const output=new URL('../data/hangul-block-qa.json',import.meta.url),json=JSON.stringify(report,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(output,json);
else if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==json)throw Error('Hangul block QA is stale; run npm run writing:blocks -- --write and review results.');
console.log(JSON.stringify({syllables:results.length,passed:results.filter(c=>c.technicalStatus==='passed').length,failed:results.filter(c=>c.technicalStatus==='failed').map(c=>c.display)}));
