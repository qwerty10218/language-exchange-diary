export const THEME_KEY='language-exchange-diary:theme:v1';
export const THEME_MODES=['auto','light','dark'];
export const resolveTheme=(mode,systemDark)=>mode==='auto'?(systemDark?'dark':'light'):mode==='dark'?'dark':'light';
/** @returns {{mode:'auto'|'light'|'dark',error:string|null}} */
export function loadTheme(getStorage) {
  try {
    const raw=getStorage().getItem(THEME_KEY);
    if(raw===null) return {mode:'auto',error:null};
    const value=JSON.parse(raw);
    if(value?.version===1 && THEME_MODES.includes(value.mode)) return {mode:value.mode,error:null};
    return {mode:'auto',error:'儲存的外觀設定不支援，暫時跟隨系統；原設定未變更。'};
  } catch { return {mode:'auto',error:'無法讀取外觀設定，暫時跟隨系統；學習紀錄不受影響。'}; }
}
export function saveTheme(getStorage,mode) {
  if(!THEME_MODES.includes(mode)) return '不支援的外觀設定。';
  try { getStorage().setItem(THEME_KEY,JSON.stringify({version:1,mode}));return null; }
  catch { return '外觀已套用，但瀏覽器無法保存；下次開啟可能跟隨系統。'; }
}
export function applyTheme(root,mode) { root.dataset.theme=THEME_MODES.includes(mode)?mode:'auto'; }
