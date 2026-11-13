import {useChinese} from './Chinese';
import { useEffect, useRef, useState } from 'react';
import { writingCharacters, canPractice } from './writing';
import type {WritingCharacter} from './writing';
import type { Language } from './types';
import type { Entry } from './types';
import { kanaGrid } from './word-letters.mjs';
import SpeechButton from './SpeechButton';
type Props={visible?:boolean;language:Language;onWrite:(id:string)=>void;linkedWord?:Entry|null;linkedLetters?:{text:string;letters:string[];unsupported:string[]}|null;onReturn?:()=>void;onQuiz?:()=>void};
export default function Alphabet({visible=true,language,onWrite,linkedWord,linkedLetters,onReturn,onQuiz}:Props) {
  const {t}=useChinese();
  const [selected,setSelected]=useState<string|null>(null);
  const character=writingCharacters.find(c=>c.id===selected && c.language===language);
  const detail=useRef<HTMLElement>(null);
  useEffect(()=>{ if(visible&&character) { detail.current?.focus({preventScroll:true});detail.current?.scrollIntoView({block:'nearest',behavior:'auto'}); } },[selected,language,visible]);
  const groups=language==='ja'?[['ja_hiragana',t('平假名 · 46')],['ja_katakana',t('片假名 · 46')]]:[['ko_consonants',t('子音 · 19')],['ko_vowels',t('母音 · 21')]];
  return <section aria-label={language==='ja'?t('完整五十音表'):t('完整韓文 40 音表')} className="alphabet-panel">
    <div className="alphabet-return">{onReturn&&<button onClick={onReturn}>{t("← 返回單字")}</button>}<button onClick={onQuiz}>{t("返回測驗 →")}</button></div>
    {linkedWord&&linkedLetters&&<section className="linked-word-note" aria-live="polite"><p>{t("正在查：")}<strong lang={language}>{linkedWord.text}</strong> · {t(linkedWord.meaning_zh)}</p>{linkedLetters.text!==linkedWord.text&&<p>{t("依詞庫讀音：")}<span lang={language}>{linkedLetters.text}</span></p>}<p>{t("◆ 紅色字母是這個詞使用的")}{language==='ja'?t('假名'):t('子音、母音與收音')}{t("，相同字母只標一次。")}</p>{linkedLetters.unsupported.length>0&&<p className="unsupported-letters">{t("基本表未收錄：")}<strong lang={language}>{linkedLetters.unsupported.join('、')}</strong>{t("。小假名、濁音、半濁音及長音符號會原樣列出，不轉標成其他字格。")}</p>}</section>}
    <p className="curation-note">{language==='ja'?t('基本假名共 92 字；五十音的空格不另造字，不含濁音與半濁音。'):t('完整 19 子音＋21 母音；字母名稱與音節實際發音分開顯示。')}{t("點選字母即可查看讀音。")}</p>
    {character && <section ref={detail} tabIndex={-1} className="alphabet-detail notebook-panel" aria-live="polite"><CharacterInfo character={character} onWrite={onWrite}/></section>}
    {groups.map(([category,label])=><section key={category} className="alphabet-group"><h2>{t(label)}</h2>{language==='ja'&&<div className="alphabet-columns" aria-hidden="true">{['a','i','u','e','o'].map(v=><span key={v}>{v}</span>)}</div>}<div className="alphabet-grid">{kanaGrid(writingCharacters.filter(c=>c.category===category)).map((c,i)=>{if(!c)return <span key={`blank-${i}`} aria-hidden="true"/>;const linked=linkedLetters?.letters.includes(c.display)??false;return <button key={c.id} className={linked?'word-letter-highlight':undefined} data-linked={linked||undefined} aria-label={t`${c.display}，${c.romanization}${linked?t('，單字使用的字母'):''}`} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}><span lang={language}>{c.display}{linked&&<span className="linked-marker" aria-hidden="true">◆</span>}</span><small>{c.romanization}</small><span className="alphabet-state">{canPractice(c)?t('可試寫'):c.paths.length?t('待修正'):t('筆順待補')}</span></button>})}</div></section>)}
  </section>;
}

export function CharacterInfo({character,onWrite}:{character:WritingCharacter;onWrite:(id:string)=>void}) {
  const {t}=useChinese();
 const language=character.language;return <><h2 lang={language}>{character.display} <small>{t(character.label)}</small></h2><dl><dt>{character.category==='ko_consonants'?t('字母名稱'):t('讀音對照')}</dt><dd lang={language}>{character.reading}</dd><dt>{t("羅馬拼音")}</dt><dd>{character.romanization}</dd>{character.soundExample && <><dt>{t("音節例字")}</dt><dd lang="ko">{character.soundExample}</dd></>}</dl><p>{t(character.pronunciationNote)}</p><SpeechButton text={character.reading} language={language} label={character.category==='ko_consonants'?t`${character.display} 字母名稱`:character.display}/><p>{t("真人語音尚未收錄。")}</p>{canPractice(character)?<><button className="primary-button" onClick={()=>onWrite(character.id)}>{t("進入書寫練習")}</button><p className="device-note">{t("標準路徑已通過技術檢查；字形、筆順與真機手感仍待人工確認。")}</p></>:<p role="status">{character.paths.length?t('書寫待修正：技術檢查未通過，尚不開放練習。'):t('書寫待補：尚無可信的逐筆中心線。')}</p>}<a href={character.readingSource} target="_blank" rel="noreferrer">{t("讀音參考")}</a></>;
}
