# 雙 AI 協作更新紀錄（Codex ↔ Antigravity）

本檔供 **原生 Codex** 與 **Antigravity**（及其他 AI 助理）在同一個 Repository 交互接力開發時使用。  
原則：**開工前先讀本檔與 `git status`，交接前跑完 `npm run check` 並追加一筆精簡紀錄；未經使用者明確指示，雙方皆不擅自 Commit／Push／部署。**

---

## 雙 AI 分工與受保護契約

- **建議分工**：
  - **Codex**：手寫幾何演算法（`screen-tracing.mjs` / `tracing-engine.mjs` / `block-tracing.mjs`）、字元與字塊批次 QA、Playwright 自動回歸。
  - **Antigravity**：手機端手寫 UX／觸控細節、多鄰國式每日互動遊戲化、PWA 離線安裝化、視覺易用性與跨流程整合。
  - 兩方皆可互相 Review 與延續彼此工作，修改前須確認未破壞下列契約。
- **共同受保護契約（不得無預警破壞）**：
  1. 詞庫隔離與原樣保留：`data/ko.entries.json`、`data/ja.entries.json` 嚴格分離，保留 `personal_mnemonic` 與 `needs_review`。
  2. 本機資料相容：既有的 `language-exchange-diary:review:v1`、`language-exchange-diary:learning:v2`、`language-exchange-diary:theme:v1`、`language-exchange-diary:script:v1` 不更動結構；新增遊戲化狀態獨立使用 `language-exchange-diary:game:v1`。
  3. 色彩集中：所有 Hex 色碼只存在於 `src/themes.css`（24 組 Light/Dark Token），其餘元件與 CSS 僅使用 `var(--...)`。
  4. 真人音訊規則：合成語音（SpeechSynthesis）與互動微音效（Web Audio）嚴格與詞庫 `audio` 欄位隔離，不冒充真人錄音。
  5. 既有測試契約：`Phase0.tsx` SVG ID 數量、`Alphabet.tsx` 按鈕 `aria-pressed` 數量、`index.html` 首段 inline `<script>` 主題初始化均受自動測試保護。

---

## 交接紀錄模板

```markdown
### YYYY-MM-DD｜執行 AI：Codex / Antigravity｜階段名稱
- **分支與基底**：`<branch>` @ `<commit>`（是否含前任未提交修改）
- **變更範圍**：新增／修改的主要檔案清單
- **契約檢查**：詞庫 / localStorage / 色票 / 判定器簽章是否維持相容
- **驗證結果**：`npm run check` 測試數與 build 結果（若跑 `test:browser` 一併註明）
- **已知限制與 Next Handoff**：尚未實機驗收項、建議下一個 AI 接手的任務
```

---

## 更新歷史

### 2026-11-14｜執行 AI：Codex｜手寫寬軌道（35px）與流暢度修正（本機未提交快照）
- **分支與基底**：`docs/word-guided-writing-ux-20261113` @ `9d29689`
- **變更範圍**：
  - 修改：`src/Phase0.tsx`、`src/screen-tracing.mjs`、`src/tracing-engine.mjs`、`src/block-tracing.mjs`、`src/stroke-engine.mjs`、`src/style.css`、`data/hangul-block-qa.json`、`docs/QA_CHECKLIST.md`、`scripts/browser-qa.mjs`、`scripts/guided-writing-qa.mjs`、`scripts/hangul-block-qa.mjs`
  - 新增：`src/pointer-tracing.mjs`、`src/screen-tracing.mjs`、`src/writing-diagnostics.mjs`、`tests/{pointer-tracing,screen-offset-study,screen-tracing,tracing-recovery}.test.mjs`、`scripts/{smooth-tracing-qa,tracing-recovery-qa,wide-track-qa}.mjs`
- **契約檢查**：日韓詞庫、132 字索引（129 技術通過、`う／や／ネ` 封鎖）、`localStorage` v1/v2 與 `themes.css` 色票皆未變動；108 字塊 QA 更新引擎簽章並全數通過。
- **驗證結果**：`npm run check` 全過（549 項測試、108 字塊、production build）；Chrome／WebKit 瀏覽器回歸 348 版面／20 次 axe 全過（詳見 `docs/QA_CHECKLIST.md`）。
- **已知限制與 Next Handoff**：
  - 實體 iPhone Safari／VoiceOver／教師人工驗證仍待完成。
  - 交接予 Antigravity 進行手機手寫 UX 增強、多鄰國式每日互動遊戲化與 PWA 離線安裝化；`う／や／ネ` 舊 QA 對齊公開 `finish()` 判定保留待後續獨立確認。

### 2026-11-25｜執行 AI：Antigravity｜手機手寫 UX、雙 AI 協作規範、每日遊戲化與 PWA 改造
- **分支與基底**：`docs/word-guided-writing-ux-20261113` @ `9d29689`（完整保留前任 Codex 本機 35px 寬軌道與流暢度未提交修改）
- **變更範圍**：
  - 雙 AI 協作與文件：新增 `docs/AI_HANDOFF_LOG.md`；修改 `AGENTS.md`、`README.md`。
  - 手機端手寫強化：新增 `src/sound-fx.mjs`、`src/WritingHub.tsx`；修改 `src/Phase0.tsx`、`src/GuidedWriting.tsx`、`src/style.css`、`src/guided-writing.css`（iOS 長按防誤觸與 `pointer-events: none`、防網址列高度抖動誤取消、抗手指遮擋頂部進度條、出軌琥珀／就緒綠環提示、觸覺與柔和微音效、今日推薦練寫切換列）。
  - 多鄰國式每日互動遊戲化：新增 `src/game-state.mjs`、`src/challenge-model.mjs`、`src/DailyChallenge.tsx`；修改 `src/MvpApp.tsx`、`src/Quiz.tsx`、`src/mvp.css`（今日手帳儀表板、7 日打卡印章、每日 3 微任務、四選一／配對消消樂／聽音／穿插手寫混合闖關、拼字「提示 1 字」救命鍵、單字表熟練度標記）。
  - 網頁 PWA 與分包：新增 `public/manifest.webmanifest`、`public/sw.js`、`public/icons/{icon.svg,icon-192.png,icon-512.png,icon-maskable-512.png,apple-touch-icon.png}`、`src/pwa.mjs`、`src/PwaBanner.tsx`；修改 `index.html`、`src/theme.mjs`、`vite.config.ts`。
  - 新增測試：`tests/game-state.test.mjs`、`tests/challenge-model.test.mjs`、`tests/pwa-manifest.test.mjs`。
- **契約檢查**：日韓詞庫 JSON、132 字索引（129 技術通過）、108 字塊 QA、`review:v1`／`learning:v2`／`theme:v1`、`themes.css` 24 色票唯一集中規則及 `screen-tracing.mjs` 幾何判定均完整保留未破壞；遊戲化獨立存於 `language-exchange-diary:game:v1`。
- **驗證結果**：`npm run check` 全數通過（**556／556 測試通過**、資料驗證、書寫與 108 字塊 QA、TypeScript、Production Build 0 警告；主 JS 由 599 kB 分包降至 320 kB / gzip 100.55 kB）。
- **本機實測即時修補**：修正滑鼠快速拖曳因同幀合併事件 `elapsed === 0` 與過窄補點誤差造成的斷觸鎖死（[pointer-tracing.mjs](file:///d:/Users/Gary/Desktop/日韓語言交換網站/src/pointer-tracing.mjs)、[screen-tracing.mjs](file:///d:/Users/Gary/Desktop/日韓語言交換網站/src/screen-tracing.mjs)、[Phase0.tsx](file:///d:/Users/Gary/Desktop/日韓語言交換網站/src/Phase0.tsx)）；補齊語音列表延遲重試與缺語音明確文字提示（[speech.mjs](file:///d:/Users/Gary/Desktop/日韓語言交換網站/src/speech.mjs)、[SpeechButton.tsx](file:///d:/Users/Gary/Desktop/日韓語言交換網站/src/SpeechButton.tsx)、[DailyChallenge.tsx](file:///d:/Users/Gary/Desktop/日韓語言交換網站/src/DailyChallenge.tsx)）。
- **已知限制與 Next Handoff**：
  - 實體 iPhone Safari／Android Chrome 手感、PWA「加入主畫面」離線實測、微音效與震動體感仍待真機驗收；未執行 Commit／Push／部署。
  - **建議交接予 Codex 的項目**：① 若環境具備 Playwright，補跑 `npm run test:browser` 並將每日闖關／WritingHub 納入自動瀏覽器回歸；② 待使用者確認後，將 `scripts/writing-qa.mjs` 對齊公開 `finish()` 放開判定並重測 `う／や／ネ` 3 個假名。

### 2026-11-25｜執行 AI：Antigravity｜合併 Draft PR #5 最新詞庫至 main 並發布 GitHub Pages
- **分支與基底**：`main`（整合 `origin/main` `f60e645` + Draft PR #5 `origin/data/vocab-20261122-jayu` `ad0310c` + `feat/mobile-handwriting-gamified-pwa`）
- **變更範圍**：
  - 合併 Draft PR #5 全數最新單字與教學記憶庫（韓文新增至含 `친구`、`몰라`、`여행`、`배달`、`자유`、`하나`、`화장실`、`집`；日文新增至含 `かに`、`しらない`、`くつ` 及 `data/ja-teaching-history.json`）。
  - 整合 `AGENTS.md` 第 13 條（日文每日推薦排重記憶庫）與第 14 條（雙 AI 協作交接）。
  - 執行 `npm run writing:blocks -- --write` 更新 `data/hangul-block-qa.json`（韓文字塊擴充至 **117／117 全數通過**）。
- **驗證結果**：依使用者授權執行全套 `npm run check` 通過後推送至官方 `origin/main` 觸發 GitHub Pages 自動部署。
