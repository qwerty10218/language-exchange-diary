import { useEffect, useState } from 'react';
import { applyTheme, loadTheme, resolveTheme, saveTheme, THEME_KEY } from './theme.mjs';
const options=[{mode:'auto',label:'自動'},{mode:'light',label:'淺色'},{mode:'dark',label:'深色'}] as const;
export default function ThemeControl() {
  const [initial]=useState(()=>loadTheme(()=>window.localStorage));
  const [mode,setMode]=useState(initial.mode),[error,setError]=useState(initial.error);
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.('(prefers-color-scheme: dark)').matches??false);
  useEffect(()=>{applyTheme(document.documentElement,mode);},[mode]);
  useEffect(()=>{
    const media=window.matchMedia?.('(prefers-color-scheme: dark)');
    const update=()=>setSystemDark(media?.matches??false);
    if(media?.addEventListener) media.addEventListener('change',update);
    else media?.addListener(update);
    const sync=(event:StorageEvent)=>{
      if(event.key!==THEME_KEY) return;
      const next=loadTheme(()=>window.localStorage);setMode(next.mode);setError(next.error);
    };
    window.addEventListener('storage',sync);
    return ()=>{if(media?.removeEventListener) media.removeEventListener('change',update);else media?.removeListener(update);window.removeEventListener('storage',sync);};
  },[]);
  const actual=resolveTheme(mode,systemDark);
  return <div className="theme-toolbar"><fieldset className="theme-control"><legend>閱讀外觀</legend><div role="group" aria-label="閱讀主題">{options.map(option=><button key={option.mode} aria-pressed={mode===option.mode} onClick={()=>{setMode(option.mode);applyTheme(document.documentElement,option.mode);setError(saveTheme(()=>window.localStorage,option.mode));}}>{mode===option.mode&&<span aria-hidden="true">✓ </span>}{option.label}</button>)}</div><span className="theme-status" aria-live="polite">{mode==='auto'?'跟隨系統 · ':''}{actual==='dark'?'深色':'淺色'}</span></fieldset>{error&&<p className="theme-error" role="status">{error}</p>}</div>;
}
