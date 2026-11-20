// Optional QA runtime: DIARY_BROWSER_MODULES points to a node_modules containing
// playwright; DIARY_AXE_MODULES can point to one containing @axe-core/playwright.
// No browser testing dependencies are shipped with the application.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {preview} from 'vite';
const require=createRequire(process.env.DIARY_BROWSER_MODULES?join(resolve(process.env.DIARY_BROWSER_MODULES),'qa.cjs'):import.meta.url);
const {chromium,webkit}=require('playwright');
const axeRequire=process.env.DIARY_AXE_MODULES?createRequire(join(resolve(process.env.DIARY_AXE_MODULES),'qa.cjs')):require;
const AxeBuilder=axeRequire('@axe-core/playwright').default;
const output=resolve('.cache/acceptance');await mkdir(output,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4174,strictPort:true}});
const base='http://127.0.0.1:4174/language-exchange-diary/';
const report={started:new Date().toISOString(),engines:[],limitations:['Viewport/touch emulation is not a physical iPhone or VoiceOver test.','Synthetic speech interactions use an explicit API stub; real voice pronunciation and audio quality require listening on the target device.']};
const progressKey='language-exchange-diary:learning:v2',legacyKey='language-exchange-diary:review:v1';
const legacy=JSON.stringify({version:1,entries:{'ja-a-ri-ga-to':'remembered'}});
const learning=JSON.stringify({version:2,records:{'ja-a-ri-ga-to':{correct:2,wrong:1,streak:1,lastPracticed:100,nextReview:0,state:'due'}}});
const errors=[];
const nav=async(page,target)=>{await page.locator(`nav a[href="#${target}"]`).click();await page.waitForURL(`**/#${target}`);};
const script=async(page,mode)=>page.locator('.script-switch button').nth(mode==='hans'?1:0).click();
async function noOverflow(page,label){
  const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert.ok(width.document<=width.viewport+1,`${label}: ${JSON.stringify(width)}`);
}
async function speechStub(page,languages=['ja','ko']){
  await page.addInitScript(langs=>{
    window.__speechCalls=[];window.__speechCancels=0;
    const engine=new EventTarget();
    engine.getVoices=()=>langs.map(lang=>({lang:lang==='ja'?'ja-JP':lang==='ko'?'ko-KR':'en-US',name:'QA voice',voiceURI:lang,localService:true}));
    engine.cancel=()=>{window.__speechCancels++;};
    engine.speak=utterance=>{window.__speechCalls.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate});queueMicrotask(()=>utterance.onstart?.());};
    Object.defineProperty(window,'speechSynthesis',{value:engine,configurable:true});
    window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  },languages);
}
try {
  for(const [name,type,options] of [['chrome',chromium,{channel:'chrome'}],['webkit',webkit,{}]]){
    const browser=await type.launch({headless:true,...options});
    try {
      const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(`${name}: ${error.message}`));
      page.on('response',response=>{if(response.status()>=400)errors.push(`${name}: HTTP ${response.status()} ${response.url()}`);});
      await page.addInitScript(({progressKey,legacyKey,legacy,learning})=>{
        if(!localStorage.getItem(legacyKey))localStorage.setItem(legacyKey,legacy);
        if(!localStorage.getItem(progressKey))localStorage.setItem(progressKey,learning);
      },{progressKey,legacyKey,legacy,learning});
      await page.goto(base+'#library');await page.waitForSelector('.entry-card');
      // Traditional and Simplified searches find the same source entry.
      const search=page.locator('#word-search');
      await search.fill('謝謝');const traditional=await page.locator('.entry-original').allTextContents();
      await script(page,'hans');await search.fill('谢谢');
      assert.deepEqual(await page.locator('.entry-original').allTextContents(),traditional);
      await search.fill('');await script(page,'hant');
      await page.getByRole('combobox',{name:'首字分類',exact:true}).selectOption('な');
      assert.ok((await page.locator('.entry-original').allTextContents()).includes('なす'));
      await search.fill('什麼');assert.deepEqual(await page.locator('.entry-original').allTextContents(),['なに']);
      await search.fill('不存在');await page.getByRole('button',{name:'重設搜尋與篩選'}).click();
      assert.equal(await page.locator('.entry-card').count(),36);
      await page.getByRole('combobox',{name:'單字排序',exact:true}).selectOption('recent');
      assert.equal(await page.locator('.entry-original').first().innerText(),'なに');
      // Detail return preserves filters, search and scroll, including browser Back.
      await search.fill('');await page.getByRole('combobox',{name:'單字排序',exact:true}).selectOption('alphabet');
      const word=page.locator('[data-word-id="ja-u3057-3051-3093"]');
      const target=await word.count()?word:page.locator('.entry-word-link').nth(20);
      await target.scrollIntoViewIfNeeded();const selected=await target.getAttribute('data-word-id');const scroll=await page.evaluate(()=>scrollY);
      await target.click();await page.waitForURL('**/#word');
      await page.getByRole('button',{name:'返回單字表',exact:false}).click();await page.waitForURL('**/#library');
      await page.waitForFunction(y=>Math.abs(scrollY-y)<3,scroll);
      assert.equal(await page.getByRole('combobox',{name:'單字排序',exact:true}).inputValue(),'alphabet');
      assert.equal(await page.locator(':focus').getAttribute('data-word-id'),selected);
      await page.locator(`[data-word-id="${selected}"]`).click();await page.waitForURL('**/#word');await page.goBack();
      await page.waitForFunction(y=>Math.abs(scrollY-y)<3,scroll);
      // Reset language-incompatible initial filters.
      await page.getByRole('combobox',{name:'首字分類',exact:true}).selectOption('な');
      await page.locator('.language-tabs button').first().click();
      assert.equal(await page.getByRole('combobox',{name:'首字分類',exact:true}).inputValue(),'all');
      assert.equal(await page.locator('.entry-card').count(),90);
      await page.locator('.language-tabs button').last().click();
      // An unfinished answer survives lookup, home, writing, language and script switches.
      await nav(page,'review');await page.getByRole('button',{name:'開始測驗 →',exact:true}).click();
      await page.getByRole('button',{name:'輸入 あ',exact:true}).click();
      const prompt=await page.locator('.quiz-prompt:visible').innerText();
      const answer=await page.locator('.answer-slots:visible').innerText();
      await page.getByRole('button',{name:'查字母表',exact:true}).click();
      await page.getByRole('button',{name:'返回測驗 →',exact:true}).click();
      assert.equal(await page.locator('.answer-slots:visible').innerText(),answer);
      await nav(page,'home');await nav(page,'writing');await page.waitForSelector('.writing:visible');
      await page.locator('.writing:visible').scrollIntoViewIfNeeded();
      // Actual pointer input reaches the writing canvas and accepted ink survives navigation.
      const points=await page.locator('.writing:visible').evaluate(svg=>{
        const path=svg.querySelector('.guide'),length=path.getTotalLength(),matrix=svg.getScreenCTM();
        return Array.from({length:41},(_,i)=>{const p=path.getPointAtLength(length*i/40);const screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);return {x:screen.x,y:screen.y};});
      });
      if(name==='chrome'){
        const touch=await context.newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
        for(const point of points.slice(1))await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
      } else {
        await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
        for(const point of points.slice(1))await page.mouse.move(point.x,point.y);
        await page.mouse.up();
      }
      // A vertical SVG stroke has a zero-width geometry box; test accepted DOM ink,
      // not Playwright's rectangular visibility heuristic.
      await page.waitForSelector('.completed-ink',{state:'attached'});
      await nav(page,'home');await nav(page,'writing');assert.equal(await page.locator('.completed-ink').count(),1);
      await nav(page,'review');
      await page.locator('.language-tabs button').first().click();await page.locator('.language-tabs button').last().click();
      await script(page,'hans');assert.equal(await page.locator('.answer-slots:visible').innerText(),answer);
      await script(page,'hant');assert.equal(await page.locator('.quiz-prompt:visible').innerText(),prompt);
      // Existing progress is byte-for-byte unchanged by browsing and preferences.
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),progressKey),learning);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),legacyKey),legacy);
      // Flip cards retain the revealed card across other pages.
      await page.getByRole('button',{name:'改用翻卡練習 →',exact:true}).click();
      await page.getByRole('button',{name:/開始這次複習/}).click();await page.getByRole('button',{name:'翻開答案',exact:true}).click();
      const card=await page.locator('.flashcard-word:visible').innerText();
      await nav(page,'home');await nav(page,'review');await page.getByRole('button',{name:'改用翻卡練習 →',exact:true}).click();
      assert.equal(await page.locator('.flashcard-word:visible').innerText(),card);assert.ok(await page.locator('.flashcard-answer:visible').count());
      // Alphabet -> writing -> alphabet keeps the selection. Japanese word highlights remain exact.
      await nav(page,'library');await page.locator('[data-word-id="ja-u304b-3055"]').click();
      await page.getByRole('button',{name:'查看這個詞的字母 ›',exact:true}).click();
      assert.equal(await page.locator('[data-linked="true"]').count(),2);
      await page.getByRole('button',{name:/^あ，a/}).click();
      await page.getByRole('button',{name:'進入書寫練習',exact:true}).click();await page.waitForSelector('.writing:visible');
      await page.getByRole('button',{name:'← 返回字母表',exact:true}).click();
      assert.equal(await page.locator('.alphabet-grid button[aria-pressed="true"]').count(),1);
      // Keyboard skip link reaches the visible page heading.
      await nav(page,'home');await page.locator('.skip-link').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator(':focus').evaluate(el=>el.tagName),'H1');
      const engineReport={name,layoutChecks:0,axeChecks:[],nativeSpeech:await page.evaluate(()=>({supported:'speechSynthesis'in window,voices:window.speechSynthesis?.getVoices().map(v=>v.lang)??[]}))};
      for(const asset of ['licenses/OpenCC-APACHE-2.0.txt','strokes/catalog/','strokes/catalog/writing-index.json']){
        assert.equal((await context.request.get(base+asset)).status(),200,`${name}: ${asset}`);
      }
      // Real engine layout and accessibility checks, without speech stubs.
      for(const width of [320,375,390,430,768,1440]){
        await page.setViewportSize({width,height:844});
        for(const mode of ['hant','hans']){
          await nav(page,'home');await script(page,mode);
          await page.locator('.home-settings summary').click();
          await page.getByRole('button',{name:mode==='hans'?'深色':'淺色',exact:true}).click();
          for(const route of ['home','library','alphabet','review','writing']){
            await nav(page,route);if(route==='writing')await page.waitForSelector('.writing:visible');
            await noOverflow(page,`${name}/${width}/${mode}/${route}`);engineReport.layoutChecks++;
            const small=await page.locator('button:visible,input:visible,select:visible,nav a:visible').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9;}).map(el=>({tag:el.tagName,text:el.textContent?.slice(0,30)})));
            assert.deepEqual(small,[],`${name}/${width}/${route}: touch targets`);
            if(width===390&&mode==='hans'){
              const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
              engineReport.axeChecks.push({route,violations:result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
              assert.deepEqual(result.violations.map(v=>v.id),[],`${name}/${route} accessibility`);
            }
            if((width===320||width===390||width===1440)&&route==='library')await page.screenshot({path:join(output,`${name}-${width}-${mode}-library.png`)});
            if(route==='library'){
              const longest=page.locator('.entry-word-link').filter({hasText:'パーソナルコンピューター'});
              await longest.click();await noOverflow(page,`${name}/${width}/${mode}/word`);engineReport.layoutChecks++;
              if(width===390&&mode==='hans'){
                const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
                engineReport.axeChecks.push({route:'word',violations:result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
                assert.deepEqual(result.violations.map(v=>v.id),[],`${name}/word accessibility`);
              }
              await page.locator('.word-detail > button').first().click();
              await page.locator('.language-tabs button').first().click();
              await noOverflow(page,`${name}/${width}/${mode}/ko-library`);engineReport.layoutChecks++;
              const longestKorean=await page.locator('.entry-word-link').evaluateAll(elements=>elements.sort((a,b)=>b.querySelector('.entry-original').textContent.length-a.querySelector('.entry-original').textContent.length)[0].dataset.wordId);
              await page.locator(`[data-word-id="${longestKorean}"]`).click();
              await noOverflow(page,`${name}/${width}/${mode}/ko-word`);engineReport.layoutChecks++;
              await page.locator('.word-detail > button').first().click();
              await page.locator('.language-tabs button').last().click();
            }
            if(route==='review'){
              await page.locator('.mode-switch button:visible').click();await noOverflow(page,`${name}/${width}/${mode}/flashcards`);engineReport.layoutChecks++;
              if(width===390&&mode==='hans'){
                const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
                engineReport.axeChecks.push({route:'flashcards',violations:result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
                assert.deepEqual(result.violations.map(v=>v.id),[],`${name}/flashcards accessibility`);
              }
            }
          }
        }
      }
      // Preference survives reload and returns cleanly to Traditional.
      await nav(page,'library');await script(page,'hans');await page.reload();await page.waitForSelector('.entry-card');
      assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hans');
      assert.equal(await page.locator('h1:visible').innerText(),'单字表');await script(page,'hant');
      assert.equal(await page.locator('h1:visible').innerText(),'單字表');
      const desktop=await browser.newContext({viewport:{width:1440,height:1000}}),desktopPage=await desktop.newPage();
      await desktopPage.goto(base+'#library');await desktopPage.waitForSelector('.entry-card');
      await noOverflow(desktopPage,`${name}/desktop`);await desktopPage.screenshot({path:join(output,`${name}-desktop.png`)});await desktop.close();
      // Deterministic API-only audio interaction checks; never imply a listening test.
      const audio=await context.newPage();await speechStub(audio);await audio.goto(base+'#library');
      await audio.locator('.word-speech-button').first().click();
      assert.equal(new URL(audio.url()).hash,'#library');
      await audio.getByRole('button',{name:/^停止 · 整詞合成語音/}).click();
      const beautiful=audio.locator('.entry-card').filter({has:audio.locator('[data-word-id="ja-u-tsu-ku-shii"]')});
      await beautiful.locator('.word-speech-button').click();
      assert.deepEqual(await audio.evaluate(()=>window.__speechCalls.at(-1)),{text:'うつくしい',lang:'ja-JP',rate:1});
      await audio.locator('.word-speech-button').first().click();
      assert.equal(await audio.getByRole('button',{name:/^停止 · 整詞合成語音/}).count(),1);
      await beautiful.locator('.entry-word-link').click();await audio.locator('.speech-control summary').click();
      await audio.getByRole('combobox',{name:'語速',exact:true}).selectOption('0.8');
      await audio.getByRole('button',{name:/^朗讀（合成語音）/}).click();
      assert.equal((await audio.evaluate(()=>window.__speechCalls.at(-1))).rate,0.8);
      await nav(audio,'library');
      await audio.locator('.language-tabs button').first().click();await audio.locator('.word-speech-button').first().click();
      assert.equal((await audio.evaluate(()=>window.__speechCalls.at(-1))).lang,'ko-KR');
      const missing=await context.newPage();await speechStub(missing,['en']);await missing.goto(base+'#library');
      await missing.waitForSelector('#word-speech-help');assert.match(await missing.locator('#word-speech-help').innerText(),/系統下載/);
      assert.ok(await missing.locator('.word-speech-button').first().isDisabled());
      report.engines.push(engineReport);console.log(`${name}: flows passed, ${engineReport.layoutChecks} layouts, ${engineReport.axeChecks.length} axe audits`);
      await context.close();
    } finally {await browser.close();}
  }
  assert.deepEqual(errors,[],'No runtime errors or resource 404s');
  report.passed=true;
} catch(error){report.passed=false;report.error=error.stack;throw error;}
finally {report.errors=errors;await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await new Promise(resolve=>server.httpServer.close(resolve));}
