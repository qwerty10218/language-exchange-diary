// Word browsing should not confuse original vocabulary order with its reading.
const koreanOnsets=[...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const koGroups=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','其他'];
const jaGroups=['あ','か','さ','た','な','は','ま','や','ら','わ','其他'];
const foldOnset={ㄲ:'ㄱ',ㄸ:'ㄷ',ㅃ:'ㅂ',ㅆ:'ㅅ',ㅉ:'ㅈ'};
export function wordGroups(language){return language==='ja'?jaGroups:koGroups;}
function kanaReading(entry){
  return (entry.reading||entry.text||'').trim().normalize('NFKC').replace(/[\u30A1-\u30F6]/g,ch=>String.fromCodePoint(ch.codePointAt(0)-0x60));
}
export function wordGroup(entry){
  if(entry.language==='ja'){
    const letter=Array.from(kanaReading(entry).normalize('NFD'))[0]||'';
    if(/[あいうえおぁぃぅぇぉ]/u.test(letter))return 'あ';
    if(/[かきくけこ]/u.test(letter))return 'か';
    if(/[さしすせそ]/u.test(letter))return 'さ';
    if(/[たちつてとっ]/u.test(letter))return 'た';
    if(/[なにぬねの]/u.test(letter))return 'な';
    if(/[はひふへほ]/u.test(letter))return 'は';
    if(/[まみむめも]/u.test(letter))return 'ま';
    if(/[やゆよゃゅょ]/u.test(letter))return 'や';
    if(/[らりるれろ]/u.test(letter))return 'ら';
    if(/[わゐゑをん]/u.test(letter))return 'わ';
    return '其他';
  }
  const initial=Array.from(entry.text||'')[0]||'';
  const code=initial.codePointAt(0)||0;
  const onset=code>=0xac00&&code<=0xd7a3?koreanOnsets[Math.floor((code-0xac00)/588)]:initial;
  const folded=foldOnset[onset]??onset;
  return koGroups.includes(folded)?folded:'其他';
}
export function sortAndFilterWords(entries,language,sort='original',group='all'){
  const filtered=entries.filter(e=>group==='all'||wordGroup(e)===group);
  if(sort==='recent')return filtered.slice().reverse();
  if(sort!=='alphabet')return filtered;
  const collation=new Intl.Collator(language==='ja'?'ja':'ko',{sensitivity:'variant',numeric:true});
  return filtered.slice().sort((a,b)=>{
    const ak=language==='ja'?kanaReading(a):a.text;
    const bk=language==='ja'?kanaReading(b):b.text;
    return collation.compare(ak,bk)||collation.compare(a.text,b.text);
  });
}
