import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement,Children,isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import { wordLetters } from '../src/word-letters.mjs';
import { THEME_KEY } from '../src/theme.mjs';

test('實際 React 標記：獨立功能頁、完整字母表及不遺失的測驗狀態',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'});
  const previous=globalThis.window;
  try {
    globalThis.window={location:{hash:'#library'},localStorage:{getItem:()=>null}};
    const {default:App}=await server.ssrLoadModule('/src/MvpApp.tsx');
    const {default:Alphabet,CharacterInfo}=await server.ssrLoadModule('/src/Alphabet.tsx');
    const {default:Phase0}=await server.ssrLoadModule('/src/Phase0.tsx');
    const {default:SpeechButton}=await server.ssrLoadModule('/src/SpeechButton.tsx');
    const {writingCharacters,canPractice}=await server.ssrLoadModule('/src/writing.ts');
    for(const [language,text] of [['ja','かさ'],['ko','우유']]) {
      const html=renderToStaticMarkup(createElement(SpeechButton,{language,text}));
      assert.ok(html.includes(`aria-label="朗讀（合成語音）：${text}"`));
      assert.match(html,/disabled=""/); // No browser/voice: never expose fake playback.
      assert.ok(html.includes(`<span lang="${language}">${text}</span>`));
    }
    const japanesePractice=renderToStaticMarkup(createElement(Phase0,{initialCharacterId:'ja-a-hiragana'}));
    assert.match(japanesePractice,/每筆至少沿線畫到 75%/);
    assert.doesNotMatch(japanesePractice,/方向正確就自動補完|起拉觸發距離/);
    // Main practice remains mounted while the lab mounts a second canvas.
    const canvases=renderToStaticMarkup(createElement('div',null,
      createElement('div',{hidden:true},createElement(Phase0,{initialCharacterId:'ko-a'})),
      createElement(Phase0,{initialCharacterId:'ja-a-hiragana',qa:true})));
    const ids=[...canvases.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(ids.length,8);
    assert.equal(new Set(ids).size,ids.length,'Each canvas owns its SVG definitions and help text');
    for(const canvas of canvases.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
      const html=canvas[0];
      const clip=html.match(/<clipPath id="([^"]+)"/)[1];
      const arrow=html.match(/<marker id="([^"]+)"/)[1];
      assert.ok(html.includes(`clip-path="url(#${clip})"`));
      assert.ok(html.includes(`marker-end="url(#${arrow})"`));
      assert.ok(ids.includes(html.match(/aria-describedby="([^"]+)"/)[1]));
    }
    for(const route of ['#home','#library','#alphabet','#review']) {
      window.location.hash=route;
      const html=renderToStaticMarkup(createElement(App));
      for(const page of ['library','alphabet','review','writing'])assert.ok(html.includes(`href="#${page}"`));
      if(route==='#home') {
        assert.match(html,/今天想學什麼/);
        assert.doesNotMatch(html,/aria-label="中文日文拼字測驗"/);
        assert.doesNotMatch(html,/class="entry-list"/);
      } else {
        assert.match(html,/focused-workspace/);
        assert.match(html,/aria-label="中文日文拼字測驗"/);
        assert.match(html,/aria-label="中文韓文拼字測驗"/);
        // Quiz components remain mounted while lookup/table/flashcards are selected.
        if(route!=='#review')assert.match(html,/<div hidden=""><div class="mode-switch"/);
        if(route==='#library') {
          assert.match(html,/class="entry-list"/);
          assert.match(html,/aria-label="播放整詞合成語音：/);
          assert.match(html,/聽發音/);
        }
        if(route==='#alphabet')assert.match(html,/完整五十音表/);
      }
    }
    for(const [language,count] of [['ja',92],['ko',40]]) {
      const html=renderToStaticMarkup(createElement(Alphabet,{language,onWrite:()=>{}}));
      assert.equal((html.match(/aria-pressed="false"/g)??[]).length,count);
      for(const c of writingCharacters.filter(c=>c.language===language)) assert.ok(html.includes(`aria-label="${c.display}，${c.romanization}"`));
      assert.doesNotMatch(html,/<audio|播放錄音|播放語音/);
    }
    assert.equal(writingCharacters.filter(canPractice).length,129);
    for(const c of writingCharacters.filter(c=>c.technicalStatus!=='passed')) assert.equal(canPractice(c),false);
    const ja=JSON.parse(fs.readFileSync(new URL('../data/ja.entries.json',import.meta.url),'utf8'));
    for(const [text,letters] of [['かさ',['か','さ']],['すいか',['す','い','か']]]) {
      const word=ja.find(e=>e.text===text);
      const html=renderToStaticMarkup(createElement(Alphabet,{language:'ja',onWrite:()=>{},linkedWord:word,linkedLetters:wordLetters(word),onReturn:()=>{},onQuiz:()=>{}}));
      assert.equal((html.match(/data-linked="true"/g)??[]).length,letters.length);
      for(const letter of letters) assert.ok(html.includes(`aria-label="${letter}，${writingCharacters.find(c=>c.display===letter).romanization}，單字使用的字母"`));
      assert.match(html,/返回單字/);assert.match(html,/返回測驗/);
      // The counterpart katakana tiles stay unmarked.
      assert.doesNotMatch(html,/aria-label="[カサスイ]，[^"]*單字使用的字母/);
    }
    for(const [mode,label] of [['auto','自動'],['light','淺色'],['dark','深色']]) {
      window.localStorage={getItem:key=>key===THEME_KEY?JSON.stringify({version:1,mode}):null};
      window.matchMedia=()=>({matches:true});
      window.location.hash='#home';
      const html=renderToStaticMarkup(createElement(App));
      assert.ok(html.includes(`<button aria-pressed="true"><span aria-hidden="true">✓ </span>${label}</button>`));
      assert.match(html,/閱讀主題/);
    }
    for(const character of writingCharacters.filter(c=>c.language==='ko')) {
      let launched=null;
      const tree=CharacterInfo({character,onWrite:id=>{launched=id;}});
      const visit=node=>{if(!isValidElement(node))return;if(node.type==='button'&&node.props.children==='進入書寫練習')node.props.onClick();Children.forEach(node.props.children,visit);};
      visit(tree);assert.equal(launched,character.id);
      const html=renderToStaticMarkup(createElement(Phase0,{initialCharacterId:launched}));
      assert.ok(html.includes(`aria-label="${character.display} 書寫區"`));
      assert.equal((html.match(/class="guide"/g)??[]).length,character.strokeCount);
      assert.match(html,/沿線描寫/);assert.doesNotMatch(html,/方向正確就自動補完/);
    }
    const mieum=writingCharacters.find(c=>c.display==='ㅁ');
    const snapshot={ink:[mieum.paths[0]],rawInk:[],mode:'guided',phase:'waiting',message:'已保留第一筆',demo:false,step:0,paused:true,showAnswer:false};
    const restored=renderToStaticMarkup(createElement(Phase0,{initialCharacterId:mieum.id,snapshot}));
    assert.match(restored,/completed-ink/);assert.match(restored,/已保留第一筆/);
    const restarted=renderToStaticMarkup(createElement(Phase0,{initialCharacterId:mieum.id}));
    assert.doesNotMatch(restarted,/completed-ink/);
  } finally {
    if(previous===undefined) delete globalThis.window;else globalThis.window=previous;
    await server.close();
  }
});
