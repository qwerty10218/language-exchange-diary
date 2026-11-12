import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { svgPathProperties } from 'svg-path-properties';
import { createGuidedStroke, judgeStroke, insideSquare } from '../src/stroke-engine.mjs';
import { strokeOptions, validateSettings, WRITING_SETTINGS } from '../src/writing-config.mjs';
import { createTracingStroke, tracingOptions,validateTracingSettings } from '../src/tracing-engine.mjs';
const root=new URL('../',import.meta.url);
export function samplePath(d) {
  if(!/^M/i.test(d) || /[^MmLlHhVvCcSsQqTtZz\d\s,.+\-eE]/.test(d)) throw Error('不支援或無效 SVG');
  if((d.match(/[mM]/g)??[]).length!==1 || /[zZ]/.test(d)) throw Error('筆畫包含不連續子路徑或閉合外框');
  const p=new svgPathProperties(d), length=p.getTotalLength();
  if(!Number.isFinite(length) || length<1) throw Error('零長度／非有限路徑');
  // Dense samples accommodate the library's approximate inverse arc length near Bézier turns.
  const count=Math.max(96,Math.ceil(length/2)+1);
  return Array.from({length:count},(_,i)=>p.getPointAtLength(length*i/(count-1)));
}
const crosses=(a,b,c,d)=>{
  const area=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return area(a,b,c)*area(a,b,d)<0 && area(c,d,a)*area(c,d,b)<0;
};
export function classify(d, points) {
  const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
  const types=[/[cCsSqQtT]/.test(d)?'curve':'straight'];
  if(length<240) types.push('short');
  const reduced=points.filter((_,i)=>i%4===0);
  for(let i=1;i<reduced.length;i++) for(let j=i+3;j<reduced.length;j++) if(crosses(reduced[i-1],reduced[i],reduced[j-1],reduced[j])) return [...types,'crossing'];
  return types;
}
export function auditCharacter(character) {
  const c=structuredClone(character), issues=[]; const tests={structure:false,bounds:false,continuity:false,forward:false,reverse:false,order:false,cancel:false,freeForward:false};
  if(!c.paths.length) return {...c,technicalStatus:'pending',issues:c.missingReason?[c.missingReason]:['缺少中心線'],tests,strokeTypes:[]};
  try {
    if(c.strokeCount!==c.paths.length || c.starts.length!==c.paths.length || c.order.some((n,i)=>n!==i+1) || c.order.length!==c.paths.length || c.directions.length!==c.paths.length || !c.source || !c.license || !c.sourceHash) throw Error('結構、筆畫數、順序或來源缺漏');
    tests.structure=true;
    const samples=c.paths.map(samplePath); c.strokeTypes=c.paths.map((d,i)=>classify(d,samples[i]));
    if(c.language==='ko')c.paths.forEach((d,i)=>{if((d.match(/[HV]/gi)??[]).length>1)c.strokeTypes[i].push('turn');});
    const crossingSamples=samples.map(ps=>ps.filter((_,i)=>i%4===0));
    for(let i=0;i<samples.length;i++) for(let j=i+1;j<samples.length;j++) {
      const a=crossingSamples[i],b=crossingSamples[j]; let found=false;
      for(let x=1;x<a.length && !found;x++) for(let y=1;y<b.length;y++) if(crosses(a[x-1],a[x],b[y-1],b[y])) { found=true;break; }
      if(found) for(const n of [i,j]) if(!c.strokeTypes[n].includes('crossing')) c.strokeTypes[n].push('crossing');
    }
    tests.bounds=samples.every(ps=>ps.every(p=>insideSquare(p)));
    tests.continuity=samples.every(ps=>ps.slice(1).every((p,i)=>Math.hypot(p.x-ps[i].x,p.y-ps[i].y)<5));
    for(let i=0;i<samples.length;i++) {
      const p=samples[i][0],s=c.starts[i];
      if(Math.hypot(p.x-s[0],p.y-s[1])>.01 || c.directions[i].from.some((v,n)=>v!==s[n])) throw Error('起點／方向資料不一致');
      const vector=c.directions[i].vector,tip=samples[i][Math.min(samples[i].length-1,4)];
      if(vector.length!==2||!vector.every(Number.isFinite)||vector.some((v,n)=>v!==s[n+2])||(tip.x-p.x)*vector[0]+(tip.y-p.y)*vector[1]<=0)throw Error('筆畫方向向量無效');
    }
    const draw=(expected,input,i,cancel=false)=>{
      const guide=c.language==='ko'?createTracingStroke(samples,i,tracingOptions(c,i)):createGuidedStroke(expected,strokeOptions(c,i)); guide.start(input[0]);
      for(const p of input.slice(1)) {
        guide.add(p);
        if(!cancel && guide.canAutoComplete()) return guide.finishDirection().ok;
      }
      if(cancel) guide.cancel();
      return guide.finishDirection().ok;
    };
    tests.forward=samples.every((ps,i)=>draw(ps,ps,i));
    tests.freeForward=samples.every((ps,i)=>c.language==='ko'?draw(ps,ps,i):judgeStroke(ps,ps).ok);
    tests.reverse=samples.every((ps,i)=>!draw(ps,[...ps].reverse(),i));
    // One-stroke characters have no later stroke to reorder.
    tests.order=samples.every((ps,i)=>samples.every((other,j)=>i===j || !draw(ps,other,i)));
    tests.cancel=samples.every((ps,i)=>!draw(ps,ps.slice(0,2),i,true));
    for(const [test,ok] of Object.entries(tests)) if(!ok) issues.push(`技術檢查失敗：${test}`);
  } catch(error) { issues.push(error.message); }
  return {...c,technicalStatus:issues.length?'failed':'passed',issues,tests};
}
export async function run(write=false) {
  const configErrors=[...validateSettings(WRITING_SETTINGS),...validateTracingSettings()]; if(configErrors.length) throw Error(configErrors.join('\n'));
  const index=JSON.parse(await fs.readFile(new URL('data/writing-index.json',root),'utf8'));
  const inventory=JSON.parse(await fs.readFile(new URL('data/character_inventory.json',root),'utf8'));
  if(index.characters.length!==132 || new Set(index.characters.map(c=>c.id)).size!==132 || new Set(index.characters.map(c=>c.display)).size!==132) throw Error('索引必須包含 132 個不重複字元');
  for(const [category,displays] of Object.entries(inventory.groups)) {
    if(index.characters.filter(c=>c.category===category).map(c=>c.display).join('')!==displays.join('')) throw Error(`字元分類或順序不符：${category}`);
  }
  for(const c of index.characters) if(!c.reading || !c.romanization || !c.readingSource || !['pending','verified'].includes(c.humanStatus)) throw Error(`缺少讀音或驗證狀態：${c.display}`);
  const characters=index.characters.map(auditCharacter);
  if(characters.filter(c=>c.language==='ko'&&c.technicalStatus==='passed').length!==40)throw Error('韓文 40 音必須全部具備來源並通過描寫 QA');
  const report={...index,characters};
  if(write) {
    await fs.writeFile(new URL('data/writing-index.json',root),JSON.stringify(report,null,2)+'\n');
    await fs.mkdir(new URL('public/strokes/catalog/',root),{recursive:true});
    await fs.writeFile(new URL('public/strokes/catalog/writing-index.json',root),JSON.stringify(report,null,2)+'\n');
  } else {
    for(let i=0;i<characters.length;i++) if(JSON.stringify(characters[i])!==JSON.stringify(index.characters[i])) throw Error(`QA 過期：${characters[i].display}，請執行 writing:qa -- --write`);
    const published=JSON.parse(await fs.readFile(new URL('public/strokes/catalog/writing-index.json',root),'utf8'));
    if(JSON.stringify(published)!==JSON.stringify(index)) throw Error('公開索引副本不同步');
  }
  console.log(JSON.stringify({total:characters.length,paths:characters.filter(c=>c.paths.length).length,passed:characters.filter(c=>c.technicalStatus==='passed').length,failed:characters.filter(c=>c.technicalStatus==='failed').map(c=>c.display),pending:characters.filter(c=>c.technicalStatus==='pending').map(c=>c.display)},null,2));
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await run(process.argv.includes('--write'));
