import {ChineseContext,useChinese} from './Chinese';
import type {ChineseScript} from './Chinese';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import jaEntries from '../data/ja.entries.json';
import koEntries from '../data/ko.entries.json';
import Review from './Review';
import Alphabet from './Alphabet';
import Quiz from './Quiz';
import ThemeControl from './ThemeControl';
import SpeechButton,{SpeechAvailability} from './SpeechButton';
import {entrySpeechText,speechPlayer} from './speech.mjs';
import {loadScript,saveScript} from './zh-script.mjs';
import {wordGroups,sortAndFilterWords} from './word-sort.mjs';
import type {WritingSnapshot} from './Phase0';
import { gradeWord, loadLearning, saveLearning } from './quiz-model.mjs';
import { wordLetters } from './word-letters.mjs';
import { loadProgress, recordReview, saveProgress, searchEntries } from './learning.mjs';
import type { Entry, Language } from './types';
import './mvp.css';

const Phase0 = lazy(() => import('./Phase0'));
const WritingLab = import.meta.env.DEV ? lazy(() => import('./WritingLab')) : null;
const entries: Record<Language, Entry[]> = { ja: jaEntries as Entry[], ko: koEntries as Entry[] };
type Page = 'home' | 'library' | 'word' | 'alphabet' | 'review' | 'flashcards' | 'writing' | 'lab';
const pages: {id: Page; label: string; icon: 'home' | 'book' | 'grid' | 'cards' | 'pen'}[] = [
  {id:'home',label:'首頁',icon:'home'}, {id:'library',label:'單字',icon:'book'},
  {id:'alphabet',label:'字母',icon:'grid'}, {id:'review',label:'測驗',icon:'cards'},
  {id:'writing',label:'寫字',icon:'pen'},
];
const labels = { ko: '朋友教我的韓文', ja: '我教朋友的日文' };
function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return pages.some(p => p.id === hash) || hash === 'flashcards' || hash === 'word' || (import.meta.env.DEV && hash === 'lab') ? hash as Page : 'home';
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
function EntryCard({entry,onOpen}:{entry:Entry;onOpen:(entry:Entry)=>void}) {
  const {t}=useChinese();
  return <article className="entry-card compact-word">
    <button className="entry-word-link" data-word-id={entry.id} onClick={()=>onOpen(entry)}>
      <span className="entry-summary-text"><span className="entry-original" lang={entry.language}>{entry.text}</span><span className="entry-meaning">{t(entry.meaning_zh||'詞義待確認')}</span></span>
      <span className="word-table-hint" aria-hidden="true">›</span>
    </button>
    <SpeechButton text={entrySpeechText(entry)} language={entry.language} label={entry.text} compact/>
  </article>;
}
function WordDetail({entry,onBack,onLetters}:{entry:Entry;onBack:()=>void;onLetters:()=>void}){
  const {t,note}=useChinese();
  return <section className="word-detail notebook-panel" aria-label={t("單字詳細資料")}>
    <button className="text-button" onClick={onBack}>{t("← 返回單字表")}</button>
    <h2 lang={entry.language}>{entry.text}</h2><p className="word-detail-meaning">{t(entry.meaning_zh||'詞義待確認')}</p>
    <SpeechButton text={entrySpeechText(entry)} language={entry.language} label={entry.text}/>
    <dl className="word-detail-fields">
      {entry.reading&&<><dt>{t("假名讀音")}</dt><dd lang={entry.language}>{entry.reading}</dd></>}
      {entry.romaji&&<><dt>{t("標準羅馬字")}</dt><dd data-preserve-script="true">{entry.romaji}</dd></>}
      {entry.personal_mnemonic&&<><dt>{t("朋友的記音")}</dt><dd data-preserve-script="true">{entry.personal_mnemonic}</dd></>}
      {entry.notes&&<><dt>{t("學習筆記")}</dt><dd>{note(entry.notes)}</dd></>}
    </dl>
    {entry.examples.length>0&&<section className="word-examples"><h3>{t("例句")}</h3>{entry.examples.map((example,i)=><div key={i}><p lang={entry.language}>{example.text}</p>{example.reading&&<p lang={entry.language}>{example.reading}</p>}<p>{t(example.meaning_zh)}</p></div>)}</section>}
    <button className="secondary-button" onClick={onLetters}>{t("查看這個詞的字母 ›")}</button>
    <p className="device-note">{t("合成語音並非真人錄音；原文、讀音與個人記音不會因中文顯示模式改變。")}</p>
  </section>;
}
export default function MvpApp() {
  const [script,setScript]=useState<ChineseScript>(()=>loadScript());
  const changeScript=(mode:ChineseScript)=>{saveScript(mode);setScript(mode);};
  useEffect(()=>{document.documentElement.lang=script==='hans'?'zh-Hans':'zh-Hant';},[script]);
  return <ChineseContext value={script}><MvpContent chineseScript={script} changeScript={changeScript}/></ChineseContext>;
}
function MvpContent({chineseScript,changeScript}:{chineseScript:ChineseScript;changeScript:(mode:ChineseScript)=>void}) {
  const {t}=useChinese();
  const [page, setPage] = useState<Page>(currentPage);
  const [sortOrder,setSortOrder]=useState<'original'|'recent'|'alphabet'>('original');
  const [initialGroup,setInitialGroup]=useState('all');
  const [writingId, setWritingId] = useState('ko-a');
  const [writingStarted,setWritingStarted]=useState(()=>currentPage()==='writing');
  const writingSessions=useRef(new Map<string,WritingSnapshot>());
  const openWriting = (id: string) => { setWritingStarted(true);setWritingId(id); window.location.hash='writing'; setPage('writing'); };
  const [language, setLanguage] = useState<Language>('ja');
  const switchLanguage=(lang:Language)=>{setLanguage(lang);setInitialGroup('all');};
  useEffect(()=>{speechPlayer.stop();},[page,language]);
  const [queries, setQueries] = useState({ko:'',ja:''});
  const [selectedWords,setSelectedWords]=useState<Record<Language,string|null>>({ko:null,ja:null});
  const wordOrigins=useRef<Record<Language,{page:'library';scroll:number}>>({ja:{page:'library',scroll:0},ko:{page:'library',scroll:0}});
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
    const update = () => {if(currentPage()==='library'&&page==='word')restoreScroll.current=wordOrigins.current[language].scroll;setPage(currentPage());};
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [page,language]);
  useEffect(() => {
    const target=page==='writing'?document.querySelector<HTMLElement>('.phase0-host h1'):heading.current;
    target?.setAttribute('tabindex','-1');target?.focus({preventScroll:true});
    if(page==='library'&&selectedWord){document.querySelector<HTMLElement>('[data-word-id="'+selectedWord.id+'"]')?.focus({preventScroll:true});}
  }, [page]);
  useEffect(()=>{
    document.title=t(pages.find(item=>item.id===page)?.label??(page==='word'?'單字詳情':'翻卡複習'))+' · '+t('言語交換日記');
  },[page,chineseScript]);
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
  const openWord=(entry:Entry)=>{wordOrigins.current[entry.language]={page:'library',scroll:window.scrollY};setSelectedWords(current=>({...current,[entry.language]:entry.id}));navigate('word');window.scrollTo({top:0,behavior:'auto'});};
  const selectWord=(entry:Entry)=>{setSelectedWords(current=>({...current,[entry.language]:entry.id}));navigate('alphabet');};
  const returnToWord=()=>{const origin=wordOrigins.current[language];restoreScroll.current=origin.scroll;navigate(origin.page);};
  const onGrade=(id:string,correct:boolean)=>{
    const next=gradeWord(recordsRef.current,id,correct);recordsRef.current=next;setRecords(next);
    if(!initialLearning.readOnly) setLearningError(saveLearning(()=>window.localStorage,next)??initialLearning.error);
  };
  const filtered = useMemo(()=>sortAndFilterWords(searchEntries(entries[language],query) as Entry[],language,sortOrder,initialGroup),[language,query,sortOrder,initialGroup]);
  const onAnswer = (id: string, status: 'remembered' | 'forgotten') => {
    const next = recordReview(progress, id, status);
    setProgress(next);
    if (!initialProgress.error) setStorageError(saveProgress(() => window.localStorage, next));
  };
  const languageTabs = <div className="language-tabs" role="group" aria-label={t("筆記語言")}>{(['ko','ja'] as const).map(lang => <button key={lang} aria-pressed={language === lang} onClick={() => switchLanguage(lang)}><span className="language-stamp" aria-hidden="true">{lang === 'ko' ? '한' : 'あ'}</span><span>{lang === 'ko' ? t('韓文筆記') : t('日文筆記')}<small>{t(labels[lang])}</small></span><span className="tab-count">{entries[lang].length}</span></button>)}</div>;
  const search = <div className="search-block"><label htmlFor="word-search">{t("搜尋")}{language === 'ko' ? t('韓文') : t('日文')}{t("筆記")}</label><div className="search-field"><Icon name="search"/><input id="word-search" type="search" value={query} onChange={e => setQueries({...queries,[language]:e.target.value})} placeholder={t("搜尋原文、中文、讀音或個人記音")} autoComplete="off"/>{query && <button className="clear-search" aria-label={t("清除搜尋")} onClick={() => setQueries({...queries,[language]:''})}>×</button>}</div></div>;
  const filterControls=<div className="word-filters">
    <label>{t("排序")}<select aria-label={t("單字排序")} value={sortOrder} onChange={e=>setSortOrder(e.target.value as typeof sortOrder)}><option value="original">{t("教學順序")}</option><option value="recent">{t("最新加入")}</option><option value="alphabet">{language==='ja'?t('五十音順'):t('가나다 順')}</option></select></label>
    <label>{t("首字分類")}<select aria-label={t("首字分類")} value={initialGroup} onChange={e=>setInitialGroup(e.target.value)}><option value="all">{t("全部")}</option>{wordGroups(language).map(g=><option key={g} value={g}>{g==='其他'?t('其他'):language==='ja'?g+t(' 行'):g}</option>)}</select></label>
  </div>;
  const resultList = <><div className="list-heading"><h2>{query.trim()?t('搜尋結果'):t('全部詞句')}</h2>{(query||initialGroup!=='all'||sortOrder!=='original')&&<button className="text-button" onClick={()=>{setQueries({...queries,[language]:''});setInitialGroup('all');setSortOrder('original');}}>{t('重設')}</button>}<p role="status">{filtered.length}{t(" 筆")}</p></div>
    <div className="entry-list">{filtered.map((entry:Entry) => <EntryCard key={entry.id} entry={entry} onOpen={openWord}/>)}</div>
    {!filtered.length && <section className="empty-state"><h3>{t("沒有找到這個詞")}</h3><p>{t("可以試著輸入原文、中文或朋友的記音。")}</p><button onClick={()=>{setQueries({...queries,[language]:''});setInitialGroup('all');setSortOrder('original');}}>{t('重設搜尋與篩選')}</button></section>}
  </>;
  return <div className="mvp-shell">
    <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();(page==='writing'?document.querySelector<HTMLElement>('.phase0-host h1'):heading.current)?.focus();}}>{t("跳至主要內容")}</a>
    <header className="mvp-topbar"><a className="brand" href="#home" onClick={()=>navigate('home')}><span className="brand-mark" aria-hidden="true">{t("言")}</span><span>{t("言語交換日記")}<small>LANGUAGE EXCHANGE DIARY</small></span></a>
      <div className="script-switch" role="group" aria-label={t("中文顯示")}><button aria-pressed={chineseScript==='hant'} onClick={()=>changeScript('hant')}>{t("繁")}</button><button aria-pressed={chineseScript==='hans'} onClick={()=>changeScript('hans')}>{t("简")}</button></div>
      <nav aria-label={t("主導覽")}>{pages.map(item => <a key={item.id} href={`#${item.id}`} aria-current={page===item.id||page==='flashcards'&&item.id==='review'||page==='word'&&item.id==='library'?'page':undefined} onClick={()=>navigate(item.id)}><Icon name={item.icon}/><span>{t(item.label)}</span></a>)}</nav>
    </header>
    {(writingStarted||page==='writing') && <div className="phase0-host" id="writing-content" hidden={page!=='writing'}><div className="prototype-banner"><button className="text-button" onClick={()=>{setLanguage(writingId.startsWith('ko-')?'ko':'ja');navigate('alphabet');}}>{t("← 返回字母表")}</button>{import.meta.env.DEV&&<button onClick={()=>navigate('lab')}>{t("開發調校室")}</button>}</div><Suspense fallback={<p role="status">{t("載入書寫練習…")}</p>}><Phase0 key={writingId} initialCharacterId={writingId} visible={page==='writing'} snapshot={writingSessions.current.get(writingId)} onSnapshot={value=>writingSessions.current.set(writingId,value)} onCharacterChange={openWriting}/></Suspense></div>}
    {page==='lab'&&WritingLab&&<Suspense fallback={<p>{t("載入調校室…")}</p>}><WritingLab/></Suspense>}
    <main id="main-content" tabIndex={-1} className="mvp-body" hidden={page==='writing'||page==='lab'}>
      {page==='home'
        ? <section className="simple-home">
            <p className="section-kicker">OUR LITTLE LANGUAGE NOTEBOOK</p>
            <h1 ref={page==='home'?heading:undefined} tabIndex={-1}>{t("今天想學什麼？")}</h1>
            <p>{t("日文與韓文的共同筆記，查一個詞、聽發音，或練習一下。")}</p>
            <div className="home-links">
              <button onClick={()=>navigate('library')}><Icon name="book"/><span><strong>{t("查單字")}</strong><small>{t("看意思、聽整詞發音")}</small></span><span aria-hidden="true">→</span></button>
              <button onClick={()=>navigate('alphabet')}><Icon name="grid"/><span><strong>{t("查字母")}</strong><small>{t("五十音／韓文 40 音")}</small></span><span aria-hidden="true">→</span></button>
              <button onClick={()=>navigate('review')}><Icon name="cards"/><span><strong>{t("開始測驗")}</strong><small>{t("拼字與錯題複習")}</small></span><span aria-hidden="true">→</span></button>
            </div>
            <details className="home-settings"><summary>{t("顯示設定（淺色／深色）")}</summary><ThemeControl/></details>
            <p className="device-note">{t("無需登入。每人的測驗進度只保存在自己的裝置。")}</p>
          </section>
        : null}
        <div hidden={page==='home'}>
          <section className="page-intro">
            <h1 ref={page!=='home'?heading:undefined} tabIndex={-1}>{page==='library'?t('單字表'):page==='word'?t('單字詳情'):page==='alphabet'?(language==='ja'?t('五十音表'):t('韓文 40 音表')):page==='review'?t('拼字測驗'):page==='flashcards'?t('翻卡練習'):t('學習')}</h1>
            <p>{page==='library'?t('搜尋、排序、篩選，點單字看詳細資料。'):page==='word'?t('查看讀音、例句與學習記音。'):page==='alphabet'?t('點字母查看讀音或進入書寫。'):page==='review'?t('看中文，自己拼出日文或韓文。'):t('看原文，想一想它的意思。')}</p>
          </section>
          <section className="focused-workspace">
            {languageTabs}
            {page==='library'&&<>{search}{filterControls}<SpeechAvailability language={language}/>{resultList}</>}
            {page==='word'&&(selectedWord?<WordDetail entry={selectedWord} onBack={returnToWord} onLetters={()=>selectWord(selectedWord)}/>:<section className="empty-state"><h3>{t("請先選擇單字")}</h3><button onClick={()=>navigate('library')}>{t("回到單字表")}</button></section>)}
            <div hidden={page!=='alphabet'}><Alphabet visible={page==='alphabet'} language={language} onWrite={openWriting} linkedWord={selectedWord} linkedLetters={letterLink} onReturn={selectedWord?()=>navigate('word'):undefined} onQuiz={()=>navigate('review')}/></div>
            <div hidden={page!=='review'}>
              <div className="mode-switch"><button className="text-button" onClick={()=>navigate('flashcards')}>{t("改用翻卡練習 →")}</button></div>
              {(['ko','ja'] as const).map(lang=><div key={lang} hidden={lang!==language}><Quiz entries={entries[lang]} language={lang} records={records} preferredId={selectedWords[lang]} onGrade={onGrade} onLookup={()=>navigate('alphabet')} storageError={learningError}/></div>)}
            </div>
            <div hidden={page!=='flashcards'}>
              <div className="mode-switch"><button className="text-button" onClick={()=>navigate('review')}>{t("← 回到拼字測驗")}</button></div>
              {storageError&&<p className="storage-warning" role="alert">{t(storageError)}</p>}
              {(['ko','ja'] as const).map(lang=><div key={lang} hidden={lang!==language}><Review entries={entries[lang]} language={lang} progress={progress} onAnswer={onAnswer} onBrowse={()=>navigate('library')}/></div>)}
            </div>
          </section>
        </div>
      <footer className="mvp-footer"><span>{t("言語交換日記 · 一起學，一起記。")}</span><p>{t("整詞發音使用裝置合成語音，非真人錄音；詞庫更新後需重新部署才會同步。")} <a href={`${import.meta.env.BASE_URL}licenses/OpenCC-APACHE-2.0.txt`}>{t('繁簡字典：OpenCC 授權')}</a></p></footer>
    </main>
  </div>;
}
