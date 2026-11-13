import inventory from '../data/character_inventory.json' with {type:'json'};
import {wordLetters} from './word-letters.mjs';

// Exact visible Japanese kana; Korean syllables are decomposed by wordLetters.
// Compound Hangul vowels (e.g. ㅘ) remain distinct from ㅗ / ㅏ.
// Only complex final consonant clusters are split into their constituent jamo.
const hangulFinalClusters=new Set(['ㄱㅅ','ㄴㅈ','ㄴㅎ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅂㅅ']);
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
export function wordContainsLetter(entry,letter){
  if(!letter)return true;
  const components=wordLetters(entry).letters;
  if(components.includes(letter))return true;
  if(entry.language==='ko'&&inventory.groups.ko_consonants.includes(letter))
    return components.some(component=>hangulFinalClusters.has(component)&&component.includes(letter));
  return false;
}
export function filterByLetter(entries,letter){
  return letter?entries.filter(entry=>wordContainsLetter(entry,letter)):[...entries];
}
