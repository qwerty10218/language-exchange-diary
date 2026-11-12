import { useState } from 'react';
import Phase0 from './Phase0';
import { writingCharacters } from './writing';
import { WRITING_SETTINGS, validateSettings } from './writing-config.mjs';
type Config = typeof WRITING_SETTINGS;
const fields = [
  ['startRadius','起點容錯',.05,.25,.01],['snapRadius','磁吸強度（半徑）',.05,.25,.01],
  ['maxDeviation','路徑偏差容忍',.10,.35,.01],['completion','完整描寫最低進度',.75,1,.01],
  ['closeRatio','原始軌跡貼近比例',.60,1,.01],['autoTriggerDistance','方向帶寫起拉距離',.02,.1,.01],
  ['animationMs','示範速度（毫秒／筆）',500,4000,100],['acceptanceMs','完成動畫（毫秒）',200,1000,50],
] as const;
export default function WritingLab() {
  const [config,setConfig]=useState<Config>(()=>structuredClone(WRITING_SETTINGS));
  const [selected,setSelected]=useState('ja-a-hiragana');
  const [notice,setNotice]=useState('');
  const [type,setType]=useState<'straight'|'curve'|'short'|'crossing'>('short');
  const errors=validateSettings(config);
  const json=JSON.stringify(config,null,2);
  const download=()=>{
    const url=URL.createObjectURL(new Blob([json+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='writing-settings.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice('已匯出候選設定。需由維護者覆核後寫回 data/writing-settings.json，再跑 npm run writing:qa -- --write 與 npm run check。');
  };
  return <main className="writing-lab"><h1>書寫調校室</h1><p>僅開發模式可見。調整會重置下方試寫；不會修改正式資料。筆順與反向檢查保持開啟。</p>
    <section className="card"><h2>共用設定</h2>{fields.map(([key,label,min,max,step])=><label key={key}>{label}：<output>{config.global[key]}</output><input type="range" aria-label={label} min={min} max={max} step={step} value={config.global[key]} onChange={e=>setConfig({...config,global:{...config.global,[key]:Number(e.target.value)}})}/></label>)}
    <label><input type="checkbox" checked={config.global.showGuides} onChange={e=>setConfig({...config,global:{...config.global,showGuides:e.target.checked}})}/>顯示參考線</label><p>筆順：嚴格／反方向：拒絕（不提供關閉）</p>
    <h2>筆畫類型</h2><select aria-label="筆畫類型" value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="straight">直線</option><option value="curve">曲線</option><option value="short">短筆</option><option value="crossing">交叉</option></select>
    <label>局部搜尋區間（最多 25%）：<input type="range" min=".02" max=".25" step=".01" value={(config.types[type] as {maxSearchFraction?:number}).maxSearchFraction??.25} onChange={e=>setConfig({...config,types:{...config.types,[type]:{maxSearchFraction:Number(e.target.value)}}})}/></label>
    <div className="buttons"><button onClick={()=>setConfig(structuredClone(WRITING_SETTINGS))}>還原正式設定</button><button disabled={errors.length>0} onClick={async()=>{try{await navigator.clipboard.writeText(json);setNotice('設定已複製；尚未寫入專案。');}catch{setNotice('剪貼簿不可用，請選取下方文字或匯出 JSON。');}}}>複製設定</button><button disabled={errors.length>0} onClick={download}>匯出 JSON</button></div>
    <p role="status">{errors.length?errors.join('；'):notice}</p><textarea aria-label="設定 JSON（唯讀，可複製）" readOnly value={json} rows={8}/></section>
    <label>測試字元<select value={selected} onChange={e=>setSelected(e.target.value)}>{writingCharacters.filter(c=>c.paths.length).map(c=><option key={c.id} value={c.id}>{c.display} · {c.technicalStatus==='passed'?'技術通過':'技術失敗'}</option>)}</select></label>
    {!errors.length && <Phase0 key={selected+json} initialCharacterId={selected} config={config} qa/>}
    <h2>132 字元 QA 總覽</h2><p>SVG、筆畫數、來源、邊界、連續性、順向、反向、錯序、取消與自由書寫標準軌跡由 writing:qa 產生。技術通過不等同教師確認。</p>
    <div className="qa-grid">{writingCharacters.map(c=><article className="card" key={c.id}><h3>{c.display} · {c.strokeCount??'—'} 筆</h3>{c.paths.length>0?<svg viewBox="0 0 1024 1024" aria-label={`${c.display} 標準路徑預覽`}>{c.paths.map((d,i)=><path key={i} d={d} fill="none" stroke="var(--ink)" strokeWidth="24" strokeLinecap="round"/>)}</svg>:<p>缺少中心線</p>}<p>{c.technicalStatus==='passed'?'技術通過':c.technicalStatus==='failed'?'⚠ 技術失敗':'待補'}／人工{c.humanStatus==='verified'?'已驗證':'待驗證'}</p><p>{c.issues.join('；')}</p>{c.source?<a href={c.source}>{c.creator} · {c.license}</a>:<p>來源待補</p>}{c.paths.length>0&&<button onClick={()=>{setSelected(c.id);window.scrollTo({top:0,behavior:'auto'});}}>載入書寫測試{c.technicalStatus==='failed'?'（排查用）':''}</button>}</article>)}</div>
  </main>;
}
