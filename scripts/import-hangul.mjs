import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startsFor} from './import-writing.mjs';
const root=new URL('../',import.meta.url);
export async function importHangul(){
  const raw=await fs.readFile(new URL('public/strokes/hangul/strokefox-2026-11-04.json',root),'utf8');
  const source=JSON.parse(raw),hash=createHash('sha256').update(raw).digest('hex');
  if(hash!=='e80394afeef6abcc826bb5faa614fdd17f09899cf48e3d414f0a0df1c9def1f9')throw Error('Source bytes changed; review source and license before updating the pin');
  if(source.header.license!=='CC BY 4.0 (StrokeFox)'||Object.keys(source.data).length!==40)throw Error('Unexpected source/license');
  const inventory=JSON.parse(await fs.readFile(new URL('data/character_inventory.json',root),'utf8'));
  const legacy=JSON.parse(await fs.readFile(new URL('data/phase0.strokes.json',root),'utf8')).characters.find(c=>c.display==='ㅏ');
  const characters=[...inventory.groups.ko_consonants,...inventory.groups.ko_vowels].map(display=>{
    const record=source.data[display];if(!record?.d?.length)throw Error('Missing '+display);
    const paths=record.d.map(d=>d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,n=>String(+(Number(n)*1024/109).toFixed(6))));
    const c={display,paths,starts:startsFor(paths),strokeCount:paths.length,order:paths.map((_,i)=>i+1),
      source:'https://strokefox.com/data/ko-jamo-strokes.json.gz',sourceFile:'/strokes/hangul/strokefox-2026-11-04.json',sourceHash:hash,
      creator:'StrokeFox / BiLingoPlus LLC',license:'CC-BY-4.0',humanStatus:'pending',missingReason:null,
      sourceValidation:'Source-authored ordered centerlines; CC BY 4.0 checked; independent Korean teaching references reviewed; human teacher review pending.',
      modification:'保留來源 40 音逐筆中心線、順序與方向；109 方框等比例換算至 1024，六位小數。非字型輪廓猜測。',
      convention:'ㅈ／ㅊ採2／3筆連寫式；ㅉ為4筆。ㅇ／ㅎ圓圈由上方逆時針，雙子音由左至右，複合母音先左／上再右。',
      reference:'https://strokefox.com/hangul-stroke-order/',
    };
    if(display==='ㅏ')Object.assign(c,{paths:legacy.paths,starts:legacy.starts,source:legacy.source,license:legacy.license,creator:legacy.creator,modification:legacy.modification,sourceFile:'/strokes/sources/15_a.svg'});
    return c;
  });
  for(const c of characters){c.directions=c.starts.map(p=>({from:p.slice(0,2),vector:p.slice(2)}));if(c.display==='ㅏ')c.sourceHash=createHash('sha256').update(await fs.readFile(new URL('public/strokes/sources/15_a.svg',root))).digest('hex');}
  await fs.writeFile(new URL('data/hangul.strokes.json',root),JSON.stringify({version:1,sourceVersion:source.header.modified,sourceHash:hash,characters},null,2)+'\n');
  const file=new URL('data/writing-index.json',root),index=JSON.parse(await fs.readFile(file,'utf8'));
  index.characters=index.characters.map(c=>c.language==='ko'?{...c,...characters.find(h=>h.display===c.display)}:c);
  await fs.writeFile(file,JSON.stringify(index,null,2)+'\n');
  console.log('Imported 40 Hangul centerlines (39 StrokeFox + preserved Phase 0 ㅏ).');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await importHangul();
