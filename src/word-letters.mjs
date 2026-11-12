import inventory from '../data/character_inventory.json' with { type:'json' };
export const basicKana = [...inventory.groups.ja_hiragana,...inventory.groups.ja_katakana];
export const basicHangul = [...inventory.groups.ko_consonants,...inventory.groups.ko_vowels];
/** @template T @param {T[]} characters @returns {(T|null)[]} */
export function kanaGrid(characters) {
  if(characters.length!==46) return characters;
  return [...characters.slice(0,35),characters[35],null,characters[36],null,characters[37],...characters.slice(38,43),characters[43],null,null,null,characters[44],characters[45],null,null,null,null];
}
export function graphemes(text) {
  const value=String(text??'').normalize('NFC');
  return [...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(value)].map(part=>part.segment);
}
export function lookupText(entry) {
  // Keep the actual script when the original is already kana; never fold katakana into hiragana.
  return entry.language==='ja' && /\p{Script=Han}/u.test(entry.text) && entry.reading ? entry.reading : entry.text;
}
const initials=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const vowels=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const finals=['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export function wordLetters(entry) {
  const text=lookupText(entry), known=new Set(entry.language==='ja'?basicKana:basicHangul);
  const letters=[], unsupported=[];
  for(const token of graphemes(text)) {
    if(/^\s+$/u.test(token)) continue;
    const code=token.codePointAt(0);
    if(entry.language==='ko' && code>=0xac00 && code<=0xd7a3) {
      const offset=code-0xac00;
      letters.push(initials[Math.floor(offset/588)],vowels[Math.floor(offset%588/28)],...finals[offset%28]);
    } else if(known.has(token)) letters.push(token);
    else unsupported.push(token);
  }
  return {text,letters:[...new Set(letters)],unsupported:[...new Set(unsupported)]};
}
