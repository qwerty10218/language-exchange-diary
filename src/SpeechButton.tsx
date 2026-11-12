import {useEffect,useId,useState,useSyncExternalStore} from 'react';
import {speechPlayer,EMPTY_SPEECH,matchingVoices,preferredVoice} from './speech.mjs';
import type {Language} from './types';
const serverSnapshot=()=>EMPTY_SPEECH;
export default function SpeechButton({text,language,label=text}:{text:string;language:Language;label?:string}) {
  const id=useId(),hintId=`${id}-speech-hint`;
  const state=useSyncExternalStore(speechPlayer.subscribe,speechPlayer.getSnapshot,serverSnapshot);
  const [voice,setVoice]=useState('');
  const [rate,setRate]=useState(1);
  const voices=matchingVoices(state.voices,language) as SpeechSynthesisVoice[];
  const selected=preferredVoice(voices,language,voice) as SpeechSynthesisVoice|null;
  const own=state.owner===id,busy=own&&(state.status==='loading'||state.status==='speaking');
  useEffect(()=>()=>speechPlayer.stop(id),[id,text,language]);
  if(!text.trim())return <p className="device-note">此詞讀音待確認，暫不提供朗讀。</p>;
  return <div className="speech-control">
    <button type="button" aria-label={`${busy?'停止朗讀':'朗讀（合成語音）'}：${label}`} aria-describedby={hintId} disabled={!state.supported||!selected} onClick={()=>busy?speechPlayer.stop(id):speechPlayer.play(id,text,language,voice,rate)}>{busy?'停止朗讀':'朗讀（合成語音）'}</button>
    <p id={hintId} className="device-note">{!state.supported?'此瀏覽器尚未提供語音朗讀。':!selected?`尚無${language==='ja'?'日文':'韓文'}聲音，請在裝置系統下載對應語音後重開頁面。`:'裝置合成語音，非真人錄音；自然程度依所選聲音而異，部分聲音需要連網。'}</p>
    <p className="device-note">朗讀文字：<span lang={language}>{text}</span></p>
    {selected&&<details><summary>聲音與語速</summary><label htmlFor={`${id}-voice`}>朗讀聲音</label><select id={`${id}-voice`} value={selected.voiceURI} onChange={e=>{speechPlayer.stop(id);setVoice(e.target.value);}}>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}（{v.lang}）</option>)}</select><label htmlFor={`${id}-rate`}>語速</label><select id={`${id}-rate`} value={rate} onChange={e=>{speechPlayer.stop(id);setRate(Number(e.target.value));}}><option value="1">自然速度</option><option value="0.8">慢速練習</option></select></details>}
    <p role="status" className="device-note">{own?state.message:''}</p>
  </div>;
}
