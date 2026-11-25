import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import Phase0 from './Phase0';
import type {WritingSnapshot} from './Phase0';
import SpeechButton from './SpeechButton';
import {entrySpeechText} from './speech.mjs';
import {writingCharacters,canPractice} from './writing';
import {wordWritingUnits} from './writing-units';
import type {Entry} from './types';
import {useChinese} from './Chinese';
import './guided-writing.css';

export default function GuidedWriting({
  entry,
  characterId,
  visible,
  onBack,
  onUnitCompleted,
  hub,
}: {
  entry?: Entry;
  characterId: string;
  visible: boolean;
  onBack: () => void;
  onUnitCompleted?: (id: string, isWordComplete: boolean) => void;
  hub?: ReactNode;
}) {
  const {t}=useChinese();
  const language=entry?.language??(characterId.startsWith('ko-')?'ko':'ja');
  const single=writingCharacters.find(c=>c.id===characterId);
  const result=entry?wordWritingUnits(entry):{supported:single&&canPractice(single)?[single]:[],unsupported:single?[]:[characterId]};
  const supported=result.supported,missing=result.unsupported;
  const unit=entry?.language==='ko'?'字塊':'字母';
  const [position,setPosition]=useState(0),[attempt,setAttempt]=useState(0);
  const snapshots=useRef(new Map<number,WritingSnapshot>()),heading=useRef<HTMLHeadingElement>(null);
  const done=position>=supported.length;
  useEffect(()=>{if(visible)heading.current?.focus({preventScroll:true});},[visible,done]);
  const speechText = entry ? entrySpeechText(entry) : (single?.reading ?? '');
  const speechLabel = entry ? entry.text : (single?.display ?? '');

  return <main className="guided-session">
    {hub}
    <div className="guided-topbar">
      <button className="text-button" onClick={onBack}>{entry?t('← 返回單字'):t('← 返回字母表')}</button>
      {speechText && <SpeechButton text={speechText} language={language} label={speechLabel} compact/>}
    </div>
    <div className="guided-title-row">
      <h1 ref={heading} tabIndex={-1} lang={language}>{entry?.text??single?.display}</h1>
      {entry&&<p className="guided-meaning">{t(entry.meaning_zh||'詞義待確認')}</p>}
    </div>
    {!!missing.length&&<p className="notice">{t(unit==='字塊'?'部分字塊尚未開放':'部分字母尚未開放')}：<span lang={language}>{missing.join('、')}</span>。{t('僅練習已支援部分，不計為整詞完成。')}</p>}
    <p className="guided-progress" role="status">{t(unit==='字塊'?'字塊進度':'字母進度')} {Math.min(position+1,supported.length)}／{supported.length}{!done&&<> · <span lang={language}>{supported[position]!.display}</span></>}</p>
    <progress aria-label={t(unit==='字塊'?'已完成字塊':'已完成字母')} max={Math.max(1,supported.length)} value={position}/>
    {supported.length<=3&&<p className="guided-steps" lang={language}>{supported.map((c,i)=><span key={i} aria-current={i===position?'step':undefined}>{i<position?'✓ ':''}{c!.display}</span>)}</p>}
    {done?<section className="guided-finish">
      <h2>{!supported.length?t(unit==='字塊'?'目前沒有可練習的字塊':'目前沒有可練習的字母'):missing.length?t(unit==='字塊'?'已支援的字塊練習完成':'已支援的字母練習完成'):t('練習完成！')}</h2>
      {supported.length>0&&<p className="guided-reward-note">{t('已寫完並累積本次手寫印章，繼續保持手感！')}</p>}
      <div className="guided-finish-actions">
        {supported.length>0&&<button className="primary-button" onClick={()=>{snapshots.current.clear();setAttempt(a=>a+1);setPosition(0);}}>{t('再練一次')}</button>}
        <button onClick={onBack}>{entry?t('返回單字'):t('返回字母表')}</button>
      </div>
    </section>:<Phase0 practiceCharacter={supported[position]} key={`${position}-${attempt}`} initialCharacterId={supported[position]!.id} visible={visible} snapshot={snapshots.current.get(position)} onSnapshot={value=>snapshots.current.set(position,value)} onComplete={()=>{
      const currentUnit = supported[position];
      const isLast = position + 1 >= supported.length;
      if (currentUnit) onUnitCompleted?.(entry && isLast ? `word:${entry.id}` : currentUnit.id, isLast);
      setPosition(current=>current===position?current+1:current);
    }}/>}
  </main>;
}
