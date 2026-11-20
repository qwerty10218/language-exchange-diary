import {writingCharacters,canPractice} from './writing';
import type {WritingCharacter} from './writing';
import {writingSequence} from './writing-sequence.mjs';
import {graphemes} from './word-letters.mjs';
import {composeSyllable,syllableParts} from './hangul-blocks.mjs';
import blockQA from '../data/hangul-block-qa.json';
import type {Entry} from './types';
const blocks=new Map<string,WritingCharacter>();
export function wordWritingUnits(entry:Entry){
  const supported:WritingCharacter[]=[],unsupported:string[]=[];
  if(entry.language==='ja'){
    const result=writingSequence(entry);unsupported.push(...result.unsupported);
    for(const letter of result.letters){const character=writingCharacters.find(c=>c.language==='ja'&&c.display===letter);if(character&&canPractice(character))supported.push(character);else unsupported.push(letter);}
  }else for(const token of graphemes(entry.text)){
    if(/^\s+$/u.test(token))continue;
    if(syllableParts(token)){
      const record=blockQA.characters.find(c=>c.display===token);
      if(record?.technicalStatus!=='passed'){unsupported.push(token);continue;}
      let character=blocks.get(token);
      if(!character){const composed=composeSyllable(token,writingCharacters);if(composed){character={...composed,technicalStatus:'passed'} as WritingCharacter;blocks.set(token,character);}}
      if(character)supported.push(character);else unsupported.push(token);
    }else{
      const character=writingCharacters.find(c=>c.language==='ko'&&c.display===token);
      if(character&&canPractice(character))supported.push(character);else unsupported.push(token);
    }
  }
  return {supported,unsupported};
}
