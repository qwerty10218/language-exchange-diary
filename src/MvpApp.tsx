import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import jaEntries from '../data/ja.entries.json';
import koEntries from '../data/ko.entries.json';
import Review from './Review';
import Alphabet from './Alphabet';
import Quiz from './Quiz';
import ThemeControl from './ThemeControl';
import SpeechButton from './SpeechButton';
import {entrySpeechText,speechPlayer} from './speech.mjs';
import type {WritingSnapshot} from './Phase0';
import { gradeWord, loadLearning, saveLearning, summarize } from './quiz-model.mjs';
import { wordLetters } from './word-letters.mjs';
import { loadProgress, recordReview, saveProgress, searchEntries } from './learning.mjs';
import type { Entry, Language } from './types';
import './mvp.css';

const Phase0 = lazy(() => import('./Phase0'));
const WritingLab = import.meta.env.DEV ? lazy(() => import('./WritingLab')) : null;
const entries: Record<Language, Entry[]> = { ja: jaEntries as Entry[], ko: koEntries as Entry[] };
type Page = 'home' | 'library' | 'review' | 'writing' | 'alphabet' | 'lab';
const pages: {id: Page; label: string; icon: 'home' | 'book' | 'cards' | 'pen'}[] = [
  {id:'home',label:'首頁',icon:'home'}, {id:'library',label:'詞庫',icon:'book'},
  {id:'review',label:'測驗',icon:'cards'}, {id:'writing',label:'寫字',icon:'pen'},
];
const labels = { ko: '朋友教我的韓文', ja: '我教朋友的日文' };
function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return pages.some(p => p.id === hash) || hash === 'alphabet' || (import.meta.env.DEV && hash === 'lab') ? hash as Page : 'home';
}
function Icon({name}: {name: 'home' | 'book' | 'cards' | 'pen' | 'search'}) {
  const paths = {
    home: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z',
    book: 'M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v15',
    cards: 'M7 4h14v17H7ZM3 17V1h14',
    pen: 'm4 16-1 5 5-1L21 7l-4-4Zm0 0 4 4M14 6l4 4',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function EntryCard({entry, status, selected, onSelect}: {entry: Entry; status?: string; selected:boolean; onSelect:(entry:Entry)=>void}) {
  return <article className={`entry-card${selected?' selected-word':''}`}>
    <button className="entry-word-link" aria-label={`查看 ${entry.text} 的字母`} aria-pressed={selected} onClick={()=>onSelect(entry)}><span className="entry-summary-text"><span className="entry-original" lang={entry.language}>{entry.text}</span><span className="entry-meaning">{entry.meaning_zh || '詞義待確認'}</span></span><span className="word-table-hint">查字母 ↗</span></button>
    <details><summary>讀音、記音與筆記 <span aria-hidden="true">＋</span></summary><div className="entry-detail">
      <div className="entry-tags"><span>{entry.kind === 'word' ? '單字' : entry.kind === 'phrase' ? '詞句' : '文法'}</span><span>{entry.review_status === 'verified' ? '已查核' : '待查核'}</span>{entry.text === 'ㅅㅂ' && <span>粗口縮寫</span>}{status && <span>{status === 'remembered' ? '練習：記得' : '練習：再練一次'}</span>}</div>
      <dl>
        {entry.reading && <><dt>{entry.language === 'ja' ? '假名讀音' : '讀音標示'}</dt><dd lang={entry.language}>{entry.reading}</dd></>}
        {entry.romaji && <><dt>標準羅馬字</dt><dd>{entry.romaji}</dd></>}
        {entry.personal_mnemonic && <><dt>個人記音</dt><dd>{entry.personal_mnemonic}<small>保留教學時的記法，並非標準發音。</small></dd></>}
        {entry.notes && <><dt>筆記</dt><dd>{entry.notes}</dd></>}
      </dl>
      {entry.examples.length > 0 && <div className="entry-examples"><h3>例句</h3>{entry.examples.map((example,i) => <div key={i}><p lang={entry.language}>{example.text}</p>{example.reading && <p lang={entry.language}>{example.reading}</p>}<p>{example.meaning_zh}</p></div>)}</div>}
      <p className="audio-unavailable">真人錄音尚未收錄</p>
      <SpeechButton text={entrySpeechText(entry)} language={entry.language} label={entry.text}/>
    </div></details>
  </article>;
}
export default function MvpApp() {
  const [page, setPage] = useState<Page>(currentPage);
  const [writingId, setWritingId] = useState('ko-a');
  const [writingStarted,setWritingStarted]=useState(()=>currentPage()==='writing');
  const writingSessions=useRef(new Map<string,WritingSnapshot>());
  const openWriting = (id: string) => { setWritingStarted(true);setWritingId(id); window.location.hash='writing'; setPage('writing'); };
  const [language, setLanguage] = useState<Language>('ja');
  useEffect(()=>{speechPlayer.stop();},[page,language]);
  const [queries, setQueries] = useState({ko:'',ja:''});
  const [selectedWords,setSelectedWords]=useState<Record<Language,string|null>>({ko:null,ja:null});
  const wordOrigins=useRef<Record<Language,{page:'home'|'library';scroll:number}>>({ja:{page:'library',scroll:0},ko:{page:'library',scroll:0}});
  const restoreScroll=useRef<number|null>(null);
  const [initialLearning]=useState(()=>loadLearning(()=>window.localStorage));
  const [records,setRecords]=useState(initialLearning.records);
  const recordsRef=useRef(records);
  const [learningError,setLearningError]=useState(initialLearning.error);
  const [initialProgress] = useState(() => loadProgress(() => window.localStorage));
  const [progress, setProgress] = useState(initialProgress.progress);
  const [storageError, setStorageError] = useState(initialProgress.error);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const update = () => setPage(currentPage());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [page]);
  useEffect(()=>{
    if(restoreScroll.current===null) return;
    const position=restoreScroll.current;restoreScroll.current=null;
    const frame=window.requestAnimationFrame(()=>window.scrollTo({top:position,behavior:'auto'}));
    return ()=>window.cancelAnimationFrame(frame);
  },[page]);
  const navigate = (target: Page) => { if(target==='writing')setWritingStarted(true);window.location.hash = target; setPage(target); };
  const query = queries[language];
  const selectedWord=entries[language].find(e=>e.id===selectedWords[language])??null;
  const letterLink=selectedWord?wordLetters(selectedWord):null;
  const selectWord=(entry:Entry)=>{wordOrigins.current[entry.language]={page:page==='home'?'home':'library',scroll:window.scrollY};setSelectedWords(current=>({...current,[entry.language]:entry.id}));navigate('alphabet');};
  const returnToWord=()=>{const origin=wordOrigins.current[language];restoreScroll.current=origin.scroll;navigate(origin.page);};
  const onGrade=(id:string,correct:boolean)=>{
    const next=gradeWord(recordsRef.current,id,correct);recordsRef.current=next;setRecords(next);
    if(!initialLearning.readOnly) setLearningError(saveLearning(()=>window.localStorage,next)??initialLearning.error);
  };
  const studyStats=summarize(entries[language],records);
  const filtered = useMemo(() => searchEntries(entries[language], query) as Entry[], [language, query]);
  const onAnswer = (id: string, status: 'remembered' | 'forgotten') => {
    const next = recordReview(progress, id, status);
    setProgress(next);
    if (!initialProgress.error) setStorageError(saveProgress(() => window.localStorage, next));
  };
  const languageTabs = <div className="language-tabs" role="group" aria-label="筆記語言">{(['ko','ja'] as const).map(lang => <button key={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)}><span className="language-stamp" aria-hidden="true">{lang === 'ko' ? '한' : 'あ'}</span><span>{lang === 'ko' ? '韓文筆記' : '日文筆記'}<small>{labels[lang]}</small></span><span className="tab-count">{entries[lang].length}</span></button>)}</div>;
  const search = <div className="search-block"><label htmlFor="word-search">搜尋{language === 'ko' ? '韓文' : '日文'}筆記</label><div className="search-field"><Icon name="search"/><input id="word-search" type="search" value={query} onChange={e => setQueries({...queries,[language]:e.target.value})} placeholder="搜尋原文、中文、讀音或個人記音" autoComplete="off"/>{query && <button className="clear-search" aria-label="清除搜尋" onClick={() => setQueries({...queries,[language]:''})}>×</button>}</div></div>;
  const resultList = <><div className="list-heading"><h2>{query.trim() ? '搜尋結果' : page === 'home' ? '翻翻筆記' : '全部詞句'}</h2><p role="status">{filtered.length} 筆{query.trim() ? '符合搜尋' : '詞句'}{page === 'home' && !query.trim() ? ' · 摘選 6 筆' : ''}</p></div>
    <div className="entry-list">{(page === 'home' && !query.trim() ? [...filtered].reverse().slice(0,6) : filtered).map(entry => <EntryCard key={entry.id} entry={entry} status={progress[entry.id]} selected={selectedWords[language]===entry.id} onSelect={selectWord}/>)}</div>
    {!filtered.length && <section className="empty-state"><span aria-hidden="true">空白的一頁</span><h3>還沒找到這個詞。</h3><p>試試中文意思、讀音，或切換另一份語言筆記。</p><button onClick={() => setQueries({...queries,[language]:''})}>清除搜尋</button></section>}
  </>;
  return <div className="mvp-shell">
    <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>跳至主要內容</a>
    <header className="mvp-topbar"><a className="brand" href="#home" onClick={() => navigate('home')}><span className="brand-mark" aria-hidden="true">言</span><span>言語交換日記<small>LANGUAGE EXCHANGE DIARY</small></span></a><span className="topbar-note">兩種語言，一點點日常。</span>
      <nav aria-label="主導覽">{pages.map(item => <a key={item.id} href={`#${item.id}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></a>)}</nav>
    </header>
    <ThemeControl/>
    {(writingStarted||page==='writing') && <div className="phase0-host" id="writing-content" hidden={page!=='writing'}><div className="prototype-banner"><button className="text-button" onClick={() => {setLanguage(writingId.startsWith('ko-')?'ko':'ja');navigate('alphabet');}}>← 回到字母表</button><span>共用書寫練習 · 人工驗證待完成</span>{import.meta.env.DEV && <button onClick={()=>navigate('lab')}>開發調校室</button>}</div><Suspense fallback={<p role="status">載入書寫練習…</p>}><Phase0 key={writingId} initialCharacterId={writingId} visible={page==='writing'} snapshot={writingSessions.current.get(writingId)} onSnapshot={value=>writingSessions.current.set(writingId,value)} onCharacterChange={openWriting}/></Suspense></div>}
    {page === 'lab' && WritingLab && <Suspense fallback={<p>載入調校室…</p>}><WritingLab/></Suspense>}
    <main id="main-content" tabIndex={-1} className="mvp-body" hidden={page === 'writing' || page === 'lab'}>
      {page === 'home' ? <section className="mvp-hero"><div className="hero-copy"><p className="section-kicker">OUR LITTLE LANGUAGE NOTEBOOK</p><h1 ref={heading} tabIndex={-1}>把一起學的話，<br/>留在日常裡。</h1><p>朋友教我的韓文，和我教朋友的日文。<br className="desktop-break"/>一詞一句，慢慢記住，也慢慢靠近。</p><div className="hero-actions"><button className="primary-button" onClick={() => navigate('review')}>開始測驗 <span aria-hidden="true">→</span></button><button className="text-button" onClick={() => navigate('writing')}><Icon name="pen"/> 練習寫字</button></div><p className="hero-footnote">無須登入 · 練習進度留在各自裝置</p></div><div className="hero-journal" aria-hidden="true"><div className="journal-binding"/><p>WORDS WE SHARE</p><div className="journal-word">말<span>ことば</span></div><div className="journal-rule"/><div className="journal-caption">今天，也多懂了一點。</div><span className="journal-number">01 / OUR NOTES</span></div></section> : <section className="page-intro"><p className="section-kicker">{page === 'library' ? 'OUR SHARED WORDS' : 'A LITTLE EVERY DAY'}</p><h1 ref={heading} tabIndex={-1}>{page === 'library' ? '一起累積的詞句' : page === 'alphabet' ? (language==='ja'?'五十音，一字一字認識。':'韓文 40 音，一字一字認識。') : '把陌生，慢慢變熟悉。'}</h1><p>{page === 'library' ? '不只記下意思，也留下當時幫助記憶的小提示。' : '不必一次記住所有的詞。今天，先練幾筆就好。'}</p></section>}
      <section className="notebook-workspace">
        <div className="workspace-main">{languageTabs}
          <div className="learning-tabs" role="group" aria-label="學習內容快速切換">{([{id:'library',label:'單字表'},{id:'alphabet',label:language==='ja'?'五十音表':'韓文 40 音表'},{id:'review',label:'測驗'}] as const).map(tab=><button key={tab.id} aria-pressed={page===tab.id || (page==='home' && tab.id==='library')} onClick={()=>navigate(tab.id)}>{tab.label}</button>)}</div>
          <div hidden={page!=='home' && page!=='library'}>{search}<p className="curation-note">詞條尚待逐項查核；個人記音與標準羅馬字分開保留。</p>{resultList}{page==='home' && !query.trim() && <button className="all-entries-button" onClick={()=>navigate('library')}>查看全部 {entries[language].length} 筆 →</button>}</div>
          <div hidden={page!=='alphabet'}><Alphabet language={language} onWrite={openWriting} linkedWord={selectedWord} linkedLetters={letterLink} onReturn={returnToWord} onQuiz={()=>navigate('review')}/></div>
          <div hidden={page!=='review'}>{(['ko','ja'] as const).map(lang=><div key={lang} hidden={lang!==language}><Quiz entries={entries[lang]} language={lang} records={records} preferredId={selectedWords[lang]} onGrade={onGrade} onLookup={()=>navigate('alphabet')} storageError={learningError}/></div>)}<details className="legacy-review"><summary>原有翻卡練習</summary><p className="device-note">保留舊進度；自評記得／忘記不計入拼字測驗答對次數。</p>{storageError && <p className="storage-warning" role="alert">{storageError}</p>}{(['ko','ja'] as const).map(lang=><div key={lang} hidden={lang!==language}><Review entries={entries[lang]} language={lang} progress={progress} onAnswer={onAnswer} onBrowse={()=>navigate('library')}/></div>)}</details></div>

        </div>
        <aside className="notebook-aside"><section className="aside-note"><p className="section-kicker">IN THIS NOTEBOOK</p><h2>不是考試，<br/>是我們的筆記。</h2><p>記音可以有自己的樣子，練習也可以有自己的步調。</p><div className="notebook-count"><span><strong>{jaEntries.length}</strong> 日文詞句</span><span><strong>{koEntries.length}</strong> 韓文詞句</span></div></section><section className="aside-progress"><p className="section-kicker">MY LITTLE PROGRESS</p><h2>{studyStats.mastered}<small>個單字已掌握</small></h2><p>{language === 'ko' ? '韓文' : '日文'}測驗 · 答對 {studyStats.correct}／答錯 {studyStats.wrong}</p><p className="device-note">僅此裝置，不會與朋友同步。</p></section><button className="writing-link" onClick={() => navigate('writing')}><Icon name="pen"/><span>換個方式記住字母<small>查看字母與書寫練習</small></span><span aria-hidden="true">↗</span></button></aside>
      </section>
      <footer className="mvp-footer"><span>言語交換日記 · 一起學，一起記。</span><p>內容適合公開才放上網站。詞庫由維護者更新並部署；本機複習進度不會同步至其他裝置。真人錄音尚未收錄。</p></footer>
    </main>
  </div>;
}
