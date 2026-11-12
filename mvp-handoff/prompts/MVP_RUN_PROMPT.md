# Codex Run Prompt — 專注完成 MVP，不進入新一輪大規劃

這是一個**現有專案的增量開發**，官方 Repo 是 `https://github.com/qwerty10218/language-exchange-diary.git`。
我已決定 MVP 方向；不要再重新設計整個 PRD 或啟動 Plan Mode。

## 請先讀（限必要文件）
- Repo 根目錄 `AGENTS.md`
- 交接包 `mvp-handoff/docs/MVP_SCOPE.md`
- `mvp-handoff/vocabulary/ja.md` 與 `ko.md`（內容來源）
- `mvp-handoff/data/ja.entries.json` 與 `ko.entries.json`（可機器匯入）
- 現有 `schemas/entry.schema.json` 和現有詞庫資料

> 此提示詞假設你把解壓出的資料夾命名為 `mvp-handoff` 放在 Repo 根目錄；若實際路徑不同，調整路徑即可。

## 本次 Run 任務（只做這些）

1. `git status` 檢查現有工作，**保留既有 Phase 0 原型及目前使用者的全部程式變更**；不可重建專案或覆蓋重要工作。
2. 合併交接包的兩份詞庫 JSON 到 Repo 既有的 `data/ja.entries.json`、`data/ko.entries.json`；依 `language`、`id`、`text` 檢查重複。對原有同詞條優先保留原 ID，補上缺失欄位，不靜默覆蓋較新的內容或原始記音。發生衝突時只列差異，避免自行決定。
3. 保持原 Schema 相容；需要的話只修改少量資料讀取程式，不新增資料庫及登入。
4. 完成**手機優先奶茶手帳 MVP**：首頁、日韓 Tab、即時搜尋、詞條列表／詳情、簡單翻卡複習（看原文→揭示中文→記得／忘記）、localStorage 進度。
5. 在導航保留現有 `ㅏ／あ／ア` 書寫原型入口，**本次不要改它的磁吸與筆順判定**。
6. 未取得並核實的真人錄音一律不可假造播放器、URL 或朗讀結果；暫時可以不顯示播放鍵。
7. 最後執行既有資料驗證、TypeScript 檢查、測試與 production build；有失敗先修正本次造成的問題。

## 明確禁止

不做 Phase 0 書寫引擎重構、132 字擴充、音檔蒐集、登入、後端、資料庫、權限、公開編輯、華麗動畫或額外套件堆疊。不要 Commit、Push、部署，除非我另外明確授權。

## 回報（控制在 12 行內）

- MVP 目前可使用的畫面／功能
- 詞條數（JA／KO）及是否有合併衝突
- 改動檔案
- 測試／build 結果
- 剩餘阻礙（只列真正影響 MVP 的）

**本次目標是能查到和複習我們這段時間學過的詞，不要再把工作卡在完整 v1.0 的周邊功能。**
