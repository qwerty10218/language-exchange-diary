# 上線驗收清單

## 韓文 40 音書寫（2026-11-12 可驗收版）
- 全40字技術通過；教師／真機人工待驗。329項自動測試、資料／40音QA、TypeScript、Production Build通過。沒有以方向短拉取代韓文完整描寫。
- 標準、偏移抖動、停頓、反向、錯序、短筆跳段、半筆、框外、中斷取消與重啟皆檢查；10個代表字另測中途反向；40個入口回呼／渲染與快照有SSR測試。
- [ ] iPhone Safari實際手指；[ ] 桌面瀏覽器拖曳；[ ] 高速短筆、圓圈與轉折；[ ] 真實Pointer Cancel／多指／旋轉；[ ] 切頁後接續與Light／Dark低光。
- 自動測試不代表字形／筆順已獲教師認證；來源與逐字清單見HANGUL_WRITING.md。既有日文う／や／ネ仍封鎖。

## Light／Dark 與低光閱讀（正式 MVP 驗收條件）
- `npm run check`：資料／書寫 QA、TypeScript、205 項測試及 Production Build 通過。新增主題儲存、系統／手動解析、跨學習頁 SSR、色彩 Token、≥4.5:1 文字配對及 ≥3:1 狀態配對測試。
- [ ] Light 日間實際閱讀；[ ] Dark 夜間閱讀；[ ] 手機低亮度假名／◆／邊框辨識。
- [ ] 多字同時標示的舒適度；[ ] 詞庫→五十音→測驗切頁、重開後主題與題目保存；[ ] 320／375px 真機。
- 自動對比及 SSR 不代表上述人工項目已通過；完整條件、色票及限制見 THEME_ACCESSIBILITY.md。主 JS 約500KB有分包警告，build 成功，未調高警告門檻。

## MVP 單字連動與拼字測驗
- `npm run check`：資料／既有書寫 QA、TypeScript、196 項測試與 production build。五組詞連動、特殊假名、韓文音節、雨傘拼字、訂正不重複計分、加權、五連對、到期複習與非破壞儲存均有自動測試。
- React SSR 檢查實際紅色格數及平片字形隔離，兩份測驗與原翻卡在學習分頁保持掛載；SSR 不代表實際瀏覽器操作或測得無溢出。
- 375px／320px 真機、Safari 點擊與捲動、未送答案查表返回、重開瀏覽器後儲存、長詞與橫向操作待人工驗收。流程與部署建議見 MVP_LEARNING.md。
- 未修改詞庫、Schema、書寫引擎與筆順資料；未 Commit／Push／部署。

## MVP 字母表與批量書寫（2026-11-09）
- 完整 132 字索引；92 個假名及既有 ㅏ 共 93 字有來源中心線，90 字技術通過；う／や反向誤接受、ネ錯序誤接受均已封鎖一般練習，39 個韓文字母待補中心線。人工驗證 0／132。
- 統一 check 包含資料、批量 QA、TypeScript、176 項自動測試及 production build。涵蓋來源曲線與雜湊、邊界／連續性／順向／反向／錯序／取消、設定限制、複習 reducer 與實際 React SSR 標記。
- SSR 確認兩語言複習在各學習分頁皆掛載、字母按鈕 92／40 顆；此項不等同瀏覽器切換操作測試。手機 375px 排版、實際點擊、旋轉、縮放仍未人工驗證。
- 演算法與原三字資料未更動，類型設定只縮小局部搜尋；共用參數與未完成名單見 WRITING_CATALOG.md。
- 瀏覽器工具先前受安全政策阻擋，本次未繞過；不宣稱已完成手機驗收。

## MVP 驗證（2026-11-09，非發布／真機驗收）
- `npm run check`：119 筆資料驗證、TypeScript、77 項測試、production build 通過。新增搜尋、語言隔離、保守合併、複習排序／粗口排除及本機儲存失敗處理測試。
- 以 SHA-256 比對確認 `src/stroke-engine.mjs`、原 `src/style.css`、`data/phase0.strokes.json` 未改；搬至 `src/Phase0.tsx` 的元件內容除匯出與掛載入口外保持一致。
- 瀏覽器工具安全政策拒絕 localhost 頁面，未改用其他瀏覽器繞過；375px 版面、真實點擊翻卡／重整持久化及書寫入口的瀏覽器操作尚未驗證。iPhone Safari 真機亦未驗證。
- 詞庫 6 個欄位差異保留原值，詳見 `MVP_IMPORT_REPORT.md`；119 筆均待查核，沒有可播放真人音檔。
- 本機沒有 `.git`，無法執行 git diff；未新增依賴、未修改書寫演算法、未 Commit／Push／部署。

## 方向帶寫驗證（目前操作）
- `npm run check`：資料、TypeScript、70 項測試與 production build 通過；新增三字七筆短拉、自動完成轉場、點擊／微抖／反向／錯序拒絕與觸發前取消測試。標準曲線未改。
- 375px 瀏覽器：ㅏ第一筆只拉約18 CSS px並放開，仍進入接受與自動補完；手機實際手勢與短拉觸發距離仍需 iPhone Safari 人工驗收。預設引導不再要求75%全筆進度。

## 高寬容練習驗證（目前版本）
- `npm run check`：資料、TypeScript、54 項測試及 production build 通過；包含三字七筆較大偏移／抖動／停頓、短暫離線後恢復、附近前進回線、反向、錯序、交叉跳段與遠處回線拒絕。
- 375px 開發預覽：五項初值正確顯示；磁吸滑桿 13→14% 即時更新，還原後回 13%；約 25 CSS px 偏移的ㅏ第一筆可接受，沒有橫向溢出。正式 bundle 不含開發調參介面。
- 修改範圍：`src/main.tsx`、`src/stroke-engine.mjs`、`src/style.css`、相關測試與書寫／QA 說明；標準字形與詞庫未改。iPhone Safari 的實際恢復手感、多指、旋轉／縮放仍待人工確認。

## Phase 0 檢查記錄（2026-10-30，非上線通過）
- `npm run check`：資料、TypeScript、7 項 Node 測試、production build 通過；測試包含三字正確／偏移／反向／錯序／錯形、短筆、座標換算與資料拒絕案例。
- 桌面瀏覽器：375px 無橫向溢出；ㅏ 引導與自由書寫實際拖曳提交通過；切字重置、示範／暫停及假名路徑顯示已檢查。
- `--preview` 只讀資料、未變更原詞庫；未建立正式匯入器。沒有既有 lint、Git hooks 或 CI 可沿用，本機也尚無 `.git`，無法執行 git diff。
- 未驗證：手機 Safari／Android 真機、真實多指／pointercancel／旋轉與縮放、三字筆順教師審查、真人錄音人工聆聽與逐檔授權覆核；132 字尚未完成。
- 修改檔案：`AGENTS.md`、`README.md`、`docs/AUDIO_SOURCES.md`、`docs/THIRD_PARTY.md`、本檔。
- 新增檔案：`.gitignore`、`package.json`、`package-lock.json`、`tsconfig.json`、`index.html`；`src/{main.tsx,style.css,stroke-engine.mjs,vite-env.d.ts}`；`scripts/{data-validation.mjs,validate-data.mjs}`；`tests/phase0.test.mjs`；`data/{phase0.strokes.json,phase0.audio-candidates.json}`。
- 新增素材：`public/strokes/sources/{12354.svg,12450.svg,15_a.svg,COPYING.txt,LGPL.txt,GPL.txt,CC-BY-SA-4.0.txt,index.html,phase0.strokes.json}`；`.cache/phase0-preview.png` 是已忽略的本機截圖，`node_modules`／`dist` 為安裝與建置產物。

## 資料與查詞

### 2026-10-31 假名字形根因修正驗證
- 修正誤用遮罩動畫折線：あ／ア 改為固定版本 KanjiVG 三／兩筆曲線；參考線、揭露動畫、磁吸顯示與完成筆畫共用標準 `d`；自由書寫保留原始筆跡。
- `npm run check`：資料驗證、TypeScript、37 項測試、production build 通過。新增原始曲線命令／控制點／比例／方向比對與舊錯誤三筆拒絕回歸；保留反向、錯序、交叉、短軌跡及取消檢查。
- 375px 桌面瀏覽器：未觸控的あ成形；前兩筆偏移拖曳通過後 `.completed-ink` 的 `d` 與對應 `.guide` 完全相等；正方形 viewBox、等比例縮放與無橫向溢出已核對。第三筆完整手指操作、真實旋轉／縮放仍待 iPhone Safari 人工驗收。
- 本次未提高既有門檻；新增連續偏離長度限制，防止長筆畫稀釋局部錯誤。教師筆順審查仍待完成，不宣稱專業字形認證。
- [ ] 日文／韓文檔案分離，切換後不混合結果
- [ ] 原文、中文、記音搜尋可正常運作
- [ ] 句子、詞義、個人記音、備註各有獨立欄位
- [ ] 日文漢字有對應假名，不能誤標讀音
- [ ] 未經查核資料維持 `needs_review`
- [ ] JSON schema 檢查、重複 ID／重複字詞檢查運作
- [ ] 無公開的私人聊天內容、朋友個人資訊

## 人聲錄音
- [ ] 每個已提供音檔都有可稽核的來源、真人聲音、授權和署名
- [ ] 音訊完全對得上原文／讀法；有音變時聽的是正確整詞
- [ ] 韓文字母名稱與搭配母音音節的聲音沒有混用
- [ ] 手機 Safari / Chrome 能播放；失敗時不會卡住整頁
- [ ] 找不到音檔時顯示「尚無真人錄音」且不自動播放 TTS
- [ ] 上線宣稱的核心音檔覆蓋率已達維護者核准的門檻（否則不宣稱完整）

## 手寫（132 個基本字元）
- [ ] 19 子音＋21 母音＋46 平假名＋46 片假名字元盤點齊全
- [ ] 每個標示可用的字都有正確筆順路徑與授權來源
- [ ] 筆順動畫每筆依序出現，顯示起點和方向
- [ ] 淡色引導線、字框與十字定位線顯示正確
- [ ] 跟寫模式能回饋每一筆
- [ ] 獨立書寫可檢查筆畫數、方向、順序和近似形狀
- [ ] 手指太粗／偏離少量時不容易錯判
- [ ] `pointercancel`、切頁、轉橫向、縮放與清除能正常重置
- [ ] 畫布不被頁面捲動吃掉事件；畫布以外能捲動
- [ ] 漢字沒有誤出現筆順練習

## UI / 發布
- [ ] iPhone Safari 及常見 Android Chrome 頁面能用（至少實測可得的裝置）
- [ ] 最小 375px 寬沒有橫向溢出、按鈕難點問題
- [ ] 主頁查詞和開始複習不用多次點擊
- [ ] 本機複習資料不會誤當雲端同步；清除資料有提示
- [ ] 畫面中文字、日文、韓文字型與注音正確
- [ ] 不需要登入或後端服務就能從網址開始使用
- [ ] 有第三方版權告知和來源頁
- [ ] Production build 通過；必要測試通過；由擁有者批准發布

## 2026-11-13 PR #1 本機整合驗收

- 基底：main `07e57f0`；唯一開放 PR #1 / `54cc7da`，無衝突。main 部署 Actions `43278914777`、PR Actions `43380246363` 均成功；本機新增修正尚未 Commit / Push，線上 PR 的綠燈不代表已驗證這些新增修正。
- 本機分支：`codex/ux-integration`。未改動日韓原始詞庫、既有進度格式或 storage key，保留 PR 的 7 個新詞與原始記音。
- 修正：React Context 繁簡顯示、OpenCC 最長詞及歧義保護、列表返回位置及焦點、跨首頁／查表／書寫保留題目和翻卡、字母選取保留、完整重設、半形假名及濁音排序、可見的缺語音提示與讀屏名稱。移除舊介面樣式；維持奶茶手帳風格。
- 手機篩選保留原生下拉：兩欄可同時看見目前排序和分類；相較需要左右滑找選項的分類列，更適合日韓切換。320 px 縮減裝飾性英文標語，重設移至結果列，不擠占篩選空間。
- `npm ci` 成功（首次既有 Vite 程序鎖檔，停止該專案程序後重跑成功，0 套件漏洞）；`npm run check` 包含 `validate:data`、`writing:qa`、`typecheck`、`test`、`build`，全部通過；469 項測試。專案沒有另設 lint / formatter 命令。
- `npm run test:browser`：使用選配的外部 Playwright / axe-core runtime，Chrome 與 WebKit 各 108 組版面、7 頁 WCAG A/AA 自動掃描，全部通過且未發現違規；包含 320／375／390／430／768／1440 px、淺色繁體／深色簡體、日韓列表和長單字詳情、翻卡。另以一般桌面 context 檢查 1440 px。報告與截圖在 `.cache/acceptance/`（不加入 Git）。
- 已測互動：繁簡搜尋、排序與篩選並用、無結果重設、按鈕及瀏覽器返回的捲動與焦點、查表與跨頁保留未完成答案、翻卡保留、字母精確標紅、字母→寫字→返回、實際指標描寫與筆畫保留、44 px 主要觸控目標、鍵盤跳至內容、原始 localStorage 不變、偏好重整保存。Chrome 畫布使用 CDP 觸控事件；Windows WebKit 使用指標拖曳。
- 整詞播放控制以明確的 Speech API stub 驗證日／韓語系、假名、停止、替換播放、慢速與缺語音；不等同真人聽驗。此 Windows Chrome 可列出日文語音但未安裝韓文語音；Windows Playwright WebKit 不提供 SpeechSynthesis，已核對不支援提示，不代表 iPhone Safari 不支援。
- Production preview 從 `/language-exchange-diary/` 載入與重整；涵蓋延遲載入書寫資源，未見 JS 錯誤或 HTTP 404。Pages workflow 改為發布前跑完整 `npm run check`，尚未觸發部署。
- P1 待驗：實體 iPhone Safari 的觸控、縮放、VoiceOver、日韓語音品質及聲音下載後行為；老師確認字形與筆順。書寫索引 132 字、129 技術可用、う／や／ネ 3 字維持封鎖，均未宣稱人工驗收完成；真人錄音仍未收錄。
- P2 待改善：主 JS 約 595 kB（gzip 約 159 kB），build 有 chunk 大小提醒；可後續按學習流程切分。僅具第一候選映射的繁簡轉換仍可能有未收錄的語境歧義。
- 狀態：本機技術驗收通過，可供使用者驗收；需明確授權 Commit / Push 才能更新 PR #1，再確認 CI 和真機結果後決定合併／正式發布。
- 重跑瀏覽器：先 `npm run build`；`DIARY_BROWSER_MODULES` 指向含 `playwright` 的 `node_modules`，`DIARY_AXE_MODULES` 指向含 `@axe-core/playwright` 的 `node_modules`，確保已安裝 Chrome 與 Playwright WebKit，再執行 `npm run test:browser`。未將工具依賴加入網站。

## PR #2 字母格子篩選整合驗收（2026-11-13）

- 本節取代上一節「尚未 Commit / Push」的交付狀態：PR #1 已整合上一輪修正及最新分支，`6c5d55c` 的 Actions 通過；PR #2 同步此基底後再交付，不合併 main、不部署。
- 精確比對任意位置：韓文全 19 子音與 21 母音，11 組複合收音拆開、緊音與複合母音保持完整；接受 canonical／compatibility jamo。日文平片假名分開，漢字只用詞庫完整假名，無讀音時不猜測；濁音、半濁音、小假名、促音、長音不折算成其他字。來源仍是 needs_review，不宣稱讀音經老師驗證。
- 修正原篩選器的手機格子不足 44 px、清除鍵只有 36 px、選字收合後焦點遺失、無結果只清搜尋及「顯示全部」仍留下搜尋條件等問題；移除已不用的首字下拉樣式，抽出 `LetterFilter.tsx`。
- 預設收合；選字立即收合並返回觸發按鈕；再選同字取消，標記清除只清字母，「顯示全部」與無結果重設會清搜尋及字母並回教學順序。切換語言清掉無效字母；詳情返回保留搜尋、字母、排序、捲動和焦點。
- 320／375 px 採五欄，390／430 px 及較寬畫面採六欄；實測所有格子與主要控制項至少 44×44 px。原生按鈕支援 Tab／Enter／Space，Escape 收合；使用 aria-expanded、aria-pressed 及中日韓語言標記。
- `npm ci`、`npm run check` 通過；483 項測試，包含全部初聲／母音、11 組複合收音、緊音收音、Unicode 等價字、日文濁音與小字、漢字缺讀音、繁簡搜尋交集及整份詞庫不變。日韓 JSON、單字 ID、記音及 localStorage 進度格式未更動。
- Chrome／Windows Playwright WebKit 各 156 組版面／9 次 axe WCAG A/AA 掃描（合計 312／18）通過，無 JS 錯誤與資源 404；涵蓋前節的學習、語音控制與筆順回歸，並增加四種格子、鍵盤操作、取消與重設的手機實際互動。
- 截圖與機器報告在 `.cache/acceptance/`：例如 `chrome-320-hant-ja-grid-0.png`、`webkit-390-hans-ko-grid-1.png` 和 `report.json`。以 production 子路徑測試；不把暫存截圖加入 Git。
- 未驗證真實 iPhone／VoiceOver，語音聽感仍需人工；Windows WebKit 無原生語音 API，合成語音控制另以 stub 驗證。原有う／や／ネ 3 字封鎖與約 598 kB 主 JS 的 build 提醒維持，不能宣稱完整真人發音或 132 字人工驗收完成。
- 合併順序：先驗收／合併 PR #1，再將 PR #2 base 改為 main、檢視剩餘差異並重跑 CI，最後由擁有者決定合併與發布。
## PR #3 單字引導書寫（2026-11-13，本機驗收）

- 分支 `docs/word-guided-writing-ux-20261113`，遠端原始 HEAD `91420ca` 只有需求文件；依賴 PR #1 `6c5d55c` → PR #2 `f2bf0da` → PR #3，不更改前兩個 PR 或合併順序。本次只有本機程式與測試，未 Commit／Push／合併／部署。
- `writing-sequence.mjs` 與查表去重 helper 分開：保留重複與順序；漢字僅用完整詞庫假名；韓文用 Unicode 母音順序、11 組複合收音拆分，緊音與複合母音保留。`なに`、`라면`、`우동` 和所有複合收音有測試。
- `GuidedWriting.tsx` 共用單字／獨立字母流程。詳情進入只練該詞；字母表進入只練選定字母。短詞列出步驟，長詞只用進度列；最後一筆放開通過後約 650 ms 自動換字，最後停在完成／重練／返回，不跳隨機詞或全表下一字母。
- 正式介面不渲染全字母選單、自由書寫、提交、退回一筆、下一字母及診斷區；開發 `#lab` 保留診斷。判定成功即保存筆畫，成功動畫不攔截下一筆；示範可重播，逐點回饋不連續朗讀。離頁、背景、取消、換字及重播有計時器清理；減少動態效果可用。
- 修正 WebKit 提示換行會令頁面高度縮短、畫布在手勢中位移而誤判不連續的問題：保留足夠提示區高度並避免捲動錨定；每次瀏覽器描寫都檢查畫布前後座標一致，沒有放寬判定器。
- 單字、獨立字元使用不同 session；當次序號與完成筆畫在查表、查詞、測驗間保留。畫字不增加單字正誤統計，不改既有 localStorage keys／格式；整頁重整只承諾已持久化資料。詞庫、ID、記音、needs_review、132 字路徑與判定器參數未變。
- 濁音、半濁音、小假名、促音、長音、標點及封鎖 `う／や／ネ` 明示未開放。可練部分依序練習，但只顯示「已支援的字母練習完成」；完全不支援時不顯示通關或重練。維持 129／132 技術可用，無教師全面認證。
- `npm ci` 成功、0 套件漏洞；首次既有專案 Vite 程序鎖檔，停止該專案舊預覽後重跑。最終 `npm run check` 全過，486 項測試、0 失敗；無新應用依賴。舊 UI 測試依新的放開判定提示與移除公開語音說明更新，保留方向／描寫及 SVG ID 唯一性檢查。
- 瀏覽器最終結果：Chrome／Windows Playwright WebKit 各 174 組版面、10 次 axe WCAG A/AA 掃描全過（完整回歸合計 348／20）；最終語言標記與跨語言返回修正後，另各補驗 12 組明暗／繁簡／減少動態效果版面、1 次 axe 掃描與單字／獨立字母返回流程，全部通過（補驗 24／2）。`report.json` 與 `pr3-post-report.json` 均 passed，無 JS 錯誤或 HTTP 404。手機 context 之外，也使用一般桌面 context；Chrome 包含 CDP 觸控，WebKit 描寫使用滑鼠指標，並非真實 iPhone。繁簡、整詞 TTS API、搜尋／字母篩選／排序、詳情返回、測驗、翻卡、Dark Mode、v1/v2 localStorage 不變與延遲書寫資源均包含在回歸範圍。
- 新增 `scripts/guided-writing-qa.mjs`，併入 `npm run test:browser`。檢查真實指標軌跡、自動換字、重複字母、反向／短拉／錯序／Pointer Cancel、離頁不前進、單字與字母 session 隔離、字母表單字元完成、重播、各寬度與 44 px 控制項。離線回復與多指／縮放取消仍由既有判定器／指標流程測試輔助驗證，不代替真機手感。
- 報告與截圖留在忽略的 `.cache/acceptance/`；`pr3-mobile-light.png`、`pr3-desktop-light.png` 為主要介面，`*-word-writing-390-hans.png` 等為深色簡體與桌面補充。正式子路徑 `/language-exchange-diary/` 驗證，未發布。
- 人工待驗（P1）：實體 iPhone Safari 單指、第二指打斷、縮放、滑出、背景切換與返回；VoiceOver 公告；教師確認字形、筆順、容錯與手感；日韓 TTS 聽感。操作順序：從「なに」完成 な 並等自動切 に；從「라면」走完五步；從「우동」確認最後再練一次 ㅇ；再從字母表單練 あ／ㅏ；在中途查表返回，最後驗證封鎖字與特殊假名沒有假通關。
- 保留限制（P2）：主 JS 約 599 kB／gzip 約 161 kB 的既有 build 大小提醒；真人音訊未收錄，OpenCC 語境歧義與原有真機／教師待驗項目仍保留。
## 使用者修訂：韓文完整音節字塊（2026-11-13）

- 本節取代前節韓文「五個 Jamo 步驟」的交付描述：現在 라면 只有 라 → 면；우동 為 우 → 동；심심하다 為 심 → 심 → 하 → 다。每個字塊的全部筆畫留在同一畫布，完成後才自動換字。日文逐假名與字母表獨立字母入口保留。
- `hangul-blocks.mjs` 沿用現有中心線，處理左右、上下、複合母音、底部單／複合收音、緊音與圓形比例；不是字型外框轉描寫線。`block-tracing.mjs` 將輸入與參考共同映回來源座標，不放寬原判定。顯示進度依實際縮放後弧長映射，避免非等比縮放導致填色超前手指。
- 新增 `data/hangul-block-qa.json`：現有詞庫與驗收樣例共 108 個字塊全部通過正向、反向、短拉、錯序、取消及邊界技術檢查；全部人工狀態 pending。不宣稱支援／驗收全部 11,172 個現代音節。未列入或失敗字塊不回退成逐 Jamo 假通關。
- `npm run writing:blocks` 納入 `npm run check`，會重算並核對來源／布局／判定器簽章；更新韓文詞條、路徑或布局後須 `npm run writing:blocks -- --write`，檢視結果再驗收。新增 metadata 不修改日韓詞庫、原 132 字索引或素材。
- 最終 `npm run check` 全過，492 項測試；完整 Chrome／Windows WebKit 各 174 版面及 10 次 axe 掃描通過，無 JS 錯誤與 HTTP 404。補驗兩種瀏覽器實際描寫 라면、우동、심심하다（包括重複 심），及組合字塊上的反向／短拉／錯序／Pointer Cancel，均通過；獨立 あ 練習仍停在單字元完成畫面。
- 新圖在 `.cache/acceptance/block-da-mobile.png`、`block-ramen-mobile.png`、`block-gallery.png`；gallery 僅供審查字形，不是公開練習頁的格子介面。完整回歸報告仍為 `report.json`；補驗紀錄為 `.cache/block-focused.log`。
- 組合保留各組件作者、來源及原授權；仿射定位衍生筆畫以 CC BY-SA 4.0 提供，來源區列出修改與本地授權全文。沒有新增第三方素材下載。
- 尚未實體 iPhone／VoiceOver／教師人工驗收；字塊的教學比例、筆順與手感仍須教師確認，技術通過不作人工認證。原 う／や／ネ 封鎖與真人音訊未收錄維持。本次仍未 Commit／Push／合併／部署。
## 發布快照與五十音缺項診斷（2026-11-13）

- 使用者已授權將目前版本推送並發布 Pages。此節取代前節「不得 Commit／Push／部署」的交付狀態；合併順序仍為 #1 → #2 → #3，Pages 環境只允許 main。實際發布以 GitHub Actions 的成功部署為準。
- 發布前 `npm run check` 再次全過，492 項測試；字塊 QA 簽章統一 LF，避免 Windows／Linux 換行造成假過期。CI 移除 PR base 限制，使以 feature 分支為基底的 #3 也能被驗證。
- 日文 92 個假名全部已有路徑。う（2 筆）、や（3 筆）、ネ（4 筆）不是缺檔，而是目前索引技術檢查失敗而封鎖。舊 QA 使用 `canAutoComplete()`／`finishDirection()` 的短拉補完模式：う第 1 筆、や第 2 筆反向仍會通過，ネ應寫第 4 筆時輸入第 3 筆也通過。
- 已用目前公開介面的 `finish()` 放開判定作同素材重測：這三字正向全筆通過，反向及錯序全部拒絕。這指出封鎖的直接原因是 QA 仍驗舊操作模式；並非證明教師／實機驗收完成。後續應將 QA 對齊公開判定方式，再對全 132 字重跑，而非直接修改 passed 或放寬門檻。
- 本次先發布已驗證的版本，保留這三字封鎖、原詞庫、來源與 localStorage 相容性；不在發布前夾帶判定器改造。診斷重現結果留在 `.cache/kana-diagnosis.json`，人工驗收仍待完成。
