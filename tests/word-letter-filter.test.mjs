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
  assert.equal(wordContainsLetter(get(ja,'ジュース'),'ス'),true);
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

const matches=(text,language='ko',reading=null)=>{
  const entry={language,text,reading};
  return letterTabs[language].flatMap(tab=>tab.letters).filter(letter=>wordContainsLetter(entry,letter)).sort();
};
test('19 初聲與 21 中聲都精確可選，教學順序不誤當 Unicode 母音順序',()=>{
  const syllables=[...'가까나다따라마바빠사싸아자짜차카타파하'];
  syllables.forEach((text,i)=>assert.deepEqual(matches(text),[letterTabs.ko[0].letters[i],'ㅏ'].sort(),text));
  for(const [text,vowel] of [['가','ㅏ'],['개','ㅐ'],['갸','ㅑ'],['걔','ㅒ'],['거','ㅓ'],['게','ㅔ'],['겨','ㅕ'],['계','ㅖ'],['고','ㅗ'],['과','ㅘ'],['괘','ㅙ'],['괴','ㅚ'],['교','ㅛ'],['구','ㅜ'],['궈','ㅝ'],['궤','ㅞ'],['귀','ㅟ'],['규','ㅠ'],['그','ㅡ'],['긔','ㅢ'],['기','ㅣ']]){
    assert.deepEqual(matches(text),['ㄱ',vowel].sort(),text);
  }
});
test('11 組複合收音拆解且不誤判其他子音；NFD 等價字與獨立 jamo 也能比對',()=>{
  for(const [text,letters] of [['넋','ㄴㅓㄱㅅ'],['앉','ㅇㅏㄴㅈ'],['않','ㅇㅏㄴㅎ'],['읽','ㅇㅣㄹㄱ'],['삶','ㅅㅏㄹㅁ'],['넓','ㄴㅓㄹㅂ'],['곬','ㄱㅗㄹㅅ'],['핥','ㅎㅏㄹㅌ'],['읊','ㅇㅡㄹㅍ'],['싫','ㅅㅣㄹㅎ'],['값','ㄱㅏㅂㅅ']]){
    assert.deepEqual(matches(text),[...letters].sort(),text);
    assert.deepEqual(matches(text.normalize('NFD')),[...letters].sort(),text+' NFD');
  }
  assert.deepEqual(matches('ᄁ'),['ㄲ']);assert.deepEqual(matches('ㄳ'),['ㄱ','ㅅ']);
  assert.deepEqual(matches('ㅘ'),['ㅘ']);assert.deepEqual(matches('밖'),['ㄲ','ㅂ','ㅏ'].sort());
  assert.deepEqual(matches('있'),['ㅆ','ㅇ','ㅣ'].sort());
});
test('濁音、半濁音、拗音、小字、促音、長音及 NFD 不折算成基本假名',()=>{
  for(const [text,expected] of [['がぱゃっー',[]],['きゃ',['き']],['ギュッと',['と']],['ジュース',['ス']],['ｽｰﾊﾟｰ',['ス']],['か\u3099',[]],['カ\u3099',[]],['かなカナ',['か','な','カ','ナ']]]){
    assert.deepEqual(matches(text,'ja'),expected.sort(),text);
  }
  assert.equal(wordContainsLetter({language:'ja',text:'が'},'が'),false,'Only the basic 46+46 are selectable');
});
test('漢字只依完整詞庫假名；不猜讀音，不從中文或個人記音取假名',()=>{
  assert.deepEqual(matches('今日','ja','きょう'),['き','う'].sort());
  assert.deepEqual(matches('日','ja','ニチ'),['ニ','チ'].sort());
  for(const reading of [null,'お茶','ocha'])assert.deepEqual(matches('お茶','ja',reading),[]);
  assert.equal(wordContainsLetter({language:'ja',text:'猫',reading:null,meaning_zh:'ねこ',personal_mnemonic:'ねこ'},'ね'),false);
  assert.equal(wordContainsLetter(get(ja,'すいか'),'す'),true);
  assert.equal(wordContainsLetter(get(ko,'라면'),'ㄹ'),true);
});
test('繁簡搜尋交集、字母與排序可並用，整份來源資料及 ID／記音／審核狀態不變',()=>{
  const before=JSON.stringify({ja,ko});
  const find=query=>filterByLetter(sortAndFilterWords(searchEntries(ko,query),'ko','alphabet'),'ㅁ');
  assert.deepEqual(find('无聊').map(entry=>entry.id),find('無聊').map(entry=>entry.id));
  assert.deepEqual(find('無聊').map(entry=>entry.text),['심심하다']);
  assert.deepEqual(filterByLetter(searchEntries(ja,'什么'),'に').map(entry=>entry.text),['なに']);
  assert.deepEqual(filterByLetter(searchEntries(ja,'魚'),'に'),[]);
  assert.equal(JSON.stringify({ja,ko}),before);
});
