import {useChinese} from './Chinese';
import { useReducer, useState } from 'react';
import { emptySession, reviewSession } from './review-session.mjs';
import { reviewPool, reviewQueue } from './learning.mjs';
import type { Entry, Language } from './types';

type Progress = Record<string, 'remembered' | 'forgotten'>;
type Props = { entries: Entry[]; language: Language; progress: Progress; onAnswer: (id: string, status: 'remembered' | 'forgotten') => void; onBrowse: () => void };
export default function Review({ entries, language, progress, onAnswer, onBrowse }: Props) {
  const {t}=useChinese();
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
    <p className="section-kicker">A SMALL PRACTICE</p><h2>{t("花幾分鐘，讓詞句留下來。")}</h2>
    <p>{t("看原文，想一想中文意思。翻開答案後，再告訴自己記不記得。")}</p>
    <fieldset><legend>{t("這次複習幾筆？")}</legend><div className="choice-row">{([5, 10, 'all'] as const).map(n => <button key={n} aria-pressed={limit === n} onClick={() => setLimit(n)}>{n === 'all' ? t('全部') : t`${n} 筆`}</button>)}</div></fieldset>
    {language === 'ko' && <label className="review-checkbox"><input type="checkbox" checked={includeStrong} onChange={e => setIncludeStrong(e.target.checked)}/>{t("包含已標示的粗口縮寫（預設排除）")}</label>}
    <p className="muted">{t("可複習 ")}{pool.length}{t(" 筆 · 上次忘記的詞會先出現")}</p>
    <button className="primary-button" disabled={!pool.length} onClick={start}>{t("開始這次複習 ")}<span aria-hidden="true">→</span></button>
    {!pool.length && <p role="status">{t("目前沒有可複習的詞條。")}<button className="text-button" onClick={onBrowse}>{t("回詞庫看看")}</button></p>}
  </section>;
  if (index >= queue.length) return <section className="review-finished notebook-panel" aria-live="polite">
    <div className="finish-mark" aria-hidden="true">✓</div><p className="section-kicker">A LITTLE MORE FAMILIAR</p><h2>{t("這一輪，先到這裡。")}</h2>
    <p>{t("複習了 ")}{queue.length}{t(" 筆：記得 ")}{remembered}{t(" 筆，再練習 ")}{queue.length - remembered}{t(" 筆。")}</p>
    <p className="muted">{t("這份練習紀錄只屬於目前裝置，不會影響朋友的進度。")}</p>
    <div className="review-actions"><button className="primary-button" onClick={start}>{t("再練一輪")}</button><button onClick={() => dispatch({type:'setup'})}>{t("重新選題數")}</button><button className="text-button" onClick={onBrowse}>{t("回到詞庫")}</button></div>
  </section>;
  const entry = queue[index];
  return <section className="review-session" aria-label={t("翻卡複習")}>
    <div className="review-session-heading"><p>{t("第 ")}{index + 1}／{queue.length}{t(" 筆")}</p><button className="text-button" onClick={() => dispatch({type:'setup'})}>{t("結束這次練習")}</button></div>
    <progress aria-label={t("本輪複習進度")} value={index} max={queue.length}/>
    <div className="flashcard notebook-panel">
      <p className="section-kicker">{language === 'ko' ? 'KOREAN' : 'JAPANESE'}{t(" · 想想中文意思")}</p>
      <h2 className="flashcard-word" lang={language}>{entry.text}</h2>
      {!revealed ? <><p className="muted">{t("不急，先在心裡想一下。")}</p><button className="primary-button" aria-expanded="false" onClick={() => dispatch({type:'reveal'})}>{t("翻開答案")}</button></> : <div className="flashcard-answer" aria-live="polite">
        <h3>{t(entry.meaning_zh || '詞義待確認')}</h3>
        {entry.reading && <p lang={language}>{entry.reading}</p>}
        {entry.personal_mnemonic && <p>{t("個人記音：")}<span data-preserve-script="true">{entry.personal_mnemonic}</span></p>}
        <p className="muted">{entry.review_status === 'needs_review' ? t('整理詞條，尚待逐項查核') : t('已查核詞條')}</p>
        <div className="review-actions"><button onClick={() => answer('forgotten')}>{t("忘記了，再練習")}</button><button className="primary-button" onClick={() => answer('remembered')}>{t("記得")}</button></div>
      </div>}
    </div>
    <p className="device-note">{t("只記錄在這台裝置 · 清除瀏覽器資料後會消失")}</p>
  </section>;
}
