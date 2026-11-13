import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeEntries } from '../scripts/merge-entries.mjs';
import { normalizeSearch, searchEntries, reviewPool, reviewQueue, recordReview, loadProgress, saveProgress, PROGRESS_KEY } from '../src/learning.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const ko=read('../data/ko.entries.json'),ja=read('../data/ja.entries.json');
test('最新真實詞庫可搜尋原文、中文、讀音、個人記音及備註，不跨語言混合',()=>{
  assert.equal(ja.length,36);assert.equal(ko.length,90);
  for(const q of ['소고기','牛肉','sou ku ki'])assert.ok(searchEntries(ko,q).some(e=>e.text==='소고기'));
  for(const q of ['試験','しけん','考試'])assert.ok(searchEntries(ja,q).some(e=>e.text==='しけん'));
  assert.ok(searchEntries(ja,'考试').some(e=>e.text==='しけん'), 'Simplified Chinese must match the Traditional gloss');
  assert.ok(searchEntries(ja,'考試').some(e=>e.text==='しけん'));
  assert.deepEqual(searchEntries(ko,'  SHI　HOM  ').map(e=>e.text),['시험']);
  assert.deepEqual(searchEntries(ko,'Wu san').map(e=>e.text),['우산']);
  assert.equal(searchEntries(ko,'試験').length,0);assert.equal(searchEntries(ja,'Shi hom').length,0);
  assert.equal(searchEntries(ja,'  ').length,ja.length);assert.equal(searchEntries(ja,'不存在的查詢').length,0);
  assert.equal(normalizeSearch('ＳＨＩ　HOM'),'shi hom');
  for(const word of ['さけ','さかな','なす','なに'])assert.ok(ja.some(e=>e.text===word),word);
  for(const word of ['심심하다','라면','우동'])assert.ok(ko.some(e=>e.text===word),word);
  assert.equal(ko.find(e=>e.text==='심심하다').personal_mnemonic,'sim sim ha da');
  assert.equal(ko.find(e=>e.text==='라면').personal_mnemonic,'la men');
  assert.equal(ko.find(e=>e.text==='우동').personal_mnemonic,'wu dong');
});
test('合併不覆蓋同詞的既有ID、記音、非空內容，補缺與衝突可查',()=>{
  const base={...ko[0],notes:'既有教學備註',personal_mnemonic:'original'};
  const candidate={...base,id:'ko-candidate-id',notes:'候選備註',personal_mnemonic:'candidate'};
  const before=structuredClone(base),r=mergeEntries([base],[candidate],'ko');
  assert.deepEqual(base,before);assert.equal(r.entries.length,1);
  assert.equal(r.entries[0].id,base.id);assert.equal(r.entries[0].personal_mnemonic,'original');assert.equal(r.entries[0].notes,'既有教學備註');
  assert.equal(r.conflicts.length,2);
  const fill=mergeEntries([{...base,notes:''}],[{...base,notes:'補充'}],'ko');
  assert.equal(fill.entries[0].notes,'補充');assert.equal(fill.filled.length,1);
  assert.throws(()=>mergeEntries([base],[{...candidate,language:'ja'}],'ko'));
  assert.throws(()=>mergeEntries([base],[{...candidate,review_status:'verified'}],'ko'));
});
test('候選的ID與原文若分別對到不同舊詞，不任意併成一詞',()=>{
  const a=ko[0],b=ko[1],r=mergeEntries([a,b],[{...a,text:b.text}],'ko');
  assert.deepEqual(r.entries,[a,b]);assert.equal(r.conflicts[0].field,'identity');
});
test('現有ID、筆記、候選原始記音與待查狀態保留',()=>{
  assert.equal(ja.find(e=>e.id==='ja-neko').text,'猫');
  assert.equal(ja.find(e=>e.id==='ja-otsu-ka-re').meaning_zh,'辛苦了');
  assert.equal(ko.find(e=>e.id==='ko-no-rae-bang').meaning_zh,'卡拉 OK');
  assert.equal(ko.find(e=>e.text==='시험').personal_mnemonic,'Shi hom');
  assert.equal(ko.find(e=>e.text==='저녁').personal_mnemonic,'chou new');
  assert.equal(ko.find(e=>e.text==='우산').personal_mnemonic,'Wu san');
  for(const e of [...ko,...ja]){assert.equal(e.review_status,'needs_review');assert.equal(e.audio,null);}
});
test('複習排除指定粗口，忘記優先，支援5/10/全部並且不改原詞庫',()=>{
  const pool=reviewPool(ko),before=ko.map(e=>e.id);
  assert.equal(pool.length,ko.length-1);assert.equal(reviewPool(ko,true).length,ko.length);assert.ok(!pool.some(e=>e.text==='ㅅㅂ'));
  const progress={[pool[0].id]:'remembered',[pool.at(-1).id]:'forgotten'};
  assert.equal(reviewQueue(pool,progress,5).length,5);assert.equal(reviewQueue(pool,progress,10).length,10);
  assert.equal(reviewQueue(pool,progress,'all').length,pool.length);assert.equal(reviewQueue(pool,progress,5)[0].id,pool.at(-1).id);
  assert.deepEqual(ko.map(e=>e.id),before);assert.deepEqual(reviewQueue([],{},5),[]);
});
test('每台裝置獨立儲存；重新讀取保留記得／忘記且不修改詞庫',()=>{
  const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  const first=loadProgress(()=>storage);assert.equal(first.error,null);assert.deepEqual(first.progress,{});
  const next=recordReview(first.progress,ko[0].id,'remembered');
  const combined=recordReview(next,ja[0].id,'forgotten');
  assert.deepEqual(first.progress,{});assert.equal(saveProgress(()=>storage,combined),null);
  assert.deepEqual(loadProgress(()=>storage).progress,combined);
  assert.deepEqual(loadProgress(()=>({getItem:()=>null})).progress,{});
  assert.equal(JSON.parse(memory.get(PROGRESS_KEY)).version,1);
});
test('損壞紀錄、未知版本、封鎖與配額錯誤都明確回報，可繼續暫存練習',()=>{
  for(const raw of ['broken','{"version":99,"entries":{}}','{"version":1,"entries":[]}']){
    const result=loadProgress(()=>({getItem:()=>raw}));assert.ok(result.error);assert.deepEqual(result.progress,{});
  }
  assert.ok(loadProgress(()=>{throw Error('SecurityError');}).error);
  assert.ok(saveProgress(()=>({setItem:()=>{throw Error('QuotaExceededError');}}),{}));
  assert.deepEqual(loadProgress(()=>({getItem:()=>JSON.stringify({version:1,entries:{'ko-good':'remembered','ja-valid':'wrong','__proto__':'forgotten'}})})).progress,{'ko-good':'remembered'});
});
