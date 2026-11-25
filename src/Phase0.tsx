import {useChinese} from './Chinese';
import React, { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { writingCharacters, canPractice } from './writing';
import type {WritingCharacter} from './writing';
import {createBlockStroke} from './block-tracing.mjs';
import {TRACK_RADIUS_PX} from './screen-tracing.mjs';
import {insideDrawingArea} from './pointer-tracing.mjs';
import {recordWritingDiagnostic} from './writing-diagnostics.mjs';
import { WRITING_SETTINGS, strokeOptions } from './writing-config.mjs';
import { judgeStroke, screenToSvg, insideSquare, createGuidedStroke, GUIDE_DEFAULTS } from './stroke-engine.mjs';
import {createTracingStroke,tracingOptions,HANGUL_SETTINGS} from './tracing-engine.mjs';
import {playStroke,playCharacterComplete,playWrong,playRecovering} from './sound-fx.mjs';
import './style.css';
import SpeechButton from './SpeechButton';

type Point = { x: number; y: number; time?:number };
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
export default function Phase0({initialCharacterId, qa = false, config = WRITING_SETTINGS,visible=true,snapshot,onSnapshot,onCharacterChange,onComplete,practiceCharacter}: {initialCharacterId?: string; practiceCharacter?:WritingCharacter; qa?: boolean; config?: typeof WRITING_SETTINGS;visible?:boolean;snapshot?:WritingSnapshot;onSnapshot?:(value:WritingSnapshot)=>void;onCharacterChange?:(id:string)=>void;onComplete?:()=>void}) {
  const {t}=useChinese();
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(visible&&qa)heading.current?.focus({preventScroll:true});},[visible]);
  const instanceId=useId();
  const clipId=`${instanceId}-writing-clip`,arrowId=`${instanceId}-arrow`,helpId=`${instanceId}-canvas-help`;
  const selectedLanguage=practiceCharacter?.language??writingCharacters.find(c=>c.id===initialCharacterId)?.language;
  const characters = practiceCharacter?[practiceCharacter]:writingCharacters.filter(c => (!selectedLanguage || qa || c.language===selectedLanguage) && (canPractice(c) || (import.meta.env.DEV && qa && c.paths.length > 0)));
  const [index, setIndex] = useState(Math.max(0, characters.findIndex(c => c.id === initialCharacterId))), [mode, setMode] = useState<Mode>(qa?(snapshot?.mode??'guided'):'guided');
  const [ink, setInk] = useState<string[]>(snapshot?.ink??[]), [live, setLive] = useState<Point[]>([]);
  const [liveProgress, setLiveProgress] = useState(0);
  const [liveRecovering, setLiveRecovering] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [endTarget, setEndTarget] = useState<Point|null>(null);
  const [unitsPerPx,setUnitsPerPx]=useState(1);
  const [liveHead,setLiveHead]=useState<{x:number;y:number;angle:number;scale:number}|null>(null);
  const lastCanvasSize = useRef<{width:number;scale:number}>({width:0,scale:1});
  const liveFrame=useRef<number|undefined>(undefined);
  const clearLiveFrame=()=>{if(liveFrame.current!==undefined)cancelAnimationFrame(liveFrame.current);liveFrame.current=undefined;};
  useEffect(()=>()=>clearLiveFrame(),[]);
  const [replayVersion,setReplayVersion]=useState(0);
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
  useLayoutEffect(()=>{
    const node=svg.current;if(!node)return;
    const measure=()=>{if(!node.getBoundingClientRect().width)return;const matrix=node.getScreenCTM();if(matrix)setUnitsPerPx(1/Math.hypot(matrix.a,matrix.b));};
    measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
  },[]);
  const active = useRef<{ id: number; stroke: number; reference: Point[]; rawPoints: Point[]; guide: ReturnType<typeof createGuidedStroke> | ReturnType<typeof createTracingStroke> | ReturnType<typeof createBlockStroke> | null; outside: boolean; padding:number } | null>(null);
  const character = characters[index];
  const fullTrace=character.language==='ko';
  const playback=fullTrace?{...HANGUL_SETTINGS,...(config!==WRITING_SETTINGS?config.global:{})}:config.global;
  useEffect(()=>{onSnapshot?.({ink:acceptedStroke!==null&&pendingRaw.current!==null?[...ink,character.paths[acceptedStroke]]:[...ink],rawInk:[...rawInk.current,...(acceptedStroke!==null&&pendingRaw.current?[pendingRaw.current]:[])].map(points=>points.map(p=>({...p}))),mode,phase:phase==='completed'||(acceptedStroke!==null&&pendingRaw.current!==null&&ink.length+1===character.paths.length)?'completed':'waiting',message,demo,step,paused,showAnswer});},[ink,mode,phase,message,demo,step,paused,showAnswer,onSnapshot,acceptedStroke]);
  const completeCallback=useRef(onComplete);completeCallback.current=onComplete;
  const [foreground,setForeground]=useState(()=>typeof document==='undefined'||!document.hidden);
  useEffect(()=>{const update=()=>setForeground(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{if(phase!=='completed'||!visible||!foreground||qa)return;const timer=window.setTimeout(()=>completeCallback.current?.(),650);return()=>window.clearTimeout(timer);},[phase,visible,foreground,qa]);
  useEffect(()=>{if(visible&&foreground||acceptedStroke===null)return;window.clearTimeout(acceptanceTimer.current);if(pendingRaw.current===null){setAcceptedStroke(null);return;}const next=[...ink,character.paths[acceptedStroke]];if(pendingRaw.current)rawInk.current=[...rawInk.current,pendingRaw.current];pendingRaw.current=null;setInk(next);setAcceptedStroke(null);setPhase(next.length===character.paths.length?'completed':'waiting');},[visible,foreground,acceptedStroke]);
  const diagnose=(event:string,current:NonNullable<typeof active.current>,client?:Point,result?:{ok:boolean;reason:string})=>{
    if(!import.meta.env.DEV||new URLSearchParams(window.location.search).get('writingDebug')!=='1')return;
    const guide=current.guide,reference=current.reference,first=current.rawPoints[0],last=current.rawPoints.at(-1);
    const gap=(a:Point|undefined,b:Point|undefined)=>a&&b?Math.hypot(a.x-b.x,a.y-b.y):null;
    recordWritingDiagnostic(window,event,svg.current,{character:character.display,stroke:current.stroke+1,pointerId:current.id,
      client:client??null,svgPoint:last,visibleOutside:current.outside,captured:svg.current?.hasPointerCapture(current.id)??false,
      metrics:guide&&'diagnostics'in guide?guide.diagnostics:{sourcePoint:last,progress:guide?.progress,invalid:guide?.invalid,recovering:guide?.recovering,startDistance:gap(first,reference[0]),endDistance:gap(last,reference.at(-1))},result:result??null});
  };
  // Consume every pointer sample in the engine, paint at most once per frame.
  // Reading the active ref also prevents a stale frame painting the next stroke.
  const refreshLive=(current:NonNullable<typeof active.current>)=>{
    if(liveFrame.current!==undefined)return;
    liveFrame.current=requestAnimationFrame(()=>{
      liveFrame.current=undefined;if(active.current!==current)return;
        setLive(current.guide ? [] : current.rawPoints.filter(p => insideSquare(p)));
        setLiveProgress(current.guide?.progress ?? 0);
        if (current.guide) {
          const endpoint='endpoint'in current.guide?current.guide.endpoint:null;
          const ready=Boolean('readyToRelease'in current.guide?current.guide.readyToRelease:endpoint?.verified);
          const recovering=Boolean(current.guide.recovering);
          setLiveRecovering(recovering);
          setLiveReady(ready && !recovering && !current.guide.invalid);
          if(recovering) playRecovering();
          setMessage(current.guide.invalid || (recovering ? t('暫時離開引導線，回到目前筆跡末端就能繼續。') :
            ready?t('這一筆已描完，放開即可。'):endpoint&&current.guide.progress>=.75&&!endpoint.ready?t('接近完成，請沿線到這一筆的終點再放開。'):t`沿第 ${ink.length + 1} 筆繼續，停頓也沒關係。`));
        }
        if(current.guide){
          const path=paths.current[current.stroke],matrix=svg.current?.getScreenCTM();
          if(path&&matrix){const length=path.getTotalLength(),arc=length*current.guide.progress,p=path.getPointAtLength(arc),near=path.getPointAtLength(Math.min(length,arc+4));
            const back=path.getPointAtLength(Math.max(0,arc-4));
            setLiveHead({x:p.x,y:p.y,angle:Math.atan2(near.y-back.y,near.x-back.x)*180/Math.PI,scale:1/Math.hypot(matrix.a,matrix.b)});}
        }
    });
  };
  const completeGuided = (current: NonNullable<typeof active.current>) => {
    clearLiveFrame();setLiveHead(null);setLiveRecovering(false);setLiveReady(false);setEndTarget(null);
    active.current = null;
    if (svg.current?.hasPointerCapture(current.id)) svg.current.releasePointerCapture(current.id);
    setLive([]); setLiveProgress(0); setPhase('validating');
    const result = current.guide!.finish();
    diagnose('finish',current,undefined,result);
    setMessage(`目前第 ${ink.length + 1} 筆：${result.reason}`);
    if (!result.ok) { playWrong(); setPhase('rejected'); return; }
    if(!qa){
      // Commit validated ink immediately; the glow must not swallow the next gesture.
      const last=ink.length+1===character.paths.length;
      if(last) playCharacterComplete(); else playStroke();
      current.guide?.afterAnimation(last);rawInk.current=[...rawInk.current,current.rawPoints];
      window.clearTimeout(acceptanceTimer.current);
      setInk([...ink,character.paths[ink.length]]);setAcceptedStroke(ink.length);setPhase(last?'completed':'waiting');
      setMessage(last?(character.category==='ko_syllable'?'這個字塊完成了！':'這個字母完成了！'):`請從第 ${ink.length+2} 筆起點沿箭頭描寫完整一筆。`);
      acceptanceTimer.current=window.setTimeout(()=>setAcceptedStroke(null),playback.acceptanceMs);
      return;
    }
    const willBeLast = ink.length + 1 === character.paths.length;
    if (willBeLast) playCharacterComplete(); else playStroke();
    pendingRaw.current=current.rawPoints;setPhase('accepted'); setAcceptedStroke(ink.length);
    acceptanceTimer.current = window.setTimeout(() => {
      const last = ink.length + 1 === character.paths.length;
      current.guide?.afterAnimation(last);
      rawInk.current = [...rawInk.current, current.rawPoints];
      pendingRaw.current=null;
      setInk([...ink, character.paths[ink.length]]); setAcceptedStroke(null);
      setPhase(last ? 'completed' : 'waiting');
      setMessage(last ? '這個字母完成了！' : `請從第 ${ink.length + 2} 筆起點沿箭頭描寫完整一筆。`);
    }, playback.acceptanceMs);
  };
  const cancel = (reason = '書寫已取消，請重新開始這一筆。') => {
    clearLiveFrame();setLiveHead(null);setLiveRecovering(false);setLiveReady(false);setEndTarget(null);
    const pointer = active.current;
    active.current = null;
    pointer?.guide?.cancel();
    if(pointer)diagnose('cancel',pointer,undefined,{ok:false,reason});
    if (pointer && svg.current?.hasPointerCapture(pointer.id)) svg.current.releasePointerCapture(pointer.id);
    setLive([]);
    setLiveProgress(0);
    if (pointer) { setMessage(reason); setPhase('rejected'); }
  };
  const reset = () => { cancel(); window.clearTimeout(acceptanceTimer.current); rawInk.current = []; pendingRaw.current=null;setAcceptedStroke(null); setPhase('waiting'); setInk([]); setDemo(false); setStep(0); setPaused(false); setShowAnswer(false); setMessage('請從第一筆開始。'); };
  useEffect(() => {
    const onResize = () => {
      if (!active.current) return;
      const width = svg.current?.getBoundingClientRect().width ?? 0;
      const scale = window.visualViewport?.scale ?? 1;
      const prev = lastCanvasSize.current;
      // Ignore mobile browser toolbar height jitter; only cancel on real pinch-zoom or canvas width resize.
      if (Math.abs(scale - prev.scale) > 0.03 || (prev.width > 0 && Math.abs(width - prev.width) > 8)) {
        cancel('畫面尺寸或縮放已改變，未完成的一筆已取消。');
      }
    };
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
  }, [demo, paused, step, character, playback.animationMs,visible,replayVersion]);
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
  const Container=qa?'main':'section';
  return <Container className={qa?undefined:"guided-letter"}>
    {qa&&<header><p className="eyebrow">{t("言語交換日記 / PHASE 0")}</p><h1 ref={heading} tabIndex={-1}>{t("慢慢寫，記住一筆。")}</h1><p>{t("共用書寫練習 · 僅開放通過技術檢查的字元")}</p></header>}
    {qa&&<section className="notice">{t("132 字已列入索引；缺路徑或技術檢查失敗者不開放一般書寫。技術通過不等同字形與筆順人工認證。")}</section>}
    <section className="card" aria-label={t(qa?"書寫原型":"引導描寫")}>
      {qa&&<label>{t("選擇字元")}<select aria-label={t("選擇書寫字元")} value={index} disabled={phase==='accepted'||phase==='drawing'} onChange={e => { const next=characters[Number(e.target.value)];if(onCharacterChange)onCharacterChange(next.id);else{reset();setIndex(Number(e.target.value));} }}>{characters.map((c,i)=><option key={c.id} value={i}>{c.display} · {t(c.label)}{c.technicalStatus==='failed'?t(' · QA 失敗'):''}</option>)}</select></label>}<p>{character.display} · {character.paths.length}{t(qa?" 筆 · 人工驗證待完成":" 筆")}{character.technicalStatus==='failed'?t(' · 僅供開發排查，未通過技術檢查'):''}</p>
      {qa&&<SpeechButton text={character.reading} language={character.language} label={character.category==='ko_consonants'?t`${character.display} 字母名稱`:character.display}/>}
      {qa&&<div className="buttons modes"><button aria-pressed={mode === 'guided'} onClick={() => { reset(); setMode('guided'); }}>{t("引導描寫")}</button><button aria-pressed={mode === 'free'} onClick={() => { reset(); setMode('free'); }}>{t("自由書寫")}</button></div>}
      {import.meta.env.DEV && qa && mode === 'guided' && <details className="tuning"><summary>{t("開發：練習容錯調整")}</summary><p>{t("調整會重置目前字元；僅此頁面暫存，不更新詞庫。筆順、方向與跳段限制不開放關閉。")}</p>{tuningFields.map(field => <label key={field.key}>{t(field.label)}：<output>{Math.round(tuning[field.key] * 100)}%</output><input type="range" aria-label={field.label} min={Math.round(field.min * 100)} max={Math.round(field.max * 100)} step="1" value={Math.round(tuning[field.key] * 100)} onChange={e => {
        const value = Number(e.target.value) / 100;
        reset(); setTuning(current => {
          const next = { ...current, [field.key]: value };
          if (field.key === 'snapRadius') next.maxDeviation = Math.max(next.maxDeviation, value);
          if (field.key === 'maxDeviation') next.snapRadius = Math.min(next.snapRadius, value);
          return next;
        });
      }}/></label>)}<button onClick={() => { reset(); setTuning({ ...GUIDE_DEFAULTS, ...config.global,...(fullTrace?HANGUL_SETTINGS:{}),...(config!==WRITING_SETTINGS?config.global:{}) }); }}>{t("還原集中設定")}</button></details>}
      <p id={helpId}>{!qa?t("從亮起的起點順箭頭沿線描寫完整一筆，放開後自動判定。"):mode === 'guided' ? t`沿線描寫・${phase === 'completed' ? t('全部完成') : t`目前第 ${ink.length + 1} 筆`}；每筆至少沿線畫到 75%，再放開判定。只點一下或短拉不會補完。` : t`隱藏範本，自由寫完後提交判定（${character.paths.length} 筆）。`}</p>
      {mode === 'guided' && <div className="writing-live-bar" data-state={liveRecovering?'recovering':liveReady?'ready':'drawing'} aria-hidden="true"><span style={{transform:`scaleX(${phase==='completed'?1:liveProgress})`}}/></div>}
      <svg role="img" ref={svg} className="writing" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid meet" data-phase={phase} data-demo={demo} data-recovering={liveRecovering} data-ready={liveReady} aria-label={t`${character.display} 書寫區`} aria-describedby={helpId} onDragStart={e=>e.preventDefault()} onPointerDown={e => {
        if (active.current) { cancel(t('多指操作已取消此筆，請使用單指書寫。')); return; }
        if (demo || phase === 'accepted' || phase === 'validating' || e.button !== 0 || !e.isPrimary) return;
        if (phase==='completed' || (mode === 'guided' && ink.length >= character.paths.length)) return;
        const point:Point|null = screenToSvg(e.currentTarget, e.clientX, e.clientY);
        if (!point || !insideSquare(point)) return;
        // WebKit can drag the SVG start-number text on a quick retry, swallowing
        // subsequent pointer moves/up even with capture and user-select: none.
        e.preventDefault();
        lastCanvasSize.current = { width: e.currentTarget.getBoundingClientRect().width, scale: window.visualViewport?.scale ?? 1 };
        const matrix=e.currentTarget.getScreenCTM();
        const padding=matrix?Math.min(1024*.08,24/Math.hypot(matrix.a,matrix.b)):0;
        const space={contains:(p:Point)=>insideDrawingArea(p,padding),strokes:character.paths.map((_,n)=>expected(n)),index:ink.length,toScreen:matrix?((p:Point)=>({x:matrix.a*p.x+matrix.c*p.y+matrix.e,y:matrix.b*p.x+matrix.d*p.y+matrix.f})):undefined};
        point.time=e.timeStamp;
        const overrides=import.meta.env.DEV?Object.fromEntries(tuningFields.map(field=>[field.key,tuning[field.key]])):{};
        const guide = mode==='guided'?(fullTrace?(character.strokeFrames?createBlockStroke(character.paths.map((_,n)=>expected(n)),ink.length,character.strokeFrames[ink.length],tracingOptions(writingCharacters.find(c=>c.id===character.strokeFrames![ink.length].sourceId)!,character.strokeFrames[ink.length].sourceIndex),space):createTracingStroke(character.paths.map((_,n)=>expected(n)),ink.length,{...tracingOptions(character,ink.length),...(config!==WRITING_SETTINGS?config.global:{}),...overrides},space)):createGuidedStroke(expected(ink.length),{...strokeOptions(character,ink.length,config),...overrides},space)):null;
        guide?.start(point);
        const refStroke = expected(ink.length);
        setEndTarget(refStroke.length ? refStroke.at(-1)! : null);
        setLiveRecovering(false);setLiveReady(false);
        active.current = { id: e.pointerId, stroke:ink.length, reference:refStroke, rawPoints: [{x:point.x,y:point.y}], guide, outside: false, padding };
        setLiveHead(null);setPhase('drawing'); setLive(guide ? [] : [point]); setLiveProgress(0);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore capture quirks in embedded webviews */ }
        diagnose('pointerdown',active.current,{x:e.clientX,y:e.clientY});
      }} onPointerMove={e => {
        if (active.current?.id !== e.pointerId) return;
        const current = active.current;
        if (e.pointerType === 'mouse' && e.buttons === 0) {
          if (current.guide && !current.outside) { completeGuided(current); return; }
          cancel();
          return;
        }
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
        const samples = events.length ? events : [e];
        for (let idx = 0; idx < samples.length; idx++) {
          const event = samples[idx];
          const point:Point|null = screenToSvg(e.currentTarget, event.clientX, event.clientY);
          if (!point) { cancel(); return; }
          point.time=event.timeStamp;
          current.rawPoints.push({x:point.x,y:point.y}); current.guide?.add(point);
          if (!insideDrawingArea(point,current.padding)) current.outside = true;
          diagnose('pointermove',current,{x:event.clientX,y:event.clientY});
          // Validate on release, requiring a separate actual gesture for each stroke.
        }
        refreshLive(current);
      }} onPointerUp={e => {
        const current = active.current;
        if (!current || current.id !== e.pointerId) return;
        const point:Point|null = screenToSvg(e.currentTarget, e.clientX, e.clientY);
        if (!point) { cancel(); return; }
        point.time=e.timeStamp;
        current.rawPoints.push({x:point.x,y:point.y}); current.guide?.add(point);
        if (!insideDrawingArea(point,current.padding)) current.outside = true;
        diagnose('pointerup',current,{x:e.clientX,y:e.clientY});
        if (current.guide && !current.outside) { completeGuided(current); return; }
        active.current = null; e.currentTarget.releasePointerCapture(e.pointerId); setLive([]); setLiveProgress(0); setLiveRecovering(false); setLiveReady(false); setEndTarget(null);
        if (current.outside) { playWrong(); current.guide?.cancel(); diagnose('finish',current,undefined,{ok:false,reason:'觸點曾超出可見畫布，請重畫目前這一筆。'}); setPhase('rejected'); setMessage(t`請在字框內重畫第 ${ink.length + 1} 筆。`); return; }
        rawInk.current = [...rawInk.current, current.rawPoints]; setInk([...ink, pathFrom(current.rawPoints)]); setPhase('waiting');
      }} onPointerCancel={e => { if (active.current?.id===e.pointerId) cancel(); }} onLostPointerCapture={e => { if (active.current?.id===e.pointerId) cancel(); }}>
        <defs><clipPath id={clipId}><rect width="1024" height="1024"/></clipPath><marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="var(--focus)"/></marker></defs>
        <g clipPath={`url(#${clipId})`}>
        <path className="grid" d="M512 0V1024 M0 512H1024"/>
        {character.paths.map((d, i) => <path key={`${character.id}-${i}`} ref={el => { paths.current[i] = el; }} d={d} className="guide" style={{ opacity: demo || (mode === 'guided' && playback.showGuides) ? .22 : showAnswer ? 1 : 0 }}/>) }
        {mode === 'guided' && !demo && <path d={character.paths[ink.length]??''} className="writing-track" style={{strokeWidth:TRACK_RADIUS_PX*2}} vectorEffect="non-scaling-stroke"/>}
        {mode==='guided'&&!demo&&<path d={character.paths[ink.length]??''} className="active-route"/>}
        {ink.map((d, i) => <path key={i} d={d} className="ink completed-ink" data-stroke-index={i}/>)}
        {acceptedStroke !== null && <path d={character.paths[acceptedStroke]} pathLength="1" className="demo accepted-animation" style={{animationDuration: `${playback.acceptanceMs}ms`}}/>}
        {mode === 'guided' ? <path d={character.paths[ink.length] ?? ''} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - liveProgress} opacity={liveProgress > 0 ? 1 : 0} style={{strokeWidth:8*unitsPerPx}} className="ink live-ink"/> : <path d={pathFrom(live)} className="ink live-ink"/>}
        {demo && character.paths.slice(0, step + 1).map((d, i) => <path key={`${character.id}-${i}`} d={d} pathLength="1" className={i === step ? 'demo animated' : 'demo'} style={{ strokeWidth:(i===step?8:6)*unitsPerPx,animationPlayState: paused ? 'paused' : 'running', animationDuration: `${playback.animationMs}ms` }}/>) }
        {mode === 'guided' && character.starts.map((p, i) => i === (demo?step:ink.length) && <g key={i} className="writing-start"><circle cx={p[0]} cy={p[1]} r="24" fill="var(--focus)"/><text x={p[0]} y={p[1] + 9} textAnchor="middle" fill="var(--canvas)" fontSize="28">{i + 1}</text><path d={`M${p[0]} ${p[1]}l${p[2]} ${p[3]}`} className="direction" markerEnd={`url(#${arrowId})`}/></g>)}
        {!demo&&phase==='drawing'&&liveReady&&endTarget&&<g className="writing-endpoint-ready" transform={`translate(${endTarget.x} ${endTarget.y})`} aria-hidden="true"><circle r="30"/></g>}
        {!demo&&phase==='drawing'&&liveHead&&liveProgress>0&&<g className="writing-head" transform={`translate(${liveHead.x} ${liveHead.y}) scale(${liveHead.scale}) rotate(${liveHead.angle})`} aria-hidden="true"><circle r="7"/><path d="M-3 -4 L2 0 L-3 4"/></g>}
        </g>
      </svg>
      <p role="status" aria-live={phase==='drawing'?"off":"polite"} className="feedback">{demo ? t`示範第 ${step + 1}／${character.paths.length} 筆${paused ? t('（暫停）') : ''}。` : t(message)} <span>{t("已寫 ")}{ink.length}／{character.paths.length}{t(" 筆")}</span></p>
      {qa&&phase==='completed'&&<div className="buttons"><button onClick={reset}>{t("再練一次")}</button><button onClick={()=>{const next=characters[(index+1)%characters.length];if(onCharacterChange)onCharacterChange(next.id);else{reset();setIndex((index+1)%characters.length);}}}>{t("下一個字母 →")}</button></div>}
      {qa&&<div className="buttons controls"><button onClick={() => { reset(); setDemo(true); setMessage(t('依序觀看每一筆。')); }}>{t("示範／重播")}</button><button disabled={!demo} onClick={() => setPaused(!paused)}>{paused ? t('繼續') : t('暫停')}</button><button disabled={phase === 'accepted' || demo} onClick={() => { cancel(); rawInk.current = rawInk.current.slice(0, -1); setInk(ink.slice(0, -1)); setPhase('waiting'); }}>{t("退回一筆")}</button><button onClick={reset}>{t("清除")}</button><button disabled={demo || phase === 'drawing' || phase === 'accepted'} onClick={submit}>{t("提交判定")}</button>{mode === 'free' && <button onClick={() => setShowAnswer(!showAnswer)}>{showAnswer ? t('隱藏答案') : t('顯示答案')}</button>}</div>}
    </section>
    {qa&&<section className="card"><h2>{t("真人音訊審核")}</h2><p>{t("尚無真人錄音。日韓各 5 條調查記錄列於專案資料，未通過授權與人工檢聽，不提供播放。")}</p><p>{t("韓文字母名稱與音節實際讀音須分開審核。")}</p></section>}
    {!qa&&<button className="guided-replay" aria-label={t("示範／重播")} disabled={phase==='accepted'||phase==='completed'} onClick={()=>{cancel();window.clearTimeout(acceptanceTimer.current);setAcceptedStroke(null);setReplayVersion(value=>value+1);setDemo(true);setStep(0);setPaused(false);}}>↻ {t("示範／重播")}</button>}
    <footer><details><summary>{t("筆順來源與練習限制")}</summary><p>{character.components?character.components.map((part,i)=><React.Fragment key={i}><span lang="ko">{part.display}</span>：{part.creator} · {part.license} · <a href={part.source??undefined}>{t("固定版本來源")}</a><br/></React.Fragment>):<>{t("當前字元素材：")}{character.creator} · {character.license} · <a href={character.source ?? undefined}>{t("固定版本來源")}</a></>}{t("。原曲線與來源、授權、修改說明見 ")}<a href={`${import.meta.env.BASE_URL}strokes/catalog/`}>{t("字元資料及來源頁")}</a>。</p><p>{t("132 字索引，129 字技術可試寫；技術通過不等同教師人工驗證。判定僅供練習，手機與教師審查待完成。")}</p>{character.components&&<p>{t("字塊由既有筆畫縮放與定位組成；組合筆畫採 ")}<a href={`${import.meta.env.BASE_URL}strokes/sources/CC-BY-SA-4.0.txt`}>CC BY-SA 4.0</a>{t("，各原作者與授權如上。字形與筆順仍待教師確認。")}</p>}</details></footer>
  </Container>;
}
