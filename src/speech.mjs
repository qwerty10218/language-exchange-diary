export const speechLocale = language => language === 'ja' ? 'ja-JP' : 'ko-KR';
export const matchingVoices = (voices, language) => voices.filter(v => v.lang?.replaceAll('_','-').toLowerCase().split('-')[0] === language);
// Enhanced names are a preference, never a claim of measured voice quality.
export function preferredVoice(voices, language, uri = '') {
  const matches=matchingVoices(voices,language);
  return matches.find(v=>v.voiceURI===uri) ?? [...matches].sort((a,b)=>rank(b)-rank(a))[0] ?? null;
}
const rank = v => (/enhanced|premium|natural|neural/i.test(v.name)?8:0)+(v.localService?2:0)+(v.default?1:0);
export function entrySpeechText(entry) {
  const text=(entry.language==='ja'?entry.reading||entry.text:entry.text)?.trim()??'';
  // Never read personal mnemonics, Chinese glosses or romanization as Japanese/Korean.
  const valid=entry.language==='ja'?/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{P}\p{Z}\p{N}ー〜～]+$/u:/^[\p{Script=Hangul}\p{P}\p{Z}\p{N}]+$/u;
  return valid.test(text)?text:'';
}
/** @type {{supported:boolean,voices:SpeechSynthesisVoice[],owner:string|null,status:string,message:string}} */
export const EMPTY_SPEECH = Object.freeze({supported:false,voices:[],owner:null,status:'idle',message:''});
export function createSpeechPlayer(getEnvironment=()=>typeof window==='undefined'?null:window) {
  let snapshot=EMPTY_SPEECH, environment=null, engine=null, utterance=null, generation=0, timer;
  const listeners=new Set();
  const publish=next=>{snapshot={...snapshot,...next};listeners.forEach(fn=>fn());};
  const clearTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
  const refresh=()=>{try{publish({voices:engine?.getVoices()??[]});}catch{publish({voices:[]});}};
  const stop=(owner)=>{
    if(owner!==undefined&&snapshot.owner!==owner)return;
    generation++;clearTimer();utterance=null;
    engine?.cancel();publish({owner:null,status:'idle',message:''});
  };
  const hide=()=>{if(environment?.document?.hidden)stop();};
  const stopOnNavigation=()=>stop();
  return {
    getSnapshot:()=>snapshot,
    subscribe(listener){
      listeners.add(listener);
      if(listeners.size===1){
        environment=getEnvironment();engine=environment?.speechSynthesis;
        publish({supported:!!(engine&&environment?.SpeechSynthesisUtterance)});
        refresh();engine?.addEventListener('voiceschanged',refresh);
        environment?.addEventListener?.('hashchange',stopOnNavigation);
        environment?.document?.addEventListener?.('visibilitychange',hide);
      }
      return ()=>{
        listeners.delete(listener);
        if(!listeners.size){stop();engine?.removeEventListener('voiceschanged',refresh);environment?.removeEventListener?.('hashchange',stopOnNavigation);environment?.document?.removeEventListener?.('visibilitychange',hide);}
      };
    },
    stop,
    play(owner,text,language,uri='',rate=1){
      stop();refresh();
      const voice=preferredVoice(snapshot.voices,language,uri);
      if(!snapshot.supported||!voice||!text.trim()) {publish({owner,status:'error',message:`裝置尚無${language==='ja'?'日文':'韓文'}語音，請先在系統下載對應聲音。`});return;}
      const token=++generation;
      try {
        utterance=new environment.SpeechSynthesisUtterance(text);
        utterance.lang=speechLocale(language);utterance.voice=voice;utterance.rate=rate===.8?.8:1;utterance.pitch=1;
        const finish=(message='')=>{if(token!==generation)return;clearTimer();utterance=null;publish({owner:message?owner:null,status:message?'error':'idle',message});};
        utterance.onstart=()=>{if(token!==generation)return;clearTimer();publish({status:'speaking'});};
        utterance.onend=()=>finish();
        utterance.onerror=()=>finish('朗讀未成功，請重試或更換裝置聲音。');
        publish({owner,status:'loading',message:''});
        timer=setTimeout(()=>{if(token===generation){stop();publish({owner,status:'error',message:'語音沒有開始播放，請確認系統已下載日／韓語音後再試。'});}},10000);
        // Runs synchronously inside the user's click, including on iOS Safari.
        engine.speak(utterance);
      }catch{clearTimer();utterance=null;publish({owner,status:'error',message:'此瀏覽器目前無法朗讀，請使用支援語音的瀏覽器。'});}
    },
  };
}
export const speechPlayer=createSpeechPlayer();
