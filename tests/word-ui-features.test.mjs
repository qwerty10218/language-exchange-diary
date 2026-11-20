import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toSimplified, loadScript, saveScript, SCRIPT_KEY } from '../src/zh-script.mjs';
import { wordGroups, wordGroup, sortAndFilterWords } from '../src/word-sort.mjs';
import { searchEntries } from '../src/learning.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const ja = read('../data/ja.entries.json');
const ko = read('../data/ko.entries.json');

test('中文介面與詞義使用 OpenCC 繁簡轉換，原文資料不被修改', () => {
  assert.equal(toSimplified('韓文單字：減肥、節食；學習筆記'), '韩文单字：减肥、节食；学习笔记');
  assert.equal(toSimplified('朋友教我的韓文'), '朋友教我的韩文');
  const original=ko.find(e=>e.text==='라면');
  assert.equal(original.text,'라면');
  assert.equal(original.personal_mnemonic,'la men');
});

test('簡體查詢也能找到繁體詞義，但不跨日韓詞庫',()=>{
  assert.ok(searchEntries(ko,'减肥').some(e=>e.text==='다이어트'));
  assert.ok(searchEntries(ja,'雨伞').some(e=>e.text==='かさ'));
  assert.equal(searchEntries(ko,'すいか').length,0);
});

test('繁簡顯示偏好可保存，錯誤儲存狀態不會使功能崩潰',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(loadScript(()=>storage),'hant');
  saveScript('hans',()=>storage);
  assert.equal(values.get(SCRIPT_KEY),'hans');
  assert.equal(loadScript(()=>storage),'hans');
  saveScript('hant',()=>storage);
  assert.equal(loadScript(()=>storage),'hant');
  assert.equal(loadScript(()=>({getItem:()=>{throw Error('blocked')}})),'hant');
  assert.doesNotThrow(()=>saveScript('hans',()=>({setItem:()=>{throw Error('blocked')}})));
});

test('日文依假名行、韓文依子音首字母篩選，排序不會修改原詞庫',()=>{
  assert.ok(wordGroups('ja').includes('さ'));
  assert.ok(wordGroups('ko').includes('ㄱ'));
  assert.equal(wordGroup({language:'ja',text:'さけ',reading:'さけ'}),'さ');
  assert.equal(wordGroup({language:'ja',text:'がく',reading:'がく'}),'か');
  assert.equal(wordGroup({language:'ja',text:'ガク',reading:'ガク'}),'か');
  assert.equal(wordGroup({language:'ko',text:'까치'}),'ㄱ');
  assert.equal(wordGroup({language:'ko',text:'라면'}),'ㄹ');
  const jaIds=ja.map(e=>e.id);
  const recent=sortAndFilterWords(ja,'ja','recent');
  assert.equal(recent[0].id,ja.at(-1).id);
  const group=sortAndFilterWords(ja,'ja','alphabet','さ');
  assert.ok(group.length>0);
  assert.ok(group.every(e=>wordGroup(e)==='さ'));
  const ordered=sortAndFilterWords(ja,'ja','alphabet');
  assert.equal(ordered.length,ja.length);
  assert.deepEqual(ja.map(e=>e.id),jaIds);
  const koByOnset=sortAndFilterWords(ko,'ko','alphabet','ㄹ');
  assert.ok(koByOnset.some(e=>e.text==='라면'));
  assert.ok(koByOnset.every(e=>wordGroup(e)==='ㄹ'));
});
