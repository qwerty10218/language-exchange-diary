import inventory from '../data/character_inventory.json' with {type:'json'};
import {graphemes} from './word-letters.mjs';
export const letterTabs={
  ja:[
    {id:'hiragana',label:'平假名',letters:inventory.groups.ja_hiragana},
    {id:'katakana',label:'片假名',letters:inventory.groups.ja_katakana},
  ],
  ko:[
    {id:'consonants',label:'子音（19）',letters:inventory.groups.ko_consonants},
    {id:'vowels',label:'母音（21）',letters:inventory.groups.ko_vowels},
  ],
};
// Unicode modern Hangul L/V/T order; inventory's teaching vowel order differs.
const initials=inventory.groups.ko_consonants;
const vowels=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const finals=['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const available={ja:new Set(letterTabs.ja.flatMap(tab=>tab.letters)),ko:new Set(letterTabs.ko.flatMap(tab=>tab.letters))};
function hangulComponents(value){
  const letters=new Set();
  // NFKC accepts compatibility/halfwidth jamo; NFC composes canonical sequences.
  // Neither form splits compound vowels or tense consonants.
  for(const token of String(value??'').normalize('NFKC').normalize('NFC')){
    const code=token.codePointAt(0);
    if(code>=0xac00&&code<=0xd7a3){
      const offset=code-0xac00;
      letters.add(initials[Math.floor(offset/588)]);
      letters.add(vowels[Math.floor(offset%588/28)]);
      for(const final of finals[offset%28])letters.add(final);
    } else if(code>=0x1100&&code<=0x1112)letters.add(initials[code-0x1100]);
    else if(code>=0x1161&&code<=0x1175)letters.add(vowels[code-0x1161]);
    else if(code>=0x11a8&&code<=0x11c2)for(const final of finals[code-0x11a7])letters.add(final);
  }
  return letters;
}
export function wordContainsLetter(entry,letter){
  if(!letter)return true;
  if(!available[entry.language]?.has(letter))return false;
  if(entry.language==='ko')return hangulComponents(entry.text).has(letter);
  const text=String(entry.text??'');
  // Kanji uses only the supplied complete kana reading, never inferred readings,
  // Chinese meanings, romaji or mnemonics. Review status remains unchanged.
  const reading=(/\p{Script=Han}/u.test(text)?String(entry.reading??''):text).normalize('NFKC').normalize('NFC');
  if(!/^[\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{Z}ー]+$/u.test(reading))return false;
  // Keep が/ぱ/ゃ/っ/ー distinct from か/は/や/つ/お; never fold kana scripts.
  return graphemes(reading).includes(letter);
}
export function filterByLetter(entries,letter){
  return letter?entries.filter(entry=>wordContainsLetter(entry,letter)):[...entries];
}
