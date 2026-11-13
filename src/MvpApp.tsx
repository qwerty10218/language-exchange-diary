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
type Page = 'home' | 'library' | 'alphabet' | 'review' | 'flashcards' | 'writing' | 'lab';
const pages: {id: Page; label: string; icon: 'home' | 'book' | 'grid' | 'cards' | 'pen'}[] = [
  {id:'home',label:'首頁',icon:'home'}, {id:'library',label:'單字',icon:'book'},
  {id:'alphabet',label:'字母',icon:'grid'}, {id:'review',label:'測驗',icon:'cards'},
  {id:'writing',label:'寫字',icon:'pen'},
];
const labels = { ko: '朋友教我的韓文', ja: '我教朋友的日文' };
function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return pages.some(p => p.id === hash) || hash === 'flashcards' || (import.meta.env.DEV && hash === 'lab') ? hash as Page : 'home';
}
function Icon({name}: {name: 'home' | 'book' | 'grid' | 'cards' | 'pen' | 'search'}) {
  const paths = {
    home: 'M3 10 12 3l9 7v10h-6v-6H9v6H3Z',
    book: 'M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v15',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    cards: 'M7 4h14v17H7ZM3 17V1h14',
    pen: 'm4 16-1 5 5-1L21 7l-4-4Zm0 0 4 4M14 6l4 4',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function EntryCard({entry, status, selected, onSelect}: {entry: Entry; status?: string; selected:boolean; onSelect:(entry:Entry)=>void}) {
  return <article className={`entry-card${selected?' selected-word':''}`}>
    <button className="entry-word-link" aria-label={`查看 ${entry.text} 的字母`} aria-pressed={selected} onClick={()=>onSelect(entry)}><span className="entry-summary-text"><span className="entry-original" lang={entry.language}>{entry.text}</span><span className="entry-meaning">{entry.meaning_zh || '詞義待確認'}</span></span><span className="word-table-hint">查字母 ↗</span></button>
    <div className="entry-card-audio"><SpeechButton text={entrySpeechText(entry)} language={entry.language} label={entry.text} compact/></div>
    <details><summary>讀音、記音與筆記 <span aria-hidden="true">＋</span></summary><div className="entry-detail">
      <div className="entry-tags"><span>{entry.kind === 'word' ? '單字' : entry.kind === 'phrase' ? '詞句' : '文法'}</span><span>{entry.review_status === 'verified' ? '已查核' : '待查核'}</span>{entry.text === 'ㅅㅂ' && <span>粗口縮寫</span>}{status && <span>{status === 'remembered' ? '練習：記得' : '練習：再練一次'}</span>}</div>
      <dl>
        {entry.reading && <><dt>{entry.language === 'ja' ? '假名讀音' : '讀音標示'}</dt><dd lang={entry.language}>{entry.reading}</dd></>}
        {entry.romaji && <><dt>標準羅馬字</dt><dd>{entry.romaji}</dd></>}
        {entry.personal_mnemonic && <><dt>個人記音</dt><dd>{entry.personal_mnemonic}<small>保留教學時的記法，並非標準發音。</small></dd></>}
        {entry.notes && <><dt>筆記</dt><dd>{entry.notes}</dd></>}
      </dl>
      {entry.examples.length > 0 && <div className="entry-examples"><h3>例句</h3>{entry.examples.map((example,i) => <div key={i}><p lang={entry.language}>{example.text}</p>{example.reading && <p lang={entry.language}>{example.reading}</p>}<p>{example.meaning_zh}</p></div>)}</div>}
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
  const filtered = useMemo(() => searchEntries(entries[language], query) as Entry[], [language, query]);
  const onAnswer = (id: string, status: 'remembered' | 'forgotten') => {
    const next = recordReview(progress, id, status);
    setProgress(next);
    if (!initialProgress.error) setStorageError(saveProgress(() => window.localStorage, next));
  };
  const languageTabs = <div className="language-tabs" role="group" aria-label="筆記語言">{(['ko','ja'] as const).map(lang => <button key={lang} aria-pressed={language === lang} onClick={() => setLanguage(lang)}><span className="language-stamp" aria-hidden="true">{lang === 'ko' ? '한' : 'あ'}</span><span>{lang === 'ko' ? '韓文筆記' : '日文筆記'}<small>{labels[lang]}</small></span><span className="tab-count">{entries[lang].length}</span></button>)}</div>;
  const search = <div className="search-block"><label htmlFor="word-search">搜尋{language === 'ko' ? '韓文' : '日文'}筆記</label><div className="search-field"><Icon name="search"/><input id="word-search" type="search" value={query} onChange={e => setQueries({...queries,[language]:e.target.value})} placeholder="搜尋原文、中文、讀音或個人記音" autoComplete="off"/>{query && <button className="clear-search" aria-label="清除搜尋" onClick={() => setQueries({...queries,[language]:''})}>×</button>}</div></div>;
  const resultList = <><div className="list-heading"><h2>{query.trim()?'搜尋結果':'全部詞句'}</h2><p role="status">{filtered.length} 筆</p></div>
    <div className="entry-list">{filtered.map(entry => <EntryCard key={entry.id} entry={entry} status={progress[entry.id]} selected={selectedWords[language]===entry.id} onSelect={selectWord}/>)}</div>
    {!filtered.length && <section className="empty-state"><h3>沒有找到這個詞</h3><p>可以試著輸入原文、中文或朋友的記音。</p><button onClick={() => setQueries({...queries,[language]:''})}>清除搜尋</button></section>}
  </>;
  return <div className="mvp-shell">
    <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>跳至主要內容</a>
    <header className="mvp-topbar"><a className="brand" href="#home" onClick={()=>navigate('home')}><span className="brand-mark" aria-hidden="true">言</span><span>言語交換日記<small>LANGUAGE EXCHANGE DIARY</small></span></a>
      <nav aria-label="主導覽">{pages.map(item => <a key={item.id} href={`#${item.id}`} aria-current={page===item.id||page==='flashcards'&&item.id==='review'?'page':undefined} onClick={()=>navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></a>)}</nav>
    </header>
    {(writingStarted||page==='writing') && <div className="phase0-host" id="writing-content" hidden={page!=='writing'}><div className="prototype-banner"><button className="text-button" onClick={()=>{setLanguage(writingId.startsWith('ko-')?'ko':'ja');navigate('alphabet');}}>← 返回字母表</button>{import.meta.env.DEV&&<button onClick={()=>navigate('lab')}>開發調校室</button>}</div><Suspense fallback={<p role="status">載入書寫練習…</p>}><Phase0 key={writingId} initialCharacterId={writingId} visible={page==='writing'} snapshot={writingSessions.current.get(writingId)} onSnapshot={value=>writingSessions.current.set(writingId,value)} onCharacterChange={openWriting}/></Suspense></div>}
    {page==='lab'&&WritingLab&&<Suspense fallback={<p>載入調校室…</p>}><WritingLab/></Suspense>}
    <main id="main-content" tabIndex={-1} className="mvp-body" hidden={page==='writing'||page==='lab'}>
      {page==='home'
        ? <section className="simple-home">
            <p className="section-kicker">OUR LITTLE LANGUAGE NOTEBOOK</p>
            <h1 ref={heading} tabIndex={-1}>今天想學什麼？</h1>
            <p>日文與韓文的共同筆記，查一個詞、聽發音，或練習一下。</p>
            <div className="home-links">
              <button onClick={()=>navigate('library')}><Icon name="book"/><span><strong>查單字</strong><small>看意思、聽整詞發音</small></span><span aria-hidden="true">→</span></button>
              <button onClick={()=>navigate('alphabet')}><Icon name="grid"/><span><strong>查字母</strong><small>五十音／韓文 40 音</small></span><span aria-hidden="true">→</span></button>
              <button onClick={()=>navigate('review')}><Icon name="cards"/><span><strong>開始測驗</strong><small>拼字與錯題複習</small></span><span aria-hidden="true">→</span></button>
            </div>
            <details className="home-settings"><summary>顯示設定（淺色／深色）</summary><ThemeControl/></details>
            <p className="device-note">無需登入。每人的測驗進度只保存在自己的裝置。</p>
          </section>
        : <>
          <section className="page-intro">
            <h1 ref={heading} tabIndex={-1}>{page==='library'?'單字表':page==='alphabet'?(language==='ja'?'五十音表':'韓文 40 音表'):page==='review'?'拼字測驗':page==='flashcards'?'翻卡練習':'學習'}</h1>
            <p>{page==='library'?'找單字、聽發音，點「查字母」看組成。':page==='alphabet'?'點字母查看讀音或進入書寫。':page==='review'?'看中文，自己拼出日文或韓文。':'看原文，想一想它的意思。'}</p>
          </section>
          <section className="focused-workspace">
            {languageTabs}
            {page==='library'&&<>{search}{resultList}</>}
            {page==='alphabet'&&<Alphabet language={language} onWrite={openWriting} linkedWord={selectedWord} linkedLetters={letterLink} onReturn={returnToWord} onQuiz={()=>navigate('review')}/>}
            {page==='review'&&<>
              <div className="mode-switch"><button className="text-button" onClick={()=>navigate('flashcards')}>改用翻卡練習 →</button></div>
              {(['ko','ja'] as const).map(lang=><div key={lang} hidden={lang!==language}><Quiz entries={entries[lang]} language={lang} records={records} preferredId={selectedWords[lang]} onGrade={onGrade} onLookup={()=>navigate('alphabet')} storageError={learningError}/></div>)}
            </>}
            {page==='flashcards'&&<>
              <div className="mode-switch"><button className="text-button" onClick={()=>navigate('review')}>← 回到拼字測驗</button></div>
              {storageError&&<p className="storage-warning" role="alert">{storageError}</p>}
              {(['ko','ja'] as const).map(lang=><div key={lang} hidden={lang!==language}><Review entries={entries[lang]} language={lang} progress={progress} onAnswer={onAnswer} onBrowse={()=>navigate('library')}/></div>)}
            </>}
          </section>
        </>}
      <footer className="mvp-footer"><span>言語交換日記 · 一起學，一起記。</span><p>整詞發音使用裝置合成語音，非真人錄音；詞庫更新後需重新部署才會同步。</p></footer>
    </main>
  </div>;
}
