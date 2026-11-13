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
