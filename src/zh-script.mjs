import dictionary from '../data/zh-hant-to-hans.json' with {type:'json'};

// OpenCC (Apache-2.0), bundled for reliable offline conversion.
// Keep language-learning content in its original script by marking lang="ja"/"ko".
const phraseEntries=Object.entries(dictionary.phrases).sort((a,b)=>b[0].length-a[0].length);
const phrasePattern=new RegExp(phraseEntries.map(([s])=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
export const SCRIPT_KEY='language-exchange-diary:chinese-script:v1';
export function toSimplified(value) {
  const original=String(value??'');
  const text=original.replace(phrasePattern,match=>dictionary.phrases[match]??match);
  return Array.from(text,ch=>dictionary.chars[ch]??ch).join('');
}
export function loadScript(getStorage=()=>localStorage){
  try { return getStorage().getItem(SCRIPT_KEY)==='hans'?'hans':'hant'; } catch {return 'hant';}
}
export function saveScript(mode,getStorage=()=>localStorage){
  try{getStorage().setItem(SCRIPT_KEY,mode);}catch{} // Remain usable in private browsing.
}
function languageContent(node){
  for(let el=node.nodeType===1?node:node.parentElement;el;el=el.parentElement){
    if(el instanceof Element){
      if(el.closest('[data-preserve-script]'))return true;
      if(el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='PRE'||el.tagName==='CODE'||el.tagName==='TEXTAREA'||el.tagName==='SVG')return true;
      const lang=el.getAttribute('lang');
      if(lang&&/^(ja|ko)(-|$)/i.test(lang))return true;
    }
  }
  return false;
}
// The original DOM text/attributes are preserved in WeakMaps, so switching
// back to Traditional never reverse-converts words or damages original data.
export function observeChineseScript(root,mode) {
  if(!root || typeof MutationObserver==='undefined')return ()=>{};
  const originals=new WeakMap();
  const attrs=new WeakMap();
  const translateText=node=>{
    if(languageContent(node))return;
    const value=node.nodeValue??'';
    const previous=originals.get(node);
    const source=previous&&value===previous.last?previous.original:value;
    const next=mode==='hans'?toSimplified(source):source;
    originals.set(node,{original:source,last:next});
    if(value!==next)node.nodeValue=next;
  };
  const translateAttributes=el=>{
    if(languageContent(el))return;
    let state=attrs.get(el);
    if(!state){state={};attrs.set(el,state);}
    for(const key of ['aria-label','placeholder','title','alt']){
      if(!el.hasAttribute(key))continue;
      const current=el.getAttribute(key)??'';
      const previous=state[key];
      const source=previous&&current===previous.last?previous.original:current;
      const next=mode==='hans'?toSimplified(source):source;
      state[key]={original:source,last:next};
      if(current!==next)el.setAttribute(key,next);
    }
  };
  const apply=node=>{
    if(node.nodeType===3){translateText(node);return;}
    if(node.nodeType!==1||languageContent(node))return;
    translateAttributes(node);
    for(const child of node.childNodes)apply(child);
  };
  apply(root);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='characterData')apply(record.target);
      else if(record.type==='attributes')translateAttributes(record.target);
      else for(const child of record.addedNodes)apply(child);
    }
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','placeholder','title','alt']});
  return ()=>observer.disconnect();
}
