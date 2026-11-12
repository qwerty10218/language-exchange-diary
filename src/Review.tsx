import { useReducer, useState } from 'react';
import { emptySession, reviewSession } from './review-session.mjs';
import { reviewPool, reviewQueue } from './learning.mjs';
import type { Entry, Language } from './types';

type Progress = Record<string, 'remembered' | 'forgotten'>;
type Props = { entries: Entry[]; language: Language; progress: Progress; onAnswer: (id: string, status: 'remembered' | 'forgotten') => void; onBrowse: () => void };
export default function Review({ entries, language, progress, onAnswer, onBrowse }: Props) {
  const [limit, setLimit] = useState<number | 'all'>(5), [includeStrong, setIncludeStrong] = useState(false);
  const [{queue,index,revealed,remembered},dispatch]=useReducer(reviewSession,undefined,emptySession);
  const pool = reviewPool(entries, includeStrong) as Entry[];
  const start = () => dispatch({type:'start',queue:reviewQueue(pool, progress, limit)});
  const answer = (status: 'remembered' | 'forgotten') => {
    if (!queue || !revealed || !queue[index]) return;
    onAnswer(queue[index].id, status);
    dispatch({type:'answer',status});
  };
  if (!queue) return <section className="review-setup notebook-panel">
    <p className="section-kicker">A SMALL PRACTICE</p><h2>花幾分鐘，讓詞句留下來。</h2>
    <p>看原文，想一想中文意思。翻開答案後，再告訴自己記不記得。</p>
    <fieldset><legend>這次複習幾筆？</legend><div className="choice-row">{([5, 10, 'all'] as const).map(n => <button key={n} aria-pressed={limit === n} onClick={() => setLimit(n)}>{n === 'all' ? '全部' : `${n} 筆`}</button>)}</div></fieldset>
    {language === 'ko' && <label className="review-checkbox"><input type="checkbox" checked={includeStrong} onChange={e => setIncludeStrong(e.target.checked)}/>包含已標示的粗口縮寫（預設排除）</label>}
    <p className="muted">可複習 {pool.length} 筆 · 上次忘記的詞會先出現</p>
    <button className="primary-button" disabled={!pool.length} onClick={start}>開始這次複習 <span aria-hidden="true">→</span></button>
    {!pool.length && <p role="status">目前沒有可複習的詞條。<button className="text-button" onClick={onBrowse}>回詞庫看看</button></p>}
  </section>;
  if (index >= queue.length) return <section className="review-finished notebook-panel" aria-live="polite">
    <div className="finish-mark" aria-hidden="true">✓</div><p className="section-kicker">A LITTLE MORE FAMILIAR</p><h2>這一輪，先到這裡。</h2>
    <p>複習了 {queue.length} 筆：記得 {remembered} 筆，再練習 {queue.length - remembered} 筆。</p>
    <p className="muted">這份練習紀錄只屬於目前裝置，不會影響朋友的進度。</p>
    <div className="review-actions"><button className="primary-button" onClick={start}>再練一輪</button><button onClick={() => dispatch({type:'setup'})}>重新選題數</button><button className="text-button" onClick={onBrowse}>回到詞庫</button></div>
  </section>;
  const entry = queue[index];
  return <section className="review-session" aria-label="翻卡複習">
    <div className="review-session-heading"><p>第 {index + 1}／{queue.length} 筆</p><button className="text-button" onClick={() => dispatch({type:'setup'})}>結束這次練習</button></div>
    <progress aria-label="本輪複習進度" value={index} max={queue.length}/>
    <div className="flashcard notebook-panel">
      <p className="section-kicker">{language === 'ko' ? 'KOREAN' : 'JAPANESE'} · 想想中文意思</p>
      <h2 className="flashcard-word" lang={language}>{entry.text}</h2>
      {!revealed ? <><p className="muted">不急，先在心裡想一下。</p><button className="primary-button" aria-expanded="false" onClick={() => dispatch({type:'reveal'})}>翻開答案</button></> : <div className="flashcard-answer" aria-live="polite">
        <h3>{entry.meaning_zh || '詞義待確認'}</h3>
        {entry.reading && <p lang={language}>{entry.reading}</p>}
        {entry.personal_mnemonic && <p>個人記音：{entry.personal_mnemonic}</p>}
        <p className="muted">{entry.review_status === 'needs_review' ? '整理詞條，尚待逐項查核' : '已查核詞條'}</p>
        <div className="review-actions"><button onClick={() => answer('forgotten')}>忘記了，再練習</button><button className="primary-button" onClick={() => answer('remembered')}>記得</button></div>
      </div>}
    </div>
    <p className="device-note">只記錄在這台裝置 · 清除瀏覽器資料後會消失</p>
  </section>;
}
