// Explicit maintenance command; never run by the browser or normal build.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { svgPathProperties } from 'svg-path-properties';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
export const revision = '70a0b7ae0c18ceb5cb358274b029cce0234a43bc';
export function convertKana(svg, code) {
  if (!svg.includes('viewBox="0 0 109 109"') || !svg.includes('Ulrich Apel')) throw Error('Unexpected SVG or missing attribution');
  const paths = [...svg.matchAll(new RegExp(`<path id="kvg:${code}-s(\\d+)"[^>]*? d="([^"]+)"`, 'g'))];
  if (!paths.length || paths.some((m,i) => +m[1] !== i+1)) throw Error('Missing or unordered strokes');
  return paths.map(m => {
    // All supported commands use linear coordinates. Arc flags/radii must not be scaled this way.
    if (/[^MmLlHhVvCcSsQqTtZz\d\s,.+\-eE]/.test(m[2]) || /[aA]/.test(m[2])) throw Error('Unsupported SVG command');
    return m[2].replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi, n => String(+(Number(n)*1024/109).toFixed(6)));
  });
}
export function startsFor(paths) {
  return paths.map(d => {
    const p = new svgPathProperties(d), a=p.getPointAtLength(0), b=p.getPointAtLength(Math.min(18,p.getTotalLength()*.08));
    const length=Math.hypot(b.x-a.x,b.y-a.y);
    if (!length) throw Error('No initial direction');
    return [a.x,a.y,(b.x-a.x)/length*60,(b.y-a.y)/length*60];
  });
}
export async function run(fetchSources = false) {
  const inventory=JSON.parse(await fs.readFile(new URL('data/character_inventory.json',root),'utf8'));
  const legacy=JSON.parse(await fs.readFile(new URL('data/phase0.strokes.json',root),'utf8')).characters;
  const readings=JSON.parse(await fs.readFile(new URL('data/alphabet-readings.json',root),'utf8'));
  const hangul=JSON.parse(await fs.readFile(new URL('data/hangul.strokes.json',root),'utf8')).characters;
  const characters=[];
  const sourceDir=new URL('public/strokes/kanjivg/',root); await fs.mkdir(sourceDir,{recursive:true});
  for (const [category, chars] of Object.entries(inventory.groups)) for (const display of chars) {
    const language=category.startsWith('ja')?'ja':'ko';
    const code=display.codePointAt(0).toString(16).padStart(5,'0');
    const previous=legacy.find(c=>c.display===display);
    const c={id:previous?.id??`${language}-${code}`,display,language,category,label:{ko_consonants:'韓文子音',ko_vowels:'韓文母音',ja_hiragana:'平假名',ja_katakana:'片假名'}[category],...readings[display],paths:[],starts:[],strokeCount:null,order:[],directions:[],source:null,license:null,creator:null,sourceHash:null,sourceFile:null,humanStatus:'pending',technicalStatus:'pending',issues:[],missingReason:null};
    try {
      if(language==='ja') {
        const file=new URL(`${code}.svg`,sourceDir);
        if(fetchSources) {
          try { await fs.access(file); } catch {
            const res=await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/${revision}/kanji/${code}.svg`);
            if(!res.ok) throw Error(`Source HTTP ${res.status}`);
            const raw=await res.text(); convertKana(raw,code); await fs.writeFile(file,raw);
          }
        }
        const svg=await fs.readFile(file,'utf8'); c.paths=previous?.paths??convertKana(svg,code);
        c.source=`https://github.com/KanjiVG/kanjivg/blob/${revision}/kanji/${code}.svg`;
        c.sourceFile=`/strokes/kanjivg/${code}.svg`; c.sourceHash=createHash('sha256').update(svg).digest('hex');
        c.license='CC-BY-SA-3.0'; c.creator='Ulrich Apel / KanjiVG contributors';
        c.modification='原始曲線、筆序與方向不變；109 方框等比例換算至 1024，取六位小數。衍生資料同 CC BY-SA 3.0。';
      } else if(hangul.some(h=>h.display===display)) {
        Object.assign(c,hangul.find(h=>h.display===display));
      } else if(previous) {
        Object.assign(c,{paths:previous.paths,source:previous.source,license:previous.license,creator:previous.creator,modification:previous.modification,sourceFile:'/strokes/sources/15_a.svg'});
        c.sourceHash=createHash('sha256').update(await fs.readFile(new URL('public/strokes/sources/15_a.svg',root))).digest('hex');
      } else {
        c.missingReason='現有韓文字母來源是字型外框與筆順箭頭，沒有可信逐筆中心線；未推測路徑。';
        c.reference='https://github.com/MagisterAdamus/hangeul-stroke-order/tree/935483f7e93d24aa2ec990bca1b43664307768d2';
      }
      if(c.paths.length) {
        c.starts=previous?.starts??startsFor(c.paths); c.strokeCount=c.paths.length;
        c.order=c.paths.map((_,i)=>i+1); c.directions=c.starts.map(p=>({from:[p[0],p[1]],vector:[p[2],p[3]]}));
      }
    } catch(error) { c.paths=[];c.starts=[];c.missingReason=String(error.message); }
    characters.push(c);
  }
  await fs.writeFile(new URL('data/writing-index.json',root),JSON.stringify({version:1,viewBox:'0 0 1024 1024',note:'技術通過不等同人工字形與筆順驗證。缺少中心線者無書寫入口。',characters},null,2)+'\n');
  console.log(`Index: ${characters.length}; paths: ${characters.filter(c=>c.paths.length).length}`);
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await run(process.argv.includes('--fetch'));
