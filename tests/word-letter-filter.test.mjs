import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {letterTabs,wordContainsLetter,filterByLetter} from '../src/word-letter-filter.mjs';
import {sortAndFilterWords} from '../src/word-sort.mjs';
import {searchEntries} from '../src/learning.mjs';
const ja=JSON.parse(readFileSync(new URL('../data/ja.entries.json',import.meta.url)));
const ko=JSON.parse(readFileSync(new URL('../data/ko.entries.json',import.meta.url)));
const get=(list,text)=>{const found=list.find(e=>e.text===text);assert.ok(found,text+' should exist');return found;};
test('格子配置：基本韓文 19 子音、21 母音及日文平／片假名各 46 個',()=>{
  assert.deepEqual(letterTabs.ko.map(t=>t.letters.length),[19,21]);
  assert.deepEqual(letterTabs.ja.map(t=>t.letters.length),[46,46]);
  assert.equal(new Set(letterTabs.ko.flatMap(t=>t.letters)).size,40);
  assert.equal(new Set(letterTabs.ja.flatMap(t=>t.letters)).size,92);
});
test('韓文: 比對字詞任意音節的初聲、中聲、終聲，不只比第一字',()=>{
  assert.equal(wordContainsLetter(get(ko,'라면'),'ㅁ'),true);
  assert.equal(wordContainsLetter(get(ko,'라면'),'ㅏ'),true);
  assert.equal(wordContainsLetter(get(ko,'심심하다'),'ㅁ'),true);
  assert.equal(wordContainsLetter(get(ko,'우산'),'ㅅ'),true);
  assert.equal(wordContainsLetter(get(ko,'라면'),'ㅍ'),false);
  assert.ok(filterByLetter(ko,'ㅁ').some(x=>x.text==='심심하다'));
});
test('韓文: 複合母音不誤判為單母音，複合收音可拆成基礎子音',()=>{
  const compound={language:'ko',text:'과',reading:null};
  assert.equal(wordContainsLetter(compound,'ㅘ'),true);
  assert.equal(wordContainsLetter(compound,'ㅗ'),false);
  assert.equal(wordContainsLetter(compound,'ㅏ'),false);
  const complexFinal={language:'ko',text:'값',reading:null};
  assert.equal(wordContainsLetter(complexFinal,'ㅂ'),true);
  assert.equal(wordContainsLetter(complexFinal,'ㅅ'),true);
});
test('日文: 包含任何位置的單個假名，不強制和片假名混合',()=>{
  assert.equal(wordContainsLetter(get(ja,'なに'),'に'),true);
  assert.equal(wordContainsLetter(get(ja,'なす'),'す'),true);
  assert.equal(wordContainsLetter(get(ja,'すいか'),'か'),true);
  assert.equal(wordContainsLetter(get(ja,'ジュース'),'ジ'),true);
  assert.equal(wordContainsLetter(get(ja,'ジュース'),'し'),false);
  assert.equal(wordContainsLetter(get(ja,'なす'),'ナ'),false);
});
test('字母篩選與中文搜尋、排序組合使用，完全不改寫來源資料',()=>{
  const original=ko.map(e=>e.id);
  const results=filterByLetter(sortAndFilterWords(searchEntries(ko,'無聊'),'ko','alphabet'),'ㅁ');
  assert.deepEqual(results.map(e=>e.text),['심심하다']);
  assert.equal(filterByLetter(ko,null).length,ko.length);
  assert.deepEqual(ko.map(e=>e.id),original);
});
