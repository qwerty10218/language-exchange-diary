import { useEffect, useRef, useState } from 'react';
import { writingCharacters, canPractice } from './writing';
import type {WritingCharacter} from './writing';
import type { Language } from './types';
import type { Entry } from './types';
import { kanaGrid } from './word-letters.mjs';
import SpeechButton from './SpeechButton';
type Props={language:Language;onWrite:(id:string)=>void;linkedWord?:Entry|null;linkedLetters?:{text:string;letters:string[];unsupported:string[]}|null;onReturn?:()=>void;onQuiz?:()=>void};
export default function Alphabet({language,onWrite,linkedWord,linkedLetters,onReturn,onQuiz}:Props) {
  const [selected,setSelected]=useState<string|null>(null);
  const character=writingCharacters.find(c=>c.id===selected && c.language===language);
  const detail=useRef<HTMLElement>(null);
  useEffect(()=>{ if(character) { detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:'nearest',behavior:'auto'}); } },[selected,language]);
  const groups=language==='ja'?[['ja_hiragana','平假名 · 46'],['ja_katakana','片假名 · 46']]:[['ko_consonants','子音 · 19'],['ko_vowels','母音 · 21']];
  return <section aria-label={language==='ja'?'完整五十音表':'完整韓文 40 音表'} className="alphabet-panel">
    <div className="alphabet-return"><button onClick={onReturn}>← 返回單字</button><button onClick={onQuiz}>返回測驗 →</button></div>
    {linkedWord&&linkedLetters&&<section className="linked-word-note" aria-live="polite"><p>正在查：<strong lang={language}>{linkedWord.text}</strong> · {linkedWord.meaning_zh}</p>{linkedLetters.text!==linkedWord.text&&<p>依詞庫讀音：<span lang={language}>{linkedLetters.text}</span></p>}<p>◆ 紅色字母是這個詞使用的{language==='ja'?'假名':'子音、母音與收音'}，相同字母只標一次。</p>{linkedLetters.unsupported.length>0&&<p className="unsupported-letters">基本表未收錄：<strong lang={language}>{linkedLetters.unsupported.join('、')}</strong>。小假名、濁音、半濁音及長音符號會原樣列出，不轉標成其他字格。</p>}</section>}
    <p className="curation-note">{language==='ja'?'基本假名共 92 字；五十音的空格不另造字，不含濁音與半濁音。':'完整 19 子音＋21 母音；字母名稱與音節實際發音分開顯示。'}點選字母即可查看讀音。</p>
    {character && <section ref={detail} tabIndex={-1} className="alphabet-detail notebook-panel" aria-live="polite"><CharacterInfo character={character} onWrite={onWrite}/></section>}
    {groups.map(([category,label])=><section key={category} className="alphabet-group"><h2>{label}</h2>{language==='ja'&&<div className="alphabet-columns" aria-hidden="true">{['a','i','u','e','o'].map(v=><span key={v}>{v}</span>)}</div>}<div className="alphabet-grid">{kanaGrid(writingCharacters.filter(c=>c.category===category)).map((c,i)=>{if(!c)return <span key={`blank-${i}`} aria-hidden="true"/>;const linked=linkedLetters?.letters.includes(c.display)??false;return <button key={c.id} className={linked?'word-letter-highlight':undefined} data-linked={linked||undefined} aria-label={`${c.display}，${c.romanization}${linked?'，單字使用的字母':''}`} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}><span lang={language}>{c.display}{linked&&<span className="linked-marker" aria-hidden="true">◆</span>}</span><small>{c.romanization}</small><span className="alphabet-state">{canPractice(c)?'可試寫':c.paths.length?'待修正':'筆順待補'}</span></button>})}</div></section>)}
  </section>;
}

export function CharacterInfo({character,onWrite}:{character:WritingCharacter;onWrite:(id:string)=>void}) {
 const language=character.language;return <><h2 lang={language}>{character.display} <small>{character.label}</small></h2><dl><dt>{character.category==='ko_consonants'?'字母名稱':'讀音對照'}</dt><dd lang={language}>{character.reading}</dd><dt>羅馬拼音</dt><dd>{character.romanization}</dd>{character.soundExample && <><dt>音節例字</dt><dd lang="ko">{character.soundExample}</dd></>}</dl><p>{character.pronunciationNote}</p><SpeechButton text={character.reading} language={language} label={character.category==='ko_consonants'?`${character.display} 字母名稱`:character.display}/><p>真人語音尚未收錄。</p>{canPractice(character)?<><button className="primary-button" onClick={()=>onWrite(character.id)}>進入書寫練習</button><p className="device-note">標準路徑已通過技術檢查；字形、筆順與真機手感仍待人工確認。</p></>:<p role="status">{character.paths.length?'書寫待修正：技術檢查未通過，尚不開放練習。':'書寫待補：尚無可信的逐筆中心線。'}</p>}<a href={character.readingSource} target="_blank" rel="noreferrer">讀音參考</a></>;
}
