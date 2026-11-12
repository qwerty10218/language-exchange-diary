import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { auditCharacter, samplePath } from '../scripts/writing-qa.mjs';
import { convertKana } from '../scripts/import-writing.mjs';
import { strokeOptions, validateSettings, WRITING_SETTINGS } from '../src/writing-config.mjs';
import { emptySession, reviewSession } from '../src/review-session.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const index=JSON.parse(read('../data/writing-index.json'));
const inventory=JSON.parse(read('../data/character_inventory.json'));
const legacy=JSON.parse(read('../data/phase0.strokes.json'));
test('完整 132 字索引與讀音，不變更詞庫 Schema',()=>{
  assert.equal(index.characters.length,132);assert.equal(new Set(index.characters.map(c=>c.display)).size,132);
  for(const [category,characters] of Object.entries(inventory.groups)) assert.deepEqual(index.characters.filter(c=>c.category===category).map(c=>c.display),characters);
  for(const c of index.characters) {
    assert.ok(c.reading&&c.romanization&&c.readingSource);assert.equal(c.humanStatus,'pending');
    if(!c.paths.length) { assert.equal(c.strokeCount,null);assert.deepEqual(c.order,[]);assert.deepEqual(c.directions,[]);assert.ok(c.missingReason); }
  }
  assert.deepEqual(JSON.parse(read('../public/strokes/catalog/writing-index.json')),index);
});
for(const c of index.characters.filter(c=>c.paths.length)) test(`${c.display}：來源曲線與批次 QA 結果可重現`,()=>{
  assert.deepEqual(auditCharacter(c),c);
  const source=read('../public'+c.sourceFile);
  assert.equal(createHash('sha256').update(source).digest('hex'),c.sourceHash);
  if(c.language==='ja')assert.ok(c.source.includes('70a0b7ae0c18ceb5cb358274b029cce0234a43bc'));
  else if(c.display==='ㅏ')assert.ok(c.source.includes('935483f7e93d24aa2ec990bca1b43664307768d2'));
  else{assert.equal(c.source,'https://strokefox.com/data/ko-jamo-strokes.json.gz');assert.equal(c.license,'CC-BY-4.0');
    const data=JSON.parse(source).data[c.display];assert.deepEqual(c.paths,data.d.map(d=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,n=>String(+(Number(n)*1024/109).toFixed(6)))));}
  if(c.language==='ja') {
    const code=c.display.codePointAt(0).toString(16).padStart(5,'0');
    assert.deepEqual(convertKana(source,code),c.paths); assert.equal(c.license,'CC-BY-SA-3.0');
  }
  const original=legacy.characters.find(o=>o.display===c.display);
  if(original) { assert.deepEqual(c.paths,original.paths);assert.deepEqual(c.starts,original.starts); }
});
test('未知中心線與技術失敗字元不得冒充可用',()=>{
  assert.equal(index.characters.filter(c=>c.paths.length).length,132);
  assert.equal(index.characters.filter(c=>c.technicalStatus==='passed').length,129);
  assert.equal(index.characters.filter(c=>c.technicalStatus==='pending').length,0);
  assert.deepEqual(index.characters.filter(c=>c.technicalStatus==='failed').map(c=>c.display),['う','や','ネ']);
  for(const [display,check] of [['う','reverse'],['や','reverse'],['ネ','order']]) assert.equal(index.characters.find(c=>c.display===display).tests[check],false);
});
test('批次 QA 拒絕外框、跳筆、無效筆畫數與框外路徑',()=>{
  assert.throws(()=>samplePath('M0 0L10 10M20 20L30 30'),/子路徑/);
  assert.throws(()=>samplePath('M0 0L10 10Z'),/閉合/);
  assert.throws(()=>samplePath('M0 0A10 10 0 0 0 20 20'),/無效 SVG/);
  const c=structuredClone(index.characters.find(c=>c.display==='ㅏ'));
  c.strokeCount=99; assert.equal(auditCharacter(c).tests.structure,false);
  c.strokeCount=2;c.paths[0]='M-10 80 L410 940';
  assert.equal(auditCharacter(c).tests.bounds,false);
  assert.equal(auditCharacter(c).technicalStatus,'failed');
  const crossing=structuredClone(index.characters.find(c=>c.display==='ㅏ'));
  crossing.paths=['M200 300 L800 700','M200 700 L800 300'];
  crossing.starts=[[200,300,50,33],[200,700,50,-33]];
  crossing.directions=crossing.starts.map(p=>({from:p.slice(0,2),vector:p.slice(2)}));
  assert.ok(auditCharacter(crossing).strokeTypes.every(types=>types.includes('crossing')));
});
test('共用參數及類型覆寫不放寬筆順與方向，字元覆寫必須有原因',()=>{
  assert.deepEqual(validateSettings(WRITING_SETTINGS),[]);
  const c=index.characters.find(c=>c.display==='あ');
  const defaultOptions=strokeOptions(c,0);
  assert.equal(defaultOptions.startRadius,.15);assert.equal(defaultOptions.snapRadius,.13);assert.equal(defaultOptions.maxDeviation,.2);
  assert.equal(defaultOptions.completion,.75);assert.equal(defaultOptions.strictOrder,true);assert.equal(defaultOptions.rejectBackwards,true);
  assert.equal(strokeOptions({...c,strokeTypes:[['curve','short','crossing']]},0).maxSearchFraction,.14);
  const bad=structuredClone(WRITING_SETTINGS);bad.global.rejectBackwards=false;
  assert.ok(validateSettings(bad).some(e=>e.includes('rejectBackwards')));
  bad.global.rejectBackwards=true;bad.overrides[c.id]={strokes:{0:{startRadius:.1}}};
  assert.ok(validateSettings(bad).some(e=>e.includes('原因')));
  bad.overrides[c.id].reason='範例測試，不作正式覆寫';assert.deepEqual(validateSettings(bad),[]);
});
test('複習狀態轉移：翻面後答題、語言獨立、保留原佇列',()=>{
  const entries=JSON.parse(read('../data/ja.entries.json'));
  const sessions={ja:emptySession(),ko:emptySession()};
  sessions.ja=reviewSession(sessions.ja,{type:'start',queue:entries.slice(0,5)});
  // Can't answer before revealing.
  assert.equal(reviewSession(sessions.ja,{type:'answer',status:'remembered'}),sessions.ja);
  sessions.ja=reviewSession(sessions.ja,{type:'reveal'});
  const saved=structuredClone(sessions.ja);
  sessions.ko=reviewSession(sessions.ko,{type:'start',queue:[]});assert.deepEqual(sessions.ja,saved);
  sessions.ja=reviewSession(sessions.ja,{type:'answer',status:'remembered'});
  assert.equal(sessions.ja.index,1);assert.equal(sessions.ja.revealed,false);assert.equal(sessions.ja.remembered,1);
  sessions.ja=reviewSession(sessions.ja,{type:'reveal'});sessions.ja=reviewSession(sessions.ja,{type:'answer',status:'forgotten'});
  assert.equal(sessions.ja.index,2);assert.equal(sessions.ja.remembered,1);assert.equal(sessions.ja.queue.length,5);
});
