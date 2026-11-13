import {useId,useRef,useState} from 'react';
import {useChinese} from './Chinese';
import {letterTabs} from './word-letter-filter.mjs';
import type {Language} from './types';
import './letter-filter.css';

type Sort='original'|'recent'|'alphabet';
type Props={language:Language;selected:string|null;onSelect:(letter:string|null)=>void;sort:Sort;onSort:(sort:Sort)=>void;onReset:()=>void};
export default function LetterFilter({language,selected,onSelect,sort,onSort,onReset}:Props){
  const {t}=useChinese();
  const [open,setOpen]=useState(false);
  const tabs=letterTabs[language];
  const [tabId,setTabId]=useState(tabs.find(tab=>tab.letters.includes(selected??''))?.id??tabs[0].id);
  const tab=tabs.find(tab=>tab.id===tabId)??tabs[0];
  const panelId=useId(),helpId=useId(),toggle=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);toggle.current?.focus();};
  const choose=(letter:string)=>{onSelect(selected===letter?null:letter);close();};
  return <div className="word-explore-controls">
    <div className="word-explore-toolbar">
      <h2 className="letter-filter-heading"><button ref={toggle} className="letter-filter-toggle" type="button" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(value=>!value)}>{t('字母篩選')} <span aria-hidden="true">{open?'▴':'▾'}</span></button></h2>
      <label className="word-sort-select">{t('排序')}
        <select aria-label={t('單字排序')} value={sort} onChange={event=>onSort(event.target.value as Sort)}>
          <option value="original">{t('教學順序')}</option><option value="recent">{t('最新加入')}</option><option value="alphabet">{language==='ja'?t('五十音順'):t('가나다 順')}</option>
        </select>
      </label>
    </div>
    {selected&&<div className="active-letter-filter"><span>{t('已篩選：')}<strong lang={language}>{selected}</strong>{t(' · 包含此字母')}</span><button type="button" aria-label={t`清除 ${selected} 字母篩選`} onClick={()=>{onSelect(null);close();}}>{t('清除')} <span aria-hidden="true">×</span></button></div>}
    <div id={panelId} className="letter-filter-panel" hidden={!open} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close();}}}>
      <div className="letter-script-tabs" role="group" aria-label={language==='ja'?t('假名種類'):t('韓文字母種類')}>
        {tabs.map(item=><button key={item.id} type="button" aria-pressed={tab.id===item.id} onClick={()=>setTabId(item.id)}>{t(item.label)}</button>)}
      </div>
      <p id={helpId} className="letter-filter-help">{language==='ja'?t('僅選基本 46 音；濁音、半濁音、小假名與「ー」不折算成基本字。漢字依詞庫記載的假名比對，缺完整假名者不參與篩選。'):t('比對任意音節的初聲、母音與收音；複合收音拆開，複合母音與緊音保持完整。')}</p>
      <div className="letter-filter-grid" role="group" aria-label={t(tab.label)} aria-describedby={helpId}>
        {tab.letters.map(letter=><button type="button" key={letter} aria-label={t`篩選包含 ${letter} 的單字`} aria-pressed={selected===letter} onClick={()=>choose(letter)}><span lang={language}>{letter}</span>{selected===letter&&<span className="letter-selected-mark" aria-hidden="true">✓</span>}</button>)}
      </div>
      <div className="letter-filter-foot"><span>{t('比對詞句中的任意位置。')}</span><button type="button" className="text-button" onClick={()=>{onReset();close();}}>{t('顯示全部')}</button></div>
    </div>
  </div>;
}
