import dictionary from '../data/zh-hant-to-hans.json' with {type:'json'};

// OpenCC (Apache-2.0), bundled for reliable offline conversion.
// Call only for Chinese display fields; source vocabulary and mnemonics stay literal.
const phraseEntries=Object.entries(dictionary.phrases).sort((a,b)=>b[0].length-a[0].length);
const phrasePattern=new RegExp(phraseEntries.map(([s])=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+'|[\\s\\S]','gu');
export const SCRIPT_KEY='language-exchange-diary:chinese-script:v1';
export function toSimplified(value) {
  const original=String(value??'');
  // One longest-match pass: do not re-convert protected phrase outputs (e.g. 乾隆).
  return original.replace(phrasePattern,match=>dictionary.phrases[match]??dictionary.chars[match]??match);
}
export function loadScript(getStorage=()=>localStorage){
  try { return getStorage().getItem(SCRIPT_KEY)==='hans'?'hans':'hant'; } catch {return 'hant';}
}
export function saveScript(mode,getStorage=()=>localStorage){
  try{getStorage().setItem(SCRIPT_KEY,mode);}catch{} // Remain usable in private browsing.
}
// Notes can contain Japanese kanji after 漢字：. Keep that source fragment literal.
export function chineseNote(value) {
  return String(value??'').split(/(漢字[：:]\s*[^；。;\n]+|「[^」]*[\p{Script=Hiragana}\p{Script=Katakana}][^」]*」)/u).map((part,i)=>i%2?part.replace(/^漢字/, '汉字'):toSimplified(part)).join('');
}
