import index from '../data/writing-index.json';
export type WritingCharacter = {
  id:string; display:string; language:'ja'|'ko'; category:string; label:string;
  reading:string; romanization:string; soundExample?:string; pronunciationNote:string; readingSource:string;
  paths:string[]; starts:number[][]; strokeCount:number|null; order:number[];
  directions:{from:number[];vector:number[]}[]; strokeTypes:string[][];
  source:string|null; license:string|null; creator:string|null; sourceHash:string|null; sourceFile:string|null;
  modification?:string; humanStatus:'pending'|'verified'; technicalStatus:'pending'|'passed'|'failed';
  issues:string[]; missingReason:string|null; tests?:Record<string,boolean>;
  strokeFrames?:{sx:number;sy:number;tx:number;ty:number;sourceId:string;sourceIndex:number}[];
  components?:{display:string;creator:string|null;license:string|null;source:string|null}[];
};
export const writingCharacters = index.characters as WritingCharacter[];
export const canPractice = (c: WritingCharacter) => c.paths.length>0 && c.technicalStatus==='passed';
