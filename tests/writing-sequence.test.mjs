import test from 'node:test';
import assert from 'node:assert/strict';
import {writingSequence} from '../src/writing-sequence.mjs';
const entry=(text,language='ja',reading=null)=>({text,language,reading});
test('ordered word practice retains repeats and exact kana script',()=>{
  assert.deepEqual(writingSequence(entry('なに')).letters,['な','に']);
  assert.deepEqual(writingSequence(entry('ここ')).letters,['こ','こ']);
  assert.deepEqual(writingSequence(entry('ラメン')).letters,['ラ','メ','ン']);
  assert.deepEqual(writingSequence(entry('魚','ja','さかな')).letters,['さ','か','な']);
  for(const reading of [null,'魚','さかな魚'])assert.deepEqual(writingSequence(entry('魚','ja',reading)).letters,[]);
});
test('Korean Unicode vowels, tense letters, final clusters and duplicates',()=>{
  assert.deepEqual(writingSequence(entry('라면','ko')).letters,[...'ㄹㅏㅁㅕㄴ']);
  assert.deepEqual(writingSequence(entry('우동','ko')).letters,[...'ㅇㅜㄷㅗㅇ']);
  assert.deepEqual(writingSequence(entry('꽉','ko')).letters,[...'ㄲㅘㄱ']);
  assert.deepEqual(writingSequence(entry('값','ko')).letters,[...'ㄱㅏㅂㅅ']);
  const finals={3:'ㄱㅅ',5:'ㄴㅈ',6:'ㄴㅎ',9:'ㄹㄱ',10:'ㄹㅁ',11:'ㄹㅂ',12:'ㄹㅅ',13:'ㄹㅌ',14:'ㄹㅍ',15:'ㄹㅎ',18:'ㅂㅅ'};
  for(const [index,letters] of Object.entries(finals))assert.deepEqual(writingSequence(entry(String.fromCodePoint(0xac00+Number(index)),'ko')).letters,[...'ㄱㅏ',...letters]);
  assert.deepEqual(writingSequence(entry('우동'.normalize('NFD'),'ko')).letters,[...'ㅇㅜㄷㅗㅇ']);
});
test('unsupported tokens stay explicit and never become invented basic letters',()=>{
  assert.deepEqual(writingSequence(entry('がっキャー')).unsupported,['が','っ','ャ','ー']);
  assert.deepEqual(writingSequence(entry('가!','ko')).unsupported,['!']);
  assert.deepEqual(writingSequence(entry('うやネ')).letters,['う','や','ネ']); // availability is independently gated by canPractice
  assert.deepEqual(writingSequence(entry('か\u3099')).unsupported,['が']);
});
