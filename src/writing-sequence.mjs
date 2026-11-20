import {graphemes,basicKana,basicHangul} from './word-letters.mjs';
const initials=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const vowels=[...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const finals=['','ㄱ','ㄲ','ㄱㅅ','ㄴ','ㄴㅈ','ㄴㅎ','ㄷ','ㄹ','ㄹㄱ','ㄹㅁ','ㄹㅂ','ㄹㅅ','ㄹㅌ','ㄹㅍ','ㄹㅎ','ㅁ','ㅂ','ㅂㅅ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
// Separate from lookup's Set: every occurrence represents a distinct exercise.
export function writingSequence(entry) {
  const kanji=entry.language==='ja'&&/\p{Script=Han}/u.test(entry.text);
  const text=kanji?(entry.reading||''):entry.text;
  const known=new Set(entry.language==='ja'?basicKana:basicHangul),letters=[],unsupported=[];
  if(kanji&&(!text||!graphemes(text).every(token=>/^[\p{Script=Hiragana}\p{Script=Katakana}ー\s]+$/u.test(token))))return {letters,unsupported:[entry.text],text};
  for(const token of graphemes(text)){
    if(/^\s+$/u.test(token))continue;
    const code=token.codePointAt(0),offset=code-0xac00;
    if(entry.language==='ko'&&offset>=0&&offset<=11171)letters.push(initials[Math.floor(offset/588)],vowels[Math.floor(offset%588/28)],...finals[offset%28]);
    else if(known.has(token))letters.push(token);
    else unsupported.push(token);
  }
  return {letters,unsupported,text};
}
