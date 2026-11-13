import {useChinese} from './Chinese';
import { useMemo, useReducer, useState } from 'react';
import type { Entry, Language } from './types';
import { buildQuestions, chooseQuestion, emptyQuiz } from './quiz-model.mjs';
import { questionPool, quizSession, kanaKeys, hangulKeys, learningState, summarize } from './quiz-model.mjs';
import { graphemes, kanaGrid } from './word-letters.mjs';
import type { LearningRecords } from './study-types';
import SpeechButton from './SpeechButton';

const stateLabels={new:'新詞',practicing:'練習中',mastered:'已掌握',due:'待複習'};
type Props={entries:Entry[];language:Language;records:LearningRecords;preferredId:string|null;onGrade:(id:string,correct:boolean)=>void;onLookup:()=>void;storageError:string|null};
export default function Quiz({entries,language,records,preferredId,onGrade,onLookup,storageError}:Props) {
  const {t}=useChinese();
  const {questions,excluded}=useMemo(()=>buildQuestions(entries,language),[entries,language]);
  const [session,dispatch]=useReducer(quizSession,undefined,emptyQuiz);
  const [mode,setMode]=useState<'general'|'due'>('general');
  const [size,setSize]=useState(5);
  const [script,setScript]=useState<'hiragana'|'katakana'>('hiragana');
  const pool=questionPool(questions,records,mode);
  const stats=summarize(entries,records);
  const q=session.question;
  const start=()=>{
    const first=pool.find(p=>p.id===preferredId)??chooseQuestion(questions,records,{mode});
    if(!first) return;
    setScript(first.script==='katakana'?'katakana':'hiragana');
    dispatch({type:'start',question:first,total:Math.min(size,pool.length===1?1:size)});
  };
  const submit=()=>{
    const next=quizSession(session,{type:'submit'});
    if(next!==session && next.result?.counted && q) onGrade(q.id,next.result.correct);
    dispatch({type:'submit'});
  };
  const next=()=>{
    const question=chooseQuestion(questions,records,{lastId:q?.id??null,mode});
    if(question) setScript(question.script==='katakana'?'katakana':'hiragana');
    dispatch({type:'next',question});
  };
  const letters=kanaKeys(script);
  return <section className="quiz-panel" aria-label={language==='ja'?t('中文日文拼字測驗'):t('中文韓文拼字測驗')}>
    {(!q||session.finished)&&<div className="study-stats" aria-label={t("這份詞庫的學習統計")}><span><strong>{stats.correct}</strong>{t("答對")}</span><span><strong>{stats.wrong}</strong>{t("答錯")}</span><span><strong>{stats.mastered}</strong>{t("已掌握")}</span><span><strong>{stats.due}</strong>{t("待複習")}</span></div>}
    {storageError&&<p className="storage-warning" role="alert">{t(storageError)}</p>}
    {!q?<section className="notebook-panel quiz-setup"><p className="section-kicker">ONE WORD AT A TIME</p><h2>{t("看中文，把")}{language==='ja'?t('假名'):t('韓文')}{t("拼出來。")}</h2><p>{t("答錯的詞會多練幾次，連續答對 5 次後暫時休息，之後再安排複習。")}</p>
      <div className="choice-row"><button aria-pressed={mode==='general'} onClick={()=>setMode('general')}>{t("日常測驗")}</button><button aria-pressed={mode==='due'} onClick={()=>setMode('due')}>{t("到期複習")}</button></div>
      <fieldset><legend>{t("本輪題數")}</legend><div className="choice-row">{[5,10].map(n=><button key={n} aria-pressed={size===n} onClick={()=>setSize(n)}>{n}{t(" 題")}</button>)}</div></fieldset>
      <p>{pool.length}{t(" 個可出題詞條")}{pool.find(p=>p.id===preferredId)?t(' · 會先測驗剛才查看的單字'):''}</p>
      <button className="primary-button" disabled={!pool.length} onClick={start}>{t("開始測驗 →")}</button>
      {!pool.length&&<p role="status">{mode==='due'?t('目前沒有到期題目，可以切回日常測驗。'):t('目前可用詞已掌握或暫不出題。可以先查詞，或日後進行到期複習。')}</p>}
      <p className="device-note">{t("題目來自已收錄詞庫，內容仍待人工查核；粗口與中文題意重疊者不出題。")}</p>
    </section>:session.finished?<section className="notebook-panel" aria-live="polite"><h2>{t("這一輪，先到這裡。")}</h2><p>{t("完成 ")}{session.index}{t(" 題，首次作答答對 ")}{session.correct}{t(" 題。訂正不重複計分。")}</p><p>{t("錯題已加入加強練習；答對的詞會逐步延長複習間隔。")}</p><button className="primary-button" onClick={()=>dispatch({type:'setup'})}>{t("選擇下一輪")}</button></section>:<div className="spelling-workspace">
      <div className="quiz-heading"><p>{t("第 ")}{session.index}／{session.total}{t(" 題")}</p><button className="text-button" onClick={onLookup}>{t("查字母表")}</button></div>
      <progress aria-label={t("本輪測驗進度")} value={session.index-1+(session.result?1:0)} max={session.total}/>
      <section className={`notebook-panel spelling-card${session.result?session.result.correct?' answer-correct':' answer-wrong':''}`}>
        <p className="section-kicker">{t("請拼出")}{language==='ja'?(q.script==='katakana'?t('片假名'):q.script==='mixed'?t('原詞的平／片假名'):t('平假名')):t('韓文')}</p><h2 className="quiz-prompt">{t(q.prompt)}</h2>
        <div className="answer-slots" aria-live="polite" aria-label={t`目前答案：${session.answer||t('尚未輸入')}`} lang={language}>{q.tokens.map((_,i)=><span key={i} className={graphemes(session.answer)[i]?'filled':''}>{graphemes(session.answer)[i]===' '?'␣':graphemes(session.answer)[i]||'＿'}</span>)}</div>
        <p className="device-note">{t("共 ")}{q.tokens.length}{t(" 格，一格一個字元")}{language==='ja'?t('；小假名與「ー」各占一格'):t('，空白也占一格')}。</p>
        {language==='ko'&&<label className="hangul-input">{t("也可使用韓文鍵盤")}<input aria-label={t("輸入韓文答案")} lang="ko" value={session.answer} disabled={!!session.result} onChange={e=>dispatch({type:'input',answer:e.target.value})} autoComplete="off" autoCapitalize="off" spellCheck={false}/></label>}
        {!session.result?<div className="quiz-actions"><button disabled={!session.answer} onClick={()=>dispatch({type:'delete'})}>{t("⌫ 刪除上一字")}</button><button className="primary-button" disabled={graphemes(session.answer).length!==q.tokens.length} onClick={submit}>{t("確認答案")}</button></div>:<div className="quiz-feedback" role="status"><h3>{session.result.correct?t('✓ 答對了！'):t('✕ 還沒拼對，再試一次。')}</h3><p>{t("正確答案：")}<strong lang={language}>{q.answer}</strong></p>{q.entry.personal_mnemonic&&<p>{t("朋友的原始記音：")}<span data-preserve-script="true">{q.entry.personal_mnemonic}</span></p>}<p>{session.result.counted?t('已記錄本次答題結果。'):t('本題已記錄一次；訂正不重複計入統計。')}</p><div className="quiz-actions">{!session.result.correct&&<button onClick={()=>dispatch({type:'edit'})}>{t("修改再試")}</button>}<button className="primary-button" onClick={next}>{session.index>=session.total?t('查看本輪結果'):t('下一題 →')}</button></div></div>}
        {session.result&&<SpeechButton text={q.answer} language={language} label={t("本題正確答案")}/>}
      </section>
      <section className="quiz-keyboard" aria-label={language==='ja'?t('假名選擇區'):t('韓文音節選擇區')}>
        {language==='ja'?<><div className="choice-row"><button aria-pressed={script==='hiragana'} onClick={()=>setScript('hiragana')}>{t("平假名")}</button><button aria-pressed={script==='katakana'} onClick={()=>setScript('katakana')}>{t("片假名")}</button></div><div className="alphabet-grid">{kanaGrid(letters.basic).map((c,i)=>c===null?<span key={`blank-${i}`} aria-hidden="true"/>:<button key={c} lang="ja" aria-label={t`輸入 ${c}`} disabled={!!session.result} onClick={()=>dispatch({type:'add',character:c})}>{c}</button>)}</div><details className="extra-kana" open={q.tokens.some(c=>letters.extra.includes(c))}><summary>{t("濁音、半濁音、小假名與長音符號")}</summary><div className="alphabet-grid">{letters.extra.map(c=><button key={c} lang="ja" aria-label={t`輸入 ${c}`} disabled={!!session.result} onClick={()=>dispatch({type:'add',character:c})}>{c}</button>)}</div></details></>:<><p className="device-note">{t("點選音節組字，或使用上方韓文鍵盤；單字的子音／母音拆解可到 40 音表查看。")}</p><div className="alphabet-grid hangul-keyboard">{hangulKeys(q,questions).map(c=><button key={c} lang="ko" aria-label={t`輸入 ${c===' '?t('空白'):c}`} disabled={!!session.result} onClick={()=>dispatch({type:'add',character:c})}>{c===' '?t('空白'):c}</button>)}</div></>}
      </section>
    </div>}
    <details className="study-records"><summary>{t("查看每個單字的學習紀錄")}</summary><p>{t("新詞 ")}{stats.new}{t(" · 練習中 ")}{stats.practicing}{t("；間隔 1、3、7、14、30 天。舊翻卡記錄保留，不視為拼字答對。")}</p><ul>{entries.map(entry=>{const r=records[entry.id];return <li key={entry.id}><strong lang={language}>{entry.text}</strong><span>{t(stateLabels[learningState(r) as keyof typeof stateLabels])}{t(" · 對 ")}{r?.correct??0}{t("／錯 ")}{r?.wrong??0}{t("／連對 ")}{r?.streak??0}</span><small>{t("最近：")}{r?.lastPracticed?new Date(r.lastPracticed).toLocaleString('zh-TW'):t('尚未測驗')}{t(" · 下次：")}{r?.nextReview===0?t('待複習'):r?.nextReview!=null?new Date(r.nextReview).toLocaleString('zh-TW'):t('尚未安排')}</small></li>})}</ul></details>
    {excluded.length>0&&<details className="study-records"><summary>{excluded.length}{t(" 個詞暫不出題")}</summary><ul>{excluded.map(item=><li key={item.id}>{entries.find(e=>e.id===item.id)?.text}：{t(item.reason)}</li>)}</ul></details>}
    <p className="device-note">{t("學習紀錄只存於這台裝置；查表不計分。切換查表會保留本題，重新整理會結束未完成的題組。")}</p>
  </section>;
}
