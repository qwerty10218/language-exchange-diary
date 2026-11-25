export const speechLocale = language => language === 'ja' ? 'ja-JP' : 'ko-KR';
export const matchingVoices = (voices, language) => voices.filter(v => v.lang?.replaceAll('_','-').toLowerCase().split('-')[0] === language);
// Enhanced/Online/Default names are preferences, never a claim of measured voice quality.
export function preferredVoice(voices, language, uri = '') {
  const matches=matchingVoices(voices,language);
  return matches.find(v=>v.voiceURI===uri) ?? [...matches].sort((a,b)=>rank(b)-rank(a))[0] ?? null;
}
const rank = v =>
  (/enhanced|premium|natural|neural|online/i.test(v.name)?8:0)+
  (v.default?4:0)+
  (v.localService?2:0)+
  (/haruka|kyoko|otoya|yuna|sunhi|injoon/i.test(v.name)?1:0);

export function entrySpeechText(entry) {
  const text=(entry.language==='ja'?entry.reading||entry.text:entry.text)?.trim()??'';
  if(entry.language==='ja'&&/\p{Script=Han}/u.test(text))return ''; // Unverified kanji reading: do not guess.
  // Never read personal mnemonics, Chinese glosses or romanization as Japanese/Korean.
  const valid=entry.language==='ja'?/^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{P}\p{Z}\p{N}ー〜～]+$/u:/^[\p{Script=Hangul}\p{P}\p{Z}\p{N}]+$/u;
  return valid.test(text)?text:'';
}

// Keep strong references until utterance finishes so Chromium V8 GC never drops callbacks.
const activeUtterances = new Set();

/** @type {{supported:boolean,voices:SpeechSynthesisVoice[],owner:string|null,status:string,message:string}} */
export const EMPTY_SPEECH = Object.freeze({supported:false,voices:[],owner:null,status:'idle',message:''});
export function createSpeechPlayer(getEnvironment=()=>typeof window==='undefined'?null:window) {
  let snapshot=EMPTY_SPEECH, environment=null, engine=null, utterance=null, generation=0, timer, voiceTimer;
  const listeners=new Set();
  const publish=next=>{snapshot={...snapshot,...next};listeners.forEach(fn=>fn());};
  const clearTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
  const clearVoiceTimer=()=>{if(voiceTimer!==undefined){clearTimeout(voiceTimer);voiceTimer=undefined;}};
  const refresh=()=>{try{publish({voices:engine?.getVoices()??[]});}catch{publish({voices:[]});}};
  const releaseUtterance=()=>{if(utterance){activeUtterances.delete(utterance);utterance=null;}};
  const stop=(owner)=>{
    if(owner!==undefined&&snapshot.owner!==owner)return;
    const wasActive=snapshot.owner!==null||Boolean(engine?.speaking||engine?.pending);
    generation++;clearTimer();releaseUtterance();
    // Avoid calling cancel() when completely idle: Windows Chromium can abort the next speak() call.
    if(wasActive){try{engine?.cancel();}catch{}}
    publish({owner:null,status:'idle',message:''});
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
        if(engine&&!(snapshot.voices.length)){clearVoiceTimer();voiceTimer=setTimeout(refresh,300);}
        environment?.addEventListener?.('hashchange',stopOnNavigation);
        environment?.document?.addEventListener?.('visibilitychange',hide);
      }
      return ()=>{
        listeners.delete(listener);
        if(!listeners.size){clearVoiceTimer();stop();engine?.removeEventListener('voiceschanged',refresh);environment?.removeEventListener?.('hashchange',stopOnNavigation);environment?.document?.removeEventListener?.('visibilitychange',hide);}
      };
    },
    stop,
    play(owner,text,language,uri='',rate=1){
      const hadActive=snapshot.owner!==null||Boolean(engine?.speaking||engine?.pending);
      generation++;clearTimer();releaseUtterance();
      if(hadActive){try{engine?.cancel();}catch{}}
      refresh();
      const matches=[...matchingVoices(snapshot.voices,language)].sort((a,b)=>rank(b)-rank(a));
      const primary=preferredVoice(snapshot.voices,language,uri);
      if(!snapshot.supported||!primary||!text.trim()) {
        publish({owner,status:'error',message:`裝置尚無${language==='ja'?'日文':'韓文'}語音，請先在系統下載對應聲音，或改用 Edge／手機瀏覽器開啟。`});
        return;
      }
      const candidates=[primary,...matches.filter(v=>v!==primary)];
      const token=++generation;

      const speakCandidate=(index)=>{
        if(token!==generation)return;
        const voice=candidates[index];
        if(!voice){
          clearTimer();releaseUtterance();
          publish({owner,status:'error',message:'此預覽視窗無法播放系統語音，請複製網址改用 Microsoft Edge／Chrome 或手機瀏覽器開啟。'});
          return;
        }
        try {
          if(engine?.paused){try{engine.resume?.();}catch{}}
          const u=new environment.SpeechSynthesisUtterance(text);
          utterance=u;activeUtterances.add(u);
          let didStart=false;
          u.lang=voice.lang?.replaceAll('_','-')||speechLocale(language);
          u.voice=voice;u.rate=rate===.8?.8:1;u.pitch=1;u.volume=1;
          const finish=(message='')=>{
            if(token!==generation)return;
            clearTimer();releaseUtterance();
            publish({owner:message?owner:null,status:message?'error':'idle',message});
          };
          u.onstart=()=>{
            if(token!==generation)return;
            didStart=true;clearTimer();
            publish({status:'speaking',message:''});
          };
          u.onend=()=>{
            if(token!==generation)return;
            activeUtterances.delete(u);
            // Embedded WebViews or broken OneCore stubs can fire onend without ever firing onstart.
            if(!didStart){speakCandidate(index+1);return;}
            finish();
          };
          u.onerror=()=>{
            if(token!==generation)return;
            activeUtterances.delete(u);
            if(!didStart&&index+1<candidates.length){speakCandidate(index+1);return;}
            finish('朗讀未成功，請重試、更換聲音，或改用 Edge／Chrome／手機瀏覽器開啟。');
          };
          publish({owner,status:'loading',message:''});
          clearTimer();
          timer=setTimeout(()=>{
            if(token===generation){
              stop();
              publish({owner,status:'error',message:'語音沒有開始播放，請改用外部 Edge／Chrome 或手機瀏覽器開啟。'});
            }
          },6000);
          // Runs synchronously inside the user's click, including on iOS Safari.
          engine.speak(u);
        } catch {
          clearTimer();releaseUtterance();
          publish({owner,status:'error',message:'此瀏覽器目前無法朗讀，請使用支援語音的瀏覽器。'});
        }
      };

      speakCandidate(0);
    },
  };
}
export const speechPlayer=createSpeechPlayer();
