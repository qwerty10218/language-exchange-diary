import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadTheme, saveTheme, applyTheme, resolveTheme, THEME_KEY } from '../src/theme.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const css=read('../src/themes.css');
const palette=mode=>Object.fromEntries([...css.matchAll(new RegExp(`--${mode}-([a-z-]+):\\s*(#[a-f0-9]{6});`,'g'))].map(m=>[m[1],m[2]]));
const luminance=hex=>{
  const rgb=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (hi+.05)/(lo+.05);};
const surfaces=['page','paper','soft','selected','rose-bg','error-bg','success-bg','canvas'];
for(const mode of ['light','dark']) {
  const p=palette(mode);
  test(`${mode}：一般文字、次要文字與連結在各實際表面至少 4.5:1`,()=>{
    assert.equal(Object.keys(p).length,24);
    for(const text of ['ink','muted','link']) for(const bg of surfaces) assert.ok(contrast(p[text],p[bg])>=4.5,`${mode} ${text}/${bg}: ${contrast(p[text],p[bg])}`);
    for(const [text,bg] of [['on-accent','accent'],['on-accent','accent-hover'],['rose','rose-bg'],['error','error-bg'],['success','success-bg']]) assert.ok(contrast(p[text],p[bg])>=4.5,`${text}/${bg}`);
  });
  test(`${mode}：按鍵、焦點、標紅及回饋邊框至少 3:1`,()=>{
    for(const bg of ['page','paper','soft','selected','rose-bg','error-bg','success-bg']) {
      assert.ok(contrast(p['control-border'],p[bg])>=3,`control-border/${bg}`);
      assert.ok(contrast(p.focus,p[bg])>=3,`focus/${bg}`);
    }
    for(const kind of ['rose','error','success']) {
      for(const bg of [`${kind}-bg`,'paper','page']) assert.ok(contrast(p[`${kind}-border`],p[bg])>=3,`${kind}-border/${bg}`);
    }
    assert.ok(contrast(p.guide,p.canvas)>=3);
    assert.ok(contrast(p.canvas,p.focus)>=4.5,'writing number label');
  });
}
test('主題色彩唯一集中，元件與樣式沒有散落色碼；正誤與假名不共用色彩',()=>{
  for(const file of ['../src/style.css','../src/mvp.css','../src/Alphabet.tsx','../src/Quiz.tsx','../src/ThemeControl.tsx','../src/Phase0.tsx','../src/WritingLab.tsx']) assert.doesNotMatch(read(file),/#[0-9a-f]{3,8}\b/i,file);
  const light=palette('light'),dark=palette('dark');
  assert.deepEqual(Object.keys(light),Object.keys(dark));
  assert.notEqual(light.rose,dark.rose);assert.notEqual(light['rose-bg'],dark['rose-bg']);
  assert.notEqual(light.error,light.rose);assert.notEqual(dark.error,dark.rose);
  assert.doesNotMatch(css,/#[0]{6}\b|#[f]{6}\b/i);
  assert.match(read('../src/Alphabet.tsx'),/linked-marker[^]*◆/);
  assert.match(read('../src/Quiz.tsx'),/✕ 還沒拼對/);
  assert.match(read('../src/mvp.css'),/box-shadow:none/);
  const defined=new Set([...css.matchAll(/(--[a-z-]+):/g)].map(m=>m[1]));
  for(const file of ['../src/style.css','../src/mvp.css']) for(const [,token] of read(file).matchAll(/var\((--[a-z-]+)\)/g)) assert.ok(defined.has(token),`missing token ${token}`);
});
test('自動跟隨系統，手動主題不被系統變化覆寫',()=>{
  assert.equal(resolveTheme('auto',false),'light');assert.equal(resolveTheme('auto',true),'dark');
  for(const system of [true,false]) {assert.equal(resolveTheme('dark',system),'dark');assert.equal(resolveTheme('light',system),'light');}
  const root={dataset:{}};applyTheme(root,'dark');assert.equal(root.dataset.theme,'dark');applyTheme(root,'auto');assert.equal(root.dataset.theme,'auto');
  assert.match(css,/@media \(prefers-color-scheme: dark\)/);
  assert.match(css,/:root:not\(\[data-theme="light"\]\)/);
  assert.match(css,/:root\[data-theme="dark"\]/);
});
test('主題偏好跨重新載入保留，不修改學習與舊翻卡紀錄',()=>{
  const map=new Map([['language-exchange-diary:learning:v2','keep quiz'],['language-exchange-diary:review:v1','keep legacy']]);
  const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
  assert.equal(loadTheme(()=>storage).mode,'auto');
  for(const mode of ['dark','light','auto']) {
    assert.equal(saveTheme(()=>storage,mode),null);assert.equal(loadTheme(()=>storage).mode,mode);
  }
  assert.equal(map.get('language-exchange-diary:learning:v2'),'keep quiz');assert.equal(map.get('language-exchange-diary:review:v1'),'keep legacy');
});
test('外觀儲存損壞／權限限制不會阻礙閱讀，不靜默改寫原值',()=>{
  for(const raw of ['broken',JSON.stringify({version:3,mode:'dark'}),JSON.stringify({version:1,mode:'neon'})]) {
    const storage={getItem:()=>raw};assert.equal(loadTheme(()=>storage).mode,'auto');assert.ok(loadTheme(()=>storage).error);
  }
  assert.equal(loadTheme(()=>{throw Error('denied');}).mode,'auto');
  assert.ok(saveTheme(()=>({setItem:()=>{throw Error('quota');}}),'dark'));
});
test('HTML 先套用合法偏好，避免手動深色使用者先看到淺色頁',()=>{
  const html=read('../index.html'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(html,/name="color-scheme" content="light dark"/);
  assert.match(html,/rel="stylesheet" href="\/src\/themes.css"/);
  assert.ok(html.indexOf('href="/src/themes.css"')<html.indexOf('src="/src/main.tsx"'));
  assert.ok(html.indexOf(script)<html.indexOf('src="/src/main.tsx"'));
  for(const mode of ['dark','light','auto']) {
    const document={documentElement:{dataset:{}}};
    vm.runInNewContext(script,{document,localStorage:{getItem:key=>{assert.equal(key,THEME_KEY);return JSON.stringify({version:1,mode});}}});
    assert.equal(document.documentElement.dataset.theme,mode);
  }
  assert.doesNotThrow(()=>vm.runInNewContext(script,{localStorage:{getItem:()=>{throw Error('denied');}}}));
});
