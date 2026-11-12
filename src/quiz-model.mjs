import inventory from '../data/character_inventory.json' with { type:'json' };
import { graphemes } from './word-letters.mjs';
export const LEARNING_KEY='language-exchange-diary:learning:v2';
const LEGACY_KEY='language-exchange-diary:review:v1';
const DAY=86400000;
/** @typedef {{correct:number,wrong:number,streak:number,lastPracticed:number|null,nextReview:number|null,state:'new'|'practicing'|'mastered'|'due',legacyReview?:'remembered'|'forgotten'}} LearningRecord */
/** @typedef {Record<string,LearningRecord>} LearningRecords */
/** @typedef {{id:string,entry:any,prompt:string,answer:string,tokens:string[],script:'hiragana'|'katakana'|'mixed'|'hangul'}} Question */
/** @returns {LearningRecord} */
export function newRecord() { return {correct:0,wrong:0,streak:0,lastPracticed:null,nextReview:null,state:'new'}; }
export function learningState(record,now=Date.now()) {
  if(!record) return 'new';
  if(record.nextReview!==null && record.nextReview<=now) return 'due';
  if(record.streak>=5) return 'mastered';
  return record.correct+record.wrong>0 || record.legacyReview ? 'practicing':'new';
}
/** @param {LearningRecords} records @returns {LearningRecords} */
export function gradeWord(records,id,correct,now=Date.now()) {
  if(!/^(ja|ko)-[a-z0-9-]+$/.test(id) || !Number.isFinite(now)) throw Error('Invalid grade');
  const previous=records[id]??newRecord(), streak=correct?previous.streak+1:0;
  const next={...previous,correct:previous.correct+(correct?1:0),wrong:previous.wrong+(correct?0:1),streak,lastPracticed:now,
    nextReview:correct?now+[1,3,7,14,30][Math.min(streak-1,4)]*DAY:now,
    state:correct?(streak>=5?'mastered':'practicing'):'due'};
  return {...records,[id]:/** @type {LearningRecord} */(next)};
}
export function summarize(entries,records,now=Date.now()) {
  const stats={correct:0,wrong:0,mastered:0,due:0,new:0,practicing:0};
  for(const entry of entries) {
    const r=records[entry.id];stats.correct+=r?.correct??0;stats.wrong+=r?.wrong??0;
    if(r?.streak>=5) stats.mastered++;
    const state=learningState(r,now);
    if(state!=='mastered') stats[state]++;
  }
  return stats;
}
export const normalizeAnswer=text=>String(text??'').normalize('NFKC').normalize('NFC').trim();
const aliases=text=>[...new Set(text.split(/[、；;，,]/u).map(s=>s.trim()).filter(Boolean))];
/** @returns {{questions:Question[],excluded:{id:string,reason:string}[]}} */
export function buildQuestions(entries,language) {
  const eligible=entries.filter(e=>e.language===language && e.text!=='ㅅㅂ' && e.kind!=='grammar');
  const candidates=eligible.map(entry=>{
    const answer=normalizeAnswer(language==='ja'?(entry.reading||entry.text):entry.text);
    const valid=language==='ja'?/^[\u3041-\u3096\u30a1-\u30faー]+$/u.test(answer):/^[가-힣]+(?: [가-힣]+)*$/u.test(answer);
    const hira=/[\u3041-\u3096]/u.test(answer),kata=/[\u30a1-\u30fa]/u.test(answer);
    return {entry,id:entry.id,answer,tokens:graphemes(answer),script:/** @type {Question['script']} */(language==='ko'?'hangul':hira&&kata?'mixed':kata?'katakana':'hiragana'),valid,meanings:aliases(entry.meaning_zh)};
  });
  const meanings=new Map();
  const baseMeanings=new Map();
  const baseMeaning=meaning=>meaning.replace(/[（(][^）)]*[）)]/gu,'').trim();
  for(const c of candidates) for(const meaning of c.meanings) {
    const answers=meanings.get(meaning)??new Set();answers.add(c.answer);meanings.set(meaning,answers);
    const base=baseMeaning(meaning),variants=baseMeanings.get(base)??new Set();variants.add(c.answer);baseMeanings.set(base,variants);
  }
  const questions=[],excluded=[];
  for(const c of candidates) {
    // An unqualified 謝謝 also overlaps 謝謝（禮貌）. Keep explicit register prompts;
    // do not silently demand the plain form when a polite form is equally reasonable.
    const unique=c.meanings.filter(m=>meanings.get(m).size===1 && (baseMeaning(m)!==m || baseMeanings.get(m).size===1));
    if(!c.valid || !unique.length) { excluded.push({id:c.id,reason:!c.valid?'缺少可用的完整拼字讀音':'中文題意與其他詞條有重疊，暫不出題'});continue; }
    questions.push({id:c.id,entry:c.entry,prompt:unique.at(-1),answer:c.answer,tokens:c.tokens,script:c.script});
  }
  return {questions,excluded};
}
/** @param {Question[]} questions @param {LearningRecords} records @returns {Question[]} */
export function questionPool(questions,records,mode='general',now=Date.now()) {
  return questions.filter(q=>mode==='due'?records[q.id]?.nextReview!=null && records[q.id].nextReview<=now:(records[q.id]?.streak??0)<5);
}
export function questionWeight(record,now=Date.now()) {
  if(!record || record.correct+record.wrong===0) return record?.legacyReview==='forgotten'?6:2;
  return 1+(record.streak===0?5:0)+Math.min(4,Math.max(0,record.wrong-record.correct))+(learningState(record,now)==='due'?2:0);
}
/** @param {Question[]} questions @param {LearningRecords} records @param {{lastId?:string|null,mode?:string,now?:number,random?:()=>number}} options */
export function chooseQuestion(questions,records,{lastId=null,mode='general',now=Date.now(),random=Math.random}={}) {
  const pool=questionPool(questions,records,mode,now).filter(q=>q.id!==lastId);
  if(!pool.length) return null;
  const total=pool.reduce((n,q)=>n+questionWeight(records[q.id],now),0);
  let target=Math.max(0,Math.min(.999999999,random()))*total;
  for(const q of pool) { target-=questionWeight(records[q.id],now);if(target<0) return q; }
  return pool.at(-1);
}
/** @typedef {{question:Question|null,answer:string,result:null|{correct:boolean,counted:boolean},graded:boolean,index:number,total:number,correct:number,finished:boolean}} QuizSession */
/** @returns {QuizSession} */
export function emptyQuiz() { return {question:null,answer:'',result:null,graded:false,index:0,total:5,correct:0,finished:false}; }
/** @param {QuizSession} state @param {any} action @returns {QuizSession} */
export function quizSession(state,action) {
  switch(action.type) {
    case 'start': return {...emptyQuiz(),question:action.question,index:1,total:action.total};
    case 'add': return !state.result&&state.question&&graphemes(state.answer).length<state.question.tokens.length?{...state,answer:state.answer+action.character}:state;
    case 'input': return !state.result&&state.question?{...state,answer:graphemes(action.answer).slice(0,state.question.tokens.length).join('')}:state;
    case 'delete': return !state.result?{...state,answer:graphemes(state.answer).slice(0,-1).join('')}:state;
    case 'edit': return state.result&&!state.result.correct?{...state,result:null}:state;
    case 'submit': {
      if(!state.question || state.result || graphemes(normalizeAnswer(state.answer)).length!==state.question.tokens.length) return state;
      const correct=normalizeAnswer(state.answer)===state.question.answer;
      return {...state,graded:true,result:{correct,counted:!state.graded},correct:state.correct+(!state.graded&&correct?1:0)};
    }
    case 'next': return !state.result?state:state.index>=state.total||!action.question?{...state,finished:true}:{...state,question:action.question,answer:'',result:null,graded:false,index:state.index+1};
    case 'setup': return emptyQuiz();
    default:return state;
  }
}
export function kanaKeys(script) {
  const small=[...'ぁぃぅぇぉゃゅょっゎゔ'];
  const voiced=[...'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'];
  const kata=text=>String.fromCodePoint(text.codePointAt(0)+0x60);
  return script==='katakana'?{basic:inventory.groups.ja_katakana,extra:[...voiced,...small].map(kata).concat('ー')}:{basic:inventory.groups.ja_hiragana,extra:[...voiced,...small,'ー']};
}
export function hangulKeys(question,questions) {
  const required=graphemes(question.answer);
  const all=[...new Set([...required,...questions.flatMap(q=>graphemes(q.answer))])];
  const seed=[...question.id].reduce((sum,c)=>sum+c.codePointAt(0),0);
  const choices=[...new Set([...required,...all.slice(seed%Math.max(1,all.length-24),seed%Math.max(1,all.length-24)+24)])].slice(0,Math.max(24,new Set(required).size));
  return choices.sort((a,b)=>((a.codePointAt(0)*31+seed)%997)-((b.codePointAt(0)*31+seed)%997));
}
function validRecord(r) {
  return r&&typeof r==='object'&&['correct','wrong','streak'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&r.streak<=r.correct&&
    ['lastPracticed','nextReview'].every(k=>r[k]===null||typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>=0)&&
    ['new','practicing','mastered','due'].includes(r.state)&&(!('legacyReview'in r)||['remembered','forgotten'].includes(r.legacyReview));
}
/** @returns {{records:LearningRecords,error:string|null,readOnly:boolean}} */
export function loadLearning(getStorage) {
  try {
    const storage=getStorage(),raw=storage.getItem(LEARNING_KEY);
    /** @type {LearningRecords} */ const records={};
    if(raw!==null) {
      const data=JSON.parse(raw);
      if(!data||data.version!==2||!data.records||typeof data.records!=='object'||Array.isArray(data.records)) throw Error('版本或結構不支援');
      for(const [id,value] of Object.entries(data.records)) {
        if(!/^(ja|ko)-[a-z0-9-]+$/.test(id)||!validRecord(value)) throw Error('紀錄內容不支援');
        records[id]=value;
      }
    }
    let error=null;
    const legacy=storage.getItem(LEGACY_KEY);
    if(legacy!==null) try {
      const old=JSON.parse(legacy);
      if(old.version!==1||!old.entries||typeof old.entries!=='object'||Array.isArray(old.entries)) throw Error('unknown');
      for(const [id,value] of Object.entries(old.entries)) {
        if(!/^(ja|ko)-[a-z0-9-]+$/.test(id)||!['remembered','forgotten'].includes(value)) throw Error('invalid');
        if(!records[id]) records[id]={...newRecord(),state:value==='forgotten'?'due':'practicing',nextReview:value==='forgotten'?0:null,legacyReview:/** @type {'remembered'|'forgotten'} */(value)};
      }
    } catch { error='舊翻卡紀錄無法完整遷移，原始資料已保留；新測驗可另外記錄。'; }
    return {records,error,readOnly:false};
  } catch {
    return {records:{},readOnly:true,error:'學習紀錄無法讀取或版本較新；原資料不會覆寫。本次測驗暫存於畫面，重新整理後不保留。'};
  }
}
export function saveLearning(getStorage,records) {
  try {
    const storage=getStorage(),raw=storage.getItem(LEARNING_KEY);
    if(raw!==null) {
      const previous=JSON.parse(raw);
      if(previous?.version!==2 || !previous.records || typeof previous.records!=='object' || Array.isArray(previous.records) || !Object.values(previous.records).every(validRecord)) return '原學習資料格式已變更，已停止寫入以保留原紀錄。本次答案只暫存於畫面。';
    }
    if(!Object.values(records).every(validRecord)) return '學習紀錄未通過檢查，原資料未變更。';
    storage.setItem(LEARNING_KEY,JSON.stringify({version:2,records}));return null;
  }
  catch { return '瀏覽器無法儲存學習紀錄，本次仍可測驗，但重新整理後不保留。'; }
}
