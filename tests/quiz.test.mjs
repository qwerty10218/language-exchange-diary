import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { wordLetters, lookupText, graphemes, kanaGrid } from '../src/word-letters.mjs';
import { LEARNING_KEY, newRecord, gradeWord, learningState, summarize, buildQuestions, questionPool, questionWeight, chooseQuestion, emptyQuiz, quizSession, kanaKeys, hangulKeys, loadLearning, saveLearning } from '../src/quiz-model.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const ja=read('../data/ja.entries.json'),ko=read('../data/ko.entries.json');
const jaPool=buildQuestions(ja,'ja').questions,koPool=buildQuestions(ko,'ko').questions;
const umbrella=jaPool.find(q=>q.answer==='かさ');
const find=text=>ja.find(e=>e.text===text);
const at=1800000000000,DAY=86400000;
const storage=()=>{const map=new Map();return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};

for(const [word,expected] of [['かさ',['か','さ']],['すいか',['す','い','か']],['すし',['す','し']],['しお',['し','お']],['いぬ',['い','ぬ']]]) test(`${word}：精確對應原字形的五十音，不重複標紅`,()=>{
  assert.deepEqual(wordLetters(find(word)),{text:word,letters:expected,unsupported:[]});
});
test('Unicode 正規化保留小促音、拗音、長音與平片假名差異',()=>{
  const entry={language:'ja',text:'きゃっきゃーキャがか\u3099',reading:null};
  const analysis=wordLetters(entry);
  assert.deepEqual(analysis.letters,['き','キ']);
  assert.deepEqual(analysis.unsupported,['ゃ','っ','ー','ャ','が']);
  assert.deepEqual(graphemes('か\u3099っきゃー'),['が','っ','き','ゃ','ー']);
  assert.equal(wordLetters({language:'ja',text:'スイカ',reading:'すいか'}).letters.includes('す'),false);
  assert.deepEqual(wordLetters({language:'ja',text:'ののの',reading:null}).letters,['の']);
  assert.deepEqual(wordLetters({language:'ja',text:'未',reading:null}).unsupported,['未']);
});
test('漢字詞只使用詞庫讀音，不從字形或備註猜測',()=>{
  const cat=ja.find(e=>e.id==='ja-neko');
  assert.equal(lookupText(cat),'ねこ');assert.deepEqual(wordLetters(cat).letters,['ね','こ']);
  assert.deepEqual(wordLetters({language:'ja',text:'猫',reading:null}).unsupported,['猫']);
});
test('五十音依 a/i/u/e/o 欄對齊，や／わ 行空格不是假字母',()=>{
  const grid=kanaGrid(kanaKeys('hiragana').basic);
  assert.deepEqual(grid.slice(35,40),['や',null,'ゆ',null,'よ']);
  assert.deepEqual(grid.slice(45,50),['わ',null,null,null,'を']);
  assert.equal(grid.filter(Boolean).length,46);
});
test('韓文音節拆解含初聲、複合母音與複合收音',()=>{
  assert.deepEqual(wordLetters({language:'ko',text:'닭',reading:null}).letters,['ㄷ','ㅏ','ㄹ','ㄱ']);
  assert.deepEqual(wordLetters({language:'ko',text:'괜찮아',reading:null}).letters,['ㄱ','ㅙ','ㄴ','ㅊ','ㅏ','ㅎ','ㅇ']);
  assert.deepEqual(wordLetters({language:'ko',text:'밥',reading:null}).letters,['ㅂ','ㅏ']);
  assert.deepEqual(wordLetters({language:'ko',text:'가',reading:null}).letters,['ㄱ','ㅏ']);
});
test('雨傘題來自既有詞庫，可用 か＋さ 作答；假名鍵盤涵蓋讀音',()=>{
  assert.equal(umbrella.prompt,'雨傘');assert.equal(umbrella.entry.id,find('かさ').id);
  let s=quizSession(emptyQuiz(),{type:'start',question:umbrella,total:5});
  s=quizSession(s,{type:'add',character:'か'});s=quizSession(s,{type:'add',character:'さ'});
  s=quizSession(s,{type:'submit'});
  assert.deepEqual(s.result,{correct:true,counted:true});assert.equal(s.correct,1);
  for(const q of jaPool) {
    const keys=[...kanaKeys('hiragana').basic,...kanaKeys('hiragana').extra,...kanaKeys('katakana').basic,...kanaKeys('katakana').extra];
    assert.ok(q.tokens.every(c=>keys.includes(c)),q.answer);
  }
  for(const q of koPool) assert.ok(q.tokens.every(c=>hangulKeys(q,koPool).includes(c)));
});
test('刪字、錯誤統計、修改後再提交；同題訂正不重複計分',()=>{
  let s=quizSession(emptyQuiz(),{type:'start',question:umbrella,total:5});
  s=quizSession(s,{type:'add',character:'か'});s=quizSession(s,{type:'add',character:'し'});
  s=quizSession(s,{type:'delete'});assert.equal(s.answer,'か');
  s=quizSession(s,{type:'add',character:'し'});s=quizSession(s,{type:'submit'});
  let records=gradeWord({},umbrella.id,s.result.correct,at);
  assert.equal(records[umbrella.id].wrong,1);assert.equal(records[umbrella.id].streak,0);
  assert.equal(quizSession(s,{type:'submit'}),s);
  s=quizSession(s,{type:'edit'});s=quizSession(s,{type:'delete'});s=quizSession(s,{type:'add',character:'さ'});s=quizSession(s,{type:'submit'});
  assert.deepEqual(s.result,{correct:true,counted:false});assert.equal(s.correct,0);
  if(s.result.counted) records=gradeWord(records,umbrella.id,s.result.correct,at+1);
  assert.equal(records[umbrella.id].wrong,1);assert.equal(records[umbrella.id].correct,0);
  s=quizSession(s,{type:'next',question:jaPool.find(q=>q.id!==umbrella.id)});
  assert.equal(s.answer,'');assert.equal(s.graded,false);assert.equal(s.index,2);
});
test('未送出與已送出狀態分離，查表解析不會修改測驗或統計',()=>{
  let s=quizSession(emptyQuiz(),{type:'start',question:umbrella,total:5});
  s=quizSession(s,{type:'add',character:'か'});
  const before=structuredClone(s),records={};
  wordLetters(find('すいか'));wordLetters(find('かさ'));
  assert.deepEqual(s,before);assert.deepEqual(records,{});
  assert.equal(quizSession(s,{type:'next',question:jaPool[0]}),s);
  assert.equal(quizSession(s,{type:'submit'}),s);
  s=quizSession(s,{type:'add',character:'さ'});s=quizSession(s,{type:'submit'});
  const graded=structuredClone(s);wordLetters(find('かさ'));assert.deepEqual(s,graded);
});
test('同中文多個拼字的題目排除，不從備註任意製造同義答案',()=>{
  const extra={...find('かさ'),id:'ja-other',text:'アンブレラ',reading:'アンブレラ',meaning_zh:'雨傘'};
  const out=buildQuestions([find('かさ'),extra],'ja');
  // かさ still has unambiguous 傘; the shared 雨傘 prompt is excluded for both.
  assert.equal(out.questions[0].prompt,'傘');assert.ok(out.excluded.some(e=>e.id==='ja-other'));
  const both=buildQuestions([{...find('かさ'),meaning_zh:'雨傘'},extra],'ja');
  assert.equal(both.questions.length,0);
  const duplicates=buildQuestions([find('かさ'),{...find('かさ'),id:'ja-same'}],'ja');
  assert.equal(duplicates.questions.length,2);
  assert.ok(buildQuestions(ja,'ja').excluded.some(e=>e.id===ja.find(e=>e.text==='パソコン').id));
  const thanks=ja.find(e=>e.text==='ありがとう'),polite=ja.find(e=>e.text==='ありがとうございます');
  const register=buildQuestions([thanks,polite],'ja');
  assert.equal(register.questions.length,1);assert.equal(register.questions[0].answer,'ありがとうございます');
});
test('日韓題庫、學習統計與排除規則互不干擾',()=>{
  assert.ok(jaPool.every(q=>q.entry.language==='ja'));assert.ok(koPool.every(q=>q.entry.language==='ko'));
  assert.equal(buildQuestions(ko,'ja').questions.length,0);
  assert.ok(!koPool.some(q=>q.entry.text==='ㅅㅂ'));
  const records=gradeWord({},umbrella.id,true,at);
  assert.equal(summarize(ja,records,at).correct,1);assert.equal(summarize(ko,records,at).correct,0);
});
test('五次連對退出一般池，30 天後可複習；複習答錯返回一般池',()=>{
  let records={};
  for(let i=1;i<=5;i++) {
    records=gradeWord(records,umbrella.id,true,at+i);
    assert.equal(records[umbrella.id].streak,i);
    assert.equal(records[umbrella.id].nextReview,at+i+[1,3,7,14,30][i-1]*DAY);
  }
  assert.equal(records[umbrella.id].correct,5);assert.equal(learningState(records[umbrella.id],at+5),'mastered');
  assert.ok(!questionPool(jaPool,records,'general',at+5).some(q=>q.id===umbrella.id));
  assert.ok(questionPool(jaPool,records,'due',at+31*DAY).some(q=>q.id===umbrella.id));
  records=gradeWord(records,umbrella.id,false,at+31*DAY);
  assert.equal(records[umbrella.id].correct,5);assert.equal(records[umbrella.id].wrong,1);assert.equal(records[umbrella.id].streak,0);
  assert.ok(questionPool(jaPool,records).some(q=>q.id===umbrella.id));
});
test('中途答錯重設連對，保留累積歷史且不變更舊物件',()=>{
  let records={};for(let i=0;i<4;i++) records=gradeWord(records,umbrella.id,true,at+i);
  const before=structuredClone(records),next=gradeWord(records,umbrella.id,false,at+5);
  assert.deepEqual(records,before);assert.equal(next[umbrella.id].streak,0);assert.equal(next[umbrella.id].correct,4);assert.equal(next[umbrella.id].wrong,1);
  assert.equal(learningState(next[umbrella.id],at+5),'due');
});
test('錯題加權增加出現率，但不連續出同題；單一題目不立即重複',()=>{
  const q1=jaPool[0],q2=jaPool[1],records=gradeWord({},q1.id,false,at);
  assert.ok(questionWeight(records[q1.id],at)>questionWeight(undefined,at));
  let hits=0;
  for(let i=0;i<100;i++) if(chooseQuestion([q1,q2],records,{now:at,random:()=>i/100}).id===q1.id) hits++;
  assert.ok(hits>50);
  for(let i=0;i<100;i++) assert.notEqual(chooseQuestion([q1,q2],records,{lastId:q1.id,now:at,random:()=>i/100}).id,q1.id);
  assert.equal(chooseQuestion([q1],records,{lastId:q1.id}),null);
});
test('舊 v1 翻卡非破壞遷移：不假造答對次數，原鍵值保留',()=>{
  const store=storage(),old=JSON.stringify({version:1,entries:{[umbrella.id]:'remembered',[jaPool[0].id]:'forgotten'}});
  store.setItem('language-exchange-diary:review:v1',old);
  const loaded=loadLearning(()=>store);
  assert.equal(loaded.readOnly,false);assert.equal(loaded.records[umbrella.id].correct,0);assert.equal(loaded.records[umbrella.id].streak,0);
  assert.equal(loaded.records[umbrella.id].legacyReview,'remembered');
  assert.equal(saveLearning(()=>store,loaded.records),null);
  assert.equal(store.getItem('language-exchange-diary:review:v1'),old);
  assert.deepEqual(loadLearning(()=>store).records,loaded.records);
});
test('重新載入保留學習統計、未知詞條 ID 與歷史，不同步其他裝置',()=>{
  const store=storage(),other=storage();let records=gradeWord({},umbrella.id,true,at);
  records=gradeWord(records,'ko-retired-word',false,at+1);
  assert.equal(saveLearning(()=>store,records),null);
  assert.deepEqual(loadLearning(()=>store).records,records);assert.deepEqual(loadLearning(()=>other).records,{});
  const after=gradeWord(loadLearning(()=>store).records,umbrella.id,true,at+2);
  saveLearning(()=>store,after);assert.equal(loadLearning(()=>store).records[umbrella.id].streak,2);
  assert.equal(loadLearning(()=>store).records['ko-retired-word'].wrong,1);
});
test('損壞、未來版本、權限與配額失敗明示，絕不清除原始紀錄',()=>{
  for(const raw of ['{bad',JSON.stringify({version:3,records:{}}),JSON.stringify({version:2,records:{'ja-bad':{...newRecord(),wrong:-1}}})]) {
    const store=storage();store.setItem(LEARNING_KEY,raw);
    const out=loadLearning(()=>store);assert.equal(out.readOnly,true);assert.ok(out.error);
    assert.ok(saveLearning(()=>store,{}));assert.equal(store.getItem(LEARNING_KEY),raw);
  }
  assert.equal(loadLearning(()=>{throw Error('denied');}).readOnly,true);
  const store={getItem:()=>null,setItem:()=>{throw Error('quota');}};
  assert.ok(saveLearning(()=>store,{}));
});
