import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {composeSyllable,syllableParts,syllableLayout,transformPoint,inversePoint} from '../src/hangul-blocks.mjs';
import {createBlockStroke} from '../src/block-tracing.mjs';
const characters=JSON.parse(fs.readFileSync(new URL('../data/writing-index.json',import.meta.url),'utf8')).characters;
test('syllable blocks retain initial, vowel and ordered final clusters',()=>{
  assert.deepEqual(syllableParts('다'),{initial:'ㄷ',vowel:'ㅏ',final:[]});
  assert.deepEqual(syllableParts('면'),{initial:'ㅁ',vowel:'ㅕ',final:['ㄴ']});
  assert.deepEqual(syllableParts('값'),{initial:'ㄱ',vowel:'ㅏ',final:['ㅂ','ㅅ']});
  assert.deepEqual(syllableParts('꽉'),{initial:'ㄲ',vowel:'ㅘ',final:['ㄱ']});
  for(const text of ['ㅏ','가나','a','힤!'])assert.equal(syllableParts(text),null);
});
test('vertical, horizontal, mixed vowels and bottom finals have separate spatial slots',()=>{
  const vertical=syllableLayout('다'),horizontal=syllableLayout('우'),mixed=syllableLayout('권');
  assert.ok(vertical[0].box[0]+vertical[0].box[2]<vertical[1].box[0]);
  assert.ok(horizontal[0].box[1]+horizontal[0].box[3]<horizontal[1].box[1]);
  assert.deepEqual(mixed.map(c=>c.letter),['ㄱ','ㅜ','ㅓ','ㄴ']);
  assert.ok(mixed.at(-1).box[1]>mixed[2].box[1]+mixed[2].box[3]);
  const cluster=syllableLayout('값');assert.deepEqual(cluster.slice(-2).map(c=>c.letter),['ㅂ','ㅅ']);assert.ok(cluster.at(-2).box[0]<cluster.at(-1).box[0]);
});
test('composed paths keep source stroke order, attributions and inverse geometry',()=>{
  const before=JSON.stringify(characters),block=composeSyllable('라',characters);
  assert.equal(block.display,'라');assert.equal(block.humanStatus,'pending');assert.equal(block.technicalStatus,'pending');
  assert.deepEqual(block.components.map(c=>c.display),['ㄹ','ㅏ']);
  for(const frame of block.strokeFrames){const p={x:357.25,y:489.75},restored=inversePoint(transformPoint(p,frame),frame);assert.ok(Math.abs(restored.x-p.x)<1e-8);assert.ok(Math.abs(restored.y-p.y)<1e-8);}
  assert.ok(block.components.every(c=>c.source&&c.license&&c.creator));assert.equal(JSON.stringify(characters),before);
  const circle=composeSyllable('우',characters).strokeFrames[0];assert.ok(Math.max(circle.sx/circle.sy,circle.sy/circle.sx)<=1.100001,'Round consonants must not be flattened into bars');
});
test('failed components and unknown path commands cannot silently become usable blocks',()=>{
  const failed=characters.map(c=>c.display==='ㄷ'?{...c,technicalStatus:'failed'}:c);assert.equal(composeSyllable('다',failed),null);
  const invalid=characters.map(c=>c.display==='ㄷ'?{...c,paths:['M1 1 Q2 3 4 5']}:c);assert.throws(()=>composeSyllable('다',invalid),/Unsupported/);
});
test('visual fill follows the transformed curve while judging stays in source space',()=>{
  const frame={sx:.5,sy:2,tx:100,ty:100};
  const original=[...Array.from({length:101},(_,i)=>({x:100+i*2,y:100})),...Array.from({length:100},(_,i)=>({x:300,y:102+i*2}))];
  const rendered=original.map(p=>transformPoint(p,frame)),trace=createBlockStroke([rendered],0,frame,{});
  trace.start(rendered[0]);rendered.slice(1,101).forEach(p=>trace.add(p));
  assert.ok(Math.abs(trace.progress-.2)<.025,'First horizontal leg is 20% of the visible path, not 50%');
  assert.equal(trace.finish().ok,false,'Drawing only the first leg must not complete the stroke');
});
test('word practice advances by Korean syllable, while lookup and standalone jamo stay unchanged',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  try{
    const {wordWritingUnits}=await server.ssrLoadModule('/src/writing-units.ts');
    const entry=(text,language='ko',reading=null)=>({text,language,reading});
    for(const [text,units] of [['라면',['라','면']],['우동',['우','동']],['다다',['다','다']],['값',['값']]])assert.deepEqual(wordWritingUnits(entry(text)).supported.map(c=>c.display),units);
    assert.deepEqual(wordWritingUnits(entry('우동'.normalize('NFD'))).supported.map(c=>c.display),['우','동']);
    assert.deepEqual(wordWritingUnits(entry('ㅏ')).supported.map(c=>c.display),['ㅏ']);
    assert.deepEqual(wordWritingUnits(entry('なに','ja')).supported.map(c=>c.display),['な','に']);
    assert.deepEqual(wordWritingUnits(entry('魚','ja','さかな')).supported.map(c=>c.display),['さ','か','な']);
    assert.deepEqual(wordWritingUnits(entry('힣!')).unsupported,['힣','!']);
    assert.deepEqual(wordWritingUnits(entry('う','ja')).supported,[]);
  }finally{await server.close();}
});
