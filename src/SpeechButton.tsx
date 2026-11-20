import {useChinese} from './Chinese';
import {useEffect,useId,useState,useSyncExternalStore} from 'react';
import {speechPlayer,EMPTY_SPEECH,matchingVoices,preferredVoice} from './speech.mjs';
import type {Language} from './types';
const serverSnapshot=()=>EMPTY_SPEECH;
export function SpeechAvailability({language}:{language:Language}) {
  const {t}=useChinese();
  const state=useSyncExternalStore(speechPlayer.subscribe,speechPlayer.getSnapshot,serverSnapshot);
  const available=preferredVoice(state.voices,language);
  return <p id="word-speech-help" className="speech-availability" role="status">{
    !state.supported?t('此瀏覽器不支援朗讀；可使用支援裝置語音的瀏覽器。'):
    !available?t`裝置尚無${language==='ja'?t('日文'):t('韓文')}聲音，請在系統下載對應語音後重開頁面。`:
    t('聽發音使用裝置合成語音，非真人錄音。點播放中的按鈕可停止。')
  }</p>;
}
export default function SpeechButton({text,language,label=text,compact=false}:{text:string;language:Language;label?:string;compact?:boolean}) {
  const {t}=useChinese();
  const id=useId(),hintId=`${id}-speech-hint`;
  const state=useSyncExternalStore(speechPlayer.subscribe,speechPlayer.getSnapshot,serverSnapshot);
  const [voice,setVoice]=useState('');
  const [rate,setRate]=useState(1);
  const voices=matchingVoices(state.voices,language) as SpeechSynthesisVoice[];
  const selected=preferredVoice(voices,language,voice) as SpeechSynthesisVoice|null;
  const own=state.owner===id,busy=own&&(state.status==='loading'||state.status==='speaking');
  useEffect(()=>()=>speechPlayer.stop(id),[id,text,language]);
  if(!text.trim())return compact?<span className="word-speech-unavailable">{t("讀音待確認")}</span>:<p className="device-note">{t("此詞讀音待確認，暫不提供朗讀。")}</p>;
  if(compact) {
    const unavailable=!state.supported?t('此瀏覽器不支援朗讀'):!selected?t('需要在系統中啟用對應日文或韓文聲音'):'';
    return <div className="word-speech-control">
      <button type="button" className="word-speech-button" aria-describedby="word-speech-help" disabled={!!unavailable}
        title={unavailable||t('使用裝置合成語音朗讀整個詞句（非真人錄音）')}
        aria-label={unavailable?t`聽發音 ${label}：${unavailable}`:t`${busy?t('停止'):t('聽發音')} · 整詞合成語音：${label}`}
        onClick={()=>busy?speechPlayer.stop(id):speechPlayer.play(id,text,language,voice,rate)}>
        <span aria-hidden="true">{busy?'■':'▶'}</span> {busy?t('停止'):t('聽發音')}
      </button>
      {own&&state.message&&<span role="status" className="word-speech-unavailable">{t(state.message)}</span>}
    </div>;
  }
  return <div className="speech-control">
    <button type="button" aria-label={t`${busy?t('停止朗讀'):t('朗讀（合成語音）')}：${label}`} aria-describedby={hintId} disabled={!state.supported||!selected} onClick={()=>busy?speechPlayer.stop(id):speechPlayer.play(id,text,language,voice,rate)}>{busy?t('停止朗讀'):t('朗讀（合成語音）')}</button>
    <p id={hintId} className="device-note">{!state.supported?t('此瀏覽器尚未提供語音朗讀。'):!selected?t`尚無${language==='ja'?t('日文'):t('韓文')}聲音，請在裝置系統下載對應語音後重開頁面。`:t('裝置合成語音，非真人錄音；自然程度依所選聲音而異，部分聲音需要連網。')}</p>
    <p className="device-note">{t("朗讀文字：")}<span lang={language}>{text}</span></p>
    {selected&&<details><summary>{t("聲音與語速")}</summary><label htmlFor={`${id}-voice`}>{t("朗讀聲音")}</label><select id={`${id}-voice`} value={selected.voiceURI} onChange={e=>{speechPlayer.stop(id);setVoice(e.target.value);}}>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}（{v.lang}）</option>)}</select><label htmlFor={`${id}-rate`}>{t("語速")}</label><select id={`${id}-rate`} value={rate} onChange={e=>{speechPlayer.stop(id);setRate(Number(e.target.value));}}><option value="1">{t("自然速度")}</option><option value="0.8">{t("慢速練習")}</option></select></details>}
    <p role="status" className="device-note">{own?t(state.message):''}</p>
  </div>;
}
