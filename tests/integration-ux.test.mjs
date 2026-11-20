import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {toSimplified,chineseNote,saveScript,loadScript,SCRIPT_KEY} from '../src/zh-script.mjs';
import {wordGroup,sortAndFilterWords} from '../src/word-sort.mjs';
import {searchEntries} from '../src/learning.mjs';
import {entrySpeechText} from '../src/speech.mjs';

test('OpenCC longest phrases protect identities and outputs from character re-conversion',()=>{
  assert.equal(toSimplified('乾隆年間，乾坤一擲，乾乾淨淨'),'乾隆年间，乾坤一掷，干干净净');
  assert.equal(toSimplified('乾隆與乾燥'),'乾隆与干燥');
  assert.equal(toSimplified('頭髮與發音'),'头发与发音');
  assert.equal(chineseNote('漢字：試験；複習し、接觸け與ん'),'汉字：試験；复习し、接触け与ん');
  assert.equal(chineseNote('亦寫「お疲れ様です」；寫法待確認'),'亦写「お疲れ様です」；写法待确认');
});

test('script preference round trips without writing progress keys, storage errors remain usable',()=>{
  const writes=[];
  const storage={getItem:()=>writes.at(-1)?.[1],setItem:(...args)=>writes.push(args)};
  saveScript('hans',()=>storage);assert.equal(loadScript(()=>storage),'hans');
  saveScript('hant',()=>storage);assert.equal(loadScript(()=>storage),'hant');
  assert.ok(writes.every(([key])=>key===SCRIPT_KEY));
  assert.doesNotThrow(()=>saveScript('hans',()=>{throw Error('blocked');}));
});

test('kana, voiced/halfwidth kana and tense Korean onsets combine with Chinese search',()=>{
  const entry=(text,reading,language='ja')=>({id:text,text,reading,language,meaning_zh:'詞義',examples:[]});
  for(const [reading,group] of [['ガラス','か'],['ﾊﾟﾝ','は'],['ヴァイオリン','あ'],['コーヒー','か'],['っ','た']])assert.equal(wordGroup(entry('漢字',reading)),group);
  for(const [text,group] of [['까','ㄱ'],['따','ㄷ'],['빠','ㅂ'],['싸','ㅅ'],['짜','ㅈ']])assert.equal(wordGroup(entry(text,null,'ko')),group);
  const rows=[entry('青','あお'),entry('駅','えき'),entry('川','かわ')];
  assert.deepEqual(sortAndFilterWords([...rows].reverse(),'ja','alphabet').map(e=>e.text),['青','駅','川']);
  assert.deepEqual(sortAndFilterWords([entry('半濁','ぱな'),entry('濁','ばな'),entry('清','はな')],'ja','alphabet').map(e=>e.reading),['はな','ばな','ぱな']);
  const words=[{...entry('詞一','あ'),meaning_zh:'頭髮'},{...entry('詞二','か'),meaning_zh:'發音'}];
  assert.equal(sortAndFilterWords(searchEntries(words,'头发'),'ja','alphabet','あ').length,1);
  assert.equal(sortAndFilterWords(searchEntries(words,'頭髮'),'ja','alphabet','か').length,0);
  assert.equal(entrySpeechText({language:'ja',text:'生',reading:null}),'');
});

test('React translates Chinese during rendering while preserving interpolated vocabulary and mnemonic values',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  try {
    const {ChineseContext,useChinese}=await server.ssrLoadModule('/src/Chinese.tsx');
    function Probe(){
      const {t,note}=useChinese();
      return createElement('div',{title:t`查看 ${'頭'} 的詳細資料`},t('學習筆記'),createElement('span',{lang:'ja'},'頭'),createElement('span',{'data-preserve-script':true},'記憶：頭髮'),note('漢字：試験；複習'));
    }
    const render=mode=>renderToStaticMarkup(createElement(ChineseContext,{value:mode},createElement(Probe)));
    assert.match(render('hans'),/title="查看 頭 的详细资料"/);
    assert.match(render('hans'),/学习笔记/);
    assert.match(render('hans'),/記憶：頭髮/);
    assert.match(render('hans'),/汉字：試験；复习/);
    assert.match(render('hant'),/學習筆記/);
    assert.doesNotMatch(render('hant'),/学习笔记/);
  } finally {await server.close();}
});
