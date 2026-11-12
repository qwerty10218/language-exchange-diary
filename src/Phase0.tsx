import React, { useEffect, useId, useRef, useState } from 'react';
import { writingCharacters, canPractice } from './writing';
import { WRITING_SETTINGS, strokeOptions } from './writing-config.mjs';
import { judgeStroke, screenToSvg, insideSquare, createGuidedStroke, GUIDE_DEFAULTS } from './stroke-engine.mjs';
import {createTracingStroke,tracingOptions,HANGUL_SETTINGS} from './tracing-engine.mjs';
import './style.css';
import SpeechButton from './SpeechButton';

type Point = { x: number; y: number };
type Mode = 'guided' | 'free';
type Phase = 'waiting' | 'drawing' | 'validating' | 'accepted' | 'rejected' | 'completed';
export type WritingSnapshot={ink:string[];rawInk:Point[][];mode:Mode;phase:Phase;message:string;demo:boolean;step:number;paused:boolean;showAnswer:boolean};
type TuningKey = 'startRadius' | 'snapRadius' | 'maxDeviation' | 'closeRatio' | 'completion';
const tuningFields: { key: TuningKey; label: string; min: number; max: number }[] = [
  { key: 'startRadius', label: '起點容許誤差', min: .05, max: .25 },
  { key: 'snapRadius', label: '磁吸半徑', min: .05, max: .25 },
  { key: 'maxDeviation', label: '最大偏離容忍', min: .10, max: .35 },
  { key: 'completion', label:'最低完成進度',min:.75,max:1 },
  { key: 'closeRatio', label: '原始軌跡貼近比例', min: .60, max: 1 },
];
const pathFrom = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
export default function Phase0({initialCharacterId, qa = false, config = WRITING_SETTINGS,visible=true,snapshot,onSnapshot,onCharacterChange}: {initialCharacterId?: string; qa?: boolean; config?: typeof WRITING_SETTINGS;visible?:boolean;snapshot?:WritingSnapshot;onSnapshot?:(value:WritingSnapshot)=>void;onCharacterChange?:(id:string)=>void}) {
  const instanceId=useId();
  const clipId=`${instanceId}-writing-clip`,arrowId=`${instanceId}-arrow`,helpId=`${instanceId}-canvas-help`;
  const selectedLanguage=writingCharacters.find(c=>c.id===initialCharacterId)?.language;
  const characters = writingCharacters.filter(c => (!selectedLanguage || qa || c.language===selectedLanguage) && (canPractice(c) || (import.meta.env.DEV && qa && c.paths.length > 0)));
  const [index, setIndex] = useState(Math.max(0, characters.findIndex(c => c.id === initialCharacterId))), [mode, setMode] = useState<Mode>(snapshot?.mode??'guided');
  const [ink, setInk] = useState<string[]>(snapshot?.ink??[]), [live, setLive] = useState<Point[]>([]);
  const [liveProgress, setLiveProgress] = useState(0);
  const [tuning, setTuning] = useState<Record<keyof typeof GUIDE_DEFAULTS, number>>({ ...GUIDE_DEFAULTS, ...config.global,...(selectedLanguage==='ko'?HANGUL_SETTINGS:{}),...(config!==WRITING_SETTINGS?config.global:{}) });
  const [message, setMessage] = useState(snapshot?.message??'選擇示範，或從第一筆開始描寫。');
  const [demo, setDemo] = useState(snapshot?.demo??false), [step, setStep] = useState(snapshot?.step??0), [paused, setPaused] = useState(snapshot?.paused??false);
  const [showAnswer, setShowAnswer] = useState(snapshot?.showAnswer??false);
  const [phase, setPhase] = useState<Phase>(snapshot?.phase??'waiting');
  const [acceptedStroke, setAcceptedStroke] = useState<number | null>(null);
  const acceptanceTimer = useRef<number | undefined>(undefined);
  const rawInk = useRef<Point[][]>(snapshot?.rawInk??[]);
  const pendingRaw=useRef<Point[]|null>(null);
  const svg = useRef<SVGSVGElement>(null), paths = useRef<(SVGPathElement | null)[]>([]);
  const active = useRef<{ id: number; rawPoints: Point[]; guide: ReturnType<typeof createGuidedStroke> | ReturnType<typeof createTracingStroke> | null; outside: boolean } | null>(null);
  const character = characters[index];
  const fullTrace=character.language==='ko';
  const playback=fullTrace?{...HANGUL_SETTINGS,...(config!==WRITING_SETTINGS?config.global:{})}:config.global;
  useEffect(()=>{onSnapshot?.({ink:acceptedStroke!==null?[...ink,character.paths[acceptedStroke]]:[...ink],rawInk:[...rawInk.current,...(acceptedStroke!==null&&pendingRaw.current?[pendingRaw.current]:[])].map(points=>points.map(p=>({...p}))),mode,phase:phase==='completed'||(acceptedStroke!==null&&ink.length+1===character.paths.length)?'completed':'waiting',message,demo,step,paused,showAnswer});},[ink,mode,phase,message,demo,step,paused,showAnswer,onSnapshot,acceptedStroke]);
  const completeGuided = (current: NonNullable<typeof active.current>) => {
    active.current = null;
    if (svg.current?.hasPointerCapture(current.id)) svg.current.releasePointerCapture(current.id);
    setLive([]); setLiveProgress(0); setPhase('validating');
    const result = current.guide!.finish();
    setMessage(`目前第 ${ink.length + 1} 筆：${result.reason}`);
    if (!result.ok) { setPhase('rejected'); return; }
    pendingRaw.current=current.rawPoints;setPhase('accepted'); setAcceptedStroke(ink.length);
    acceptanceTimer.current = window.setTimeout(() => {
      const last = ink.length + 1 === character.paths.length;
      current.guide?.afterAnimation(last);
      rawInk.current = [...rawInk.current, current.rawPoints];
      pendingRaw.current=null;
      setInk([...ink, character.paths[ink.length]]); setAcceptedStroke(null);
      setPhase(last ? 'completed' : 'waiting');
      setMessage(last ? '全部筆畫完成！可以重練或切換下一個字母。' : `請從第 ${ink.length + 2} 筆起點沿箭頭描寫完整一筆。`);
    }, playback.acceptanceMs);
  };
  const cancel = (reason = '書寫已取消，請重新開始這一筆。') => {
    const pointer = active.current;
    active.current = null;
    pointer?.guide?.cancel();
    if (pointer && svg.current?.hasPointerCapture(pointer.id)) svg.current.releasePointerCapture(pointer.id);
    setLive([]);
    setLiveProgress(0);
    if (pointer) { setMessage(reason); setPhase('rejected'); }
  };
  const reset = () => { cancel(); window.clearTimeout(acceptanceTimer.current); rawInk.current = []; pendingRaw.current=null;setAcceptedStroke(null); setPhase('waiting'); setInk([]); setDemo(false); setStep(0); setPaused(false); setShowAnswer(false); setMessage('請從第一筆開始。'); };
  useEffect(() => {
    const onResize = () => { cancel('畫面尺寸或縮放已改變，未完成的一筆已取消。'); };
    const onHide = () => { if (document.hidden) { cancel(); setPaused(true); } };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.clearTimeout(acceptanceTimer.current); window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onHide); };
  }, []);
  useEffect(()=>{if(!visible){cancel('已暫停目前這一筆，已完成筆畫保留；回來後可重新描寫此筆。');setPaused(true);}},[visible]);
  useEffect(() => {
    if (!demo || paused || !visible) return;
    const timer = window.setTimeout(() => {
      if (step + 1 < character.paths.length) setStep(step + 1);
      else { setDemo(false); setMessage('示範結束，現在可以試寫。'); }
    }, playback.animationMs);
    return () => window.clearTimeout(timer);
  }, [demo, paused, step, character, playback.animationMs,visible]);
  const expected = (i: number): Point[] => {
    const path = paths.current[i];
    if (!path) return [];
    const length = path.getTotalLength();
    const count = Math.max(96, Math.ceil(length / GUIDE_DEFAULTS.sampleSpacing) + 1);
    return Array.from({ length: count }, (_, n) => { const p = path.getPointAtLength(length * n / (count - 1)); return { x: p.x, y: p.y }; });
  };
  const submit = () => {
    if (mode === 'guided') { setMessage(phase === 'completed' ? '全部筆畫完成。' : `目前請寫第 ${ink.length + 1} 筆。`); return; }
    if (ink.length !== character.paths.length) { setMessage(`需要 ${character.paths.length} 筆，目前 ${ink.length} 筆。`); return; }
    for (let i = 0; i < ink.length; i++) {
      let result;
      if(fullTrace){const guide=createTracingStroke(character.paths.map((_,n)=>expected(n)),i,tracingOptions(character,i));guide.start(rawInk.current[i][0]);rawInk.current[i].slice(1).forEach(p=>guide.add(p));result=guide.finish();}
      else result=judgeStroke(rawInk.current[i],expected(i));
      if (!result.ok) { setMessage(`第 ${i + 1} 筆：${result.reason}`); return; }
    }
    setPhase('completed');
    setMessage('三項檢查通過：筆畫數、順序方向、近似軌跡。這是原型教學回饋。');
  };
  return <main>
    <header><p className="eyebrow">言語交換日記 / PHASE 0</p><h1>慢慢寫，記住一筆。</h1><p>共用書寫練習 · 僅開放通過技術檢查的字元</p></header>
    <section className="notice">132 字已列入索引；缺路徑或技術檢查失敗者不開放一般書寫。技術通過不等同字形與筆順人工認證。</section>
    <section className="card" aria-label="書寫原型">
      <label>選擇字元<select aria-label="選擇書寫字元" value={index} disabled={phase==='accepted'||phase==='drawing'} onChange={e => { const next=characters[Number(e.target.value)];if(onCharacterChange)onCharacterChange(next.id);else{reset();setIndex(Number(e.target.value));} }}>{characters.map((c,i)=><option key={c.id} value={i}>{c.display} · {c.label}{c.technicalStatus==='failed'?' · QA 失敗':''}</option>)}</select></label><p>{character.display} · {character.paths.length} 筆 · 人工驗證待完成{character.technicalStatus==='failed'?' · 僅供開發排查，未通過技術檢查':''}</p>
      <SpeechButton text={character.reading} language={character.language} label={character.category==='ko_consonants'?`${character.display} 字母名稱`:character.display}/>
      <div className="buttons modes"><button aria-pressed={mode === 'guided'} onClick={() => { reset(); setMode('guided'); }}>引導描寫</button><button aria-pressed={mode === 'free'} onClick={() => { reset(); setMode('free'); }}>自由書寫</button></div>
      {import.meta.env.DEV && mode === 'guided' && <details className="tuning"><summary>開發：練習容錯調整</summary><p>調整會重置目前字元；僅此頁面暫存，不更新詞庫。筆順、方向與跳段限制不開放關閉。</p>{tuningFields.map(field => <label key={field.key}>{field.label}：<output>{Math.round(tuning[field.key] * 100)}%</output><input type="range" aria-label={field.label} min={Math.round(field.min * 100)} max={Math.round(field.max * 100)} step="1" value={Math.round(tuning[field.key] * 100)} onChange={e => {
        const value = Number(e.target.value) / 100;
        reset(); setTuning(current => {
          const next = { ...current, [field.key]: value };
          if (field.key === 'snapRadius') next.maxDeviation = Math.max(next.maxDeviation, value);
          if (field.key === 'maxDeviation') next.snapRadius = Math.min(next.snapRadius, value);
          return next;
        });
      }}/></label>)}<button onClick={() => { reset(); setTuning({ ...GUIDE_DEFAULTS, ...config.global,...(fullTrace?HANGUL_SETTINGS:{}),...(config!==WRITING_SETTINGS?config.global:{}) }); }}>還原集中設定</button></details>}
      <p id={helpId}>{mode === 'guided' ? `沿線描寫・${phase === 'completed' ? '全部完成' : `目前第 ${ink.length + 1} 筆`}；每筆至少沿線畫到 75%，再放開判定。只點一下或短拉不會補完。` : `隱藏範本，自由寫完後提交判定（${character.paths.length} 筆）。`}</p>
      <svg ref={svg} className="writing" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" data-phase={phase} aria-label={`${character.display} 書寫區`} aria-describedby={helpId} onPointerDown={e => {
        if (active.current) { cancel('多指操作已取消此筆，請使用單指書寫。'); return; }
        if (demo || phase === 'accepted' || phase === 'validating' || e.button !== 0 || !e.isPrimary) return;
        if (phase==='completed' || (mode === 'guided' && ink.length >= character.paths.length)) return;
        const point = screenToSvg(e.currentTarget, e.clientX, e.clientY);
        if (!point || !insideSquare(point)) return;
        const overrides=import.meta.env.DEV?Object.fromEntries(tuningFields.map(field=>[field.key,tuning[field.key]])):{};
        const guide = mode==='guided'?(fullTrace?createTracingStroke(character.paths.map((_,n)=>expected(n)),ink.length,{...tracingOptions(character,ink.length),...(config!==WRITING_SETTINGS?config.global:{}),...overrides}):createGuidedStroke(expected(ink.length),{...strokeOptions(character,ink.length,config),...overrides})):null;
        guide?.start(point);
        active.current = { id: e.pointerId, rawPoints: [{x:point.x,y:point.y}], guide, outside: false };
        setPhase('drawing'); setLive(guide ? [] : [point]); setLiveProgress(0); e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e => {
        if (active.current?.id !== e.pointerId) return;
        const current = active.current;
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
        for (const event of events.length ? events : [e]) {
          const point = screenToSvg(e.currentTarget, event.clientX, event.clientY);
          if (!point) { cancel(); return; }
          current.rawPoints.push({x:point.x,y:point.y}); current.guide?.add(point);
          if (!insideSquare(point)) current.outside = true;
          // Validate on release, requiring a separate actual gesture for each stroke.
        }
        setLive(current.guide ? [] : current.rawPoints.filter(p => insideSquare(p)));
        setLiveProgress(current.guide?.progress ?? 0);
        if (current.guide) setMessage(current.guide.invalid || (current.guide.recovering ? '暫時離開引導線，回到目前筆跡末端就能繼續。' : `沿第 ${ink.length + 1} 筆繼續，停頓也沒關係。`));
      }} onPointerUp={e => {
        const current = active.current;
        if (!current || current.id !== e.pointerId) return;
        const point = screenToSvg(e.currentTarget, e.clientX, e.clientY);
        if (!point) { cancel(); return; }
        current.rawPoints.push({x:point.x,y:point.y}); current.guide?.add(point);
        if (!insideSquare(point)) current.outside = true;
        if (current.guide && !current.outside) { completeGuided(current); return; }
        active.current = null; e.currentTarget.releasePointerCapture(e.pointerId); setLive([]); setLiveProgress(0);
        if (current.outside) { current.guide?.cancel(); setPhase('rejected'); setMessage(`請在字框內重畫第 ${ink.length + 1} 筆。`); return; }
        rawInk.current = [...rawInk.current, current.rawPoints]; setInk([...ink, pathFrom(current.rawPoints)]); setPhase('waiting');
      }} onPointerCancel={e => { if (active.current?.id===e.pointerId) cancel(); }} onLostPointerCapture={e => { if (active.current?.id===e.pointerId) cancel(); }}>
        <defs><clipPath id={clipId}><rect width="1024" height="1024"/></clipPath><marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--focus)"/></marker></defs>
        <g clipPath={`url(#${clipId})`}>
        <path className="grid" d="M512 0V1024 M0 512H1024"/>
        {character.paths.map((d, i) => <path key={`${character.id}-${i}`} ref={el => { paths.current[i] = el; }} d={d} className="guide" style={{ opacity: (mode === 'guided' && playback.showGuides) || showAnswer || demo ? 1 : 0 }}/>) }
        {mode === 'guided' && !demo && character.starts.map((p, i) => i === ink.length && <g key={i}><circle cx={p[0]} cy={p[1]} r="24" fill="var(--focus)"/><text x={p[0]} y={p[1] + 9} textAnchor="middle" fill="var(--canvas)" fontSize="28">{i + 1}</text><path d={`M${p[0]} ${p[1]}l${p[2]} ${p[3]}`} className="direction" markerEnd={`url(#${arrowId})`}/></g>)}
        {demo && character.paths.slice(0, step + 1).map((d, i) => <path key={`${character.id}-${i}`} d={d} pathLength="1" className={i === step ? 'demo animated' : 'demo'} style={{ animationPlayState: paused ? 'paused' : 'running', animationDuration: `${playback.animationMs}ms` }}/>) }
        {ink.map((d, i) => <path key={i} d={d} className="ink completed-ink" data-stroke-index={i}/>)}
        {mode === 'guided' ? <path d={character.paths[ink.length] ?? ''} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - liveProgress} opacity={liveProgress > 0 ? 1 : 0} className="ink live-ink"/> : <path d={pathFrom(live)} className="ink live-ink"/>}
        {acceptedStroke !== null && <path d={character.paths[acceptedStroke]} pathLength="1" className="demo accepted-animation" style={{animationDuration: `${playback.acceptanceMs}ms`}}/>}
        </g>
      </svg>
      <p role="status" className="feedback">{demo ? `示範第 ${step + 1}／${character.paths.length} 筆${paused ? '（暫停）' : ''}。` : message} <span>已寫 {ink.length}／{character.paths.length} 筆</span></p>
      {phase==='completed'&&<div className="buttons"><button onClick={reset}>再練一次</button><button onClick={()=>{const next=characters[(index+1)%characters.length];if(onCharacterChange)onCharacterChange(next.id);else{reset();setIndex((index+1)%characters.length);}}}>下一個字母 →</button></div>}
      <div className="buttons controls"><button onClick={() => { reset(); setDemo(true); setMessage('依序觀看每一筆。'); }}>示範／重播</button><button disabled={!demo} onClick={() => setPaused(!paused)}>{paused ? '繼續' : '暫停'}</button><button disabled={phase === 'accepted' || demo} onClick={() => { cancel(); rawInk.current = rawInk.current.slice(0, -1); setInk(ink.slice(0, -1)); setPhase('waiting'); }}>退回一筆</button><button onClick={reset}>清除</button><button disabled={demo || phase === 'drawing' || phase === 'accepted'} onClick={submit}>提交判定</button>{mode === 'free' && <button onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? '隱藏答案' : '顯示答案'}</button>}</div>
    </section>
    <section className="card"><h2>真人音訊審核</h2><p>尚無真人錄音。日韓各 5 條調查記錄列於專案資料，未通過授權與人工檢聽，不提供播放。</p><p>韓文字母名稱與音節實際讀音須分開審核。</p></section>
    <footer><p>當前字元素材：{character.creator} · {character.license} · <a href={character.source ?? undefined}>固定版本來源</a>。原曲線與來源、授權、修改說明見 <a href={`${import.meta.env.BASE_URL}strokes/catalog/`}>字元資料及來源頁</a>。</p><p>判定僅供練習，手機與教師審查待完成。自由書寫保留原始筆跡。</p></footer>
  </main>;
}
