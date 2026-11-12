# 言語交換日記：MVP 單字與 Codex 交接包

這份包是為了**先把 MVP 做出來**，不取代現有 Repo 的 Phase 0 原型。

## 本包內容

- `vocabulary/ja.md`：我教朋友的日文，共 **32** 筆。
- `vocabulary/ko.md`：朋友教我的韓文，共 **87** 筆。
- `data/ja.entries.json`、`data/ko.entries.json`：同一批內容，沿用舊版 Schema，可供 Codex 併入。
- `docs/MVP_SCOPE.md`：只做 MVP 的實作邊界與驗收。
- `docs/LEARNING_REFERENCE.md`：早期文法、字形及單字學習鏈（不是新詞條）。
- `prompts/MVP_RUN_PROMPT.md`：本次直接貼給 Codex 的 Run 提示詞。
- `prompts/DAILY_UPDATE_PROMPT.md`：未來追加單字的最短提示詞。

## 怎麼使用

1. 解壓縮後，將整個資料夾重新命名為 `mvp-handoff`，放在現有 `language-exchange-diary` Repo 根目錄。
2. Codex 使用 Run/Agent 模式，直接貼 `prompts/MVP_RUN_PROMPT.md` 的內容。
3. Codex 先合併詞庫，再做手機版搜尋、單字詳情、翻卡；保留目前的三字書寫原型。
4. 測試完成後，是否 Commit、Push、部署由你親自決定。

## 重要邊界

- **日期**：僅對能從聊天時間確認的詞條標示日期；「日期待確認」不是實際教學日期。
- **來源**：涵蓋本段對話和可回溯的近期筆記；未提供的私人對話無法保證收錄。
- **個人記音**：`Wu san`、`Shi hom`、`chou new` 等保留原樣，與標準羅馬字分開。
- **現有資料**：本包的 JSON 是完整整理好的**候選匯入資料集**，不是要求無條件覆蓋 Repo 現有 JSON。
- **真人音檔**：沒有附音檔，`audio` 皆為 `null`。
- **查證**：所有整理的新資料 `review_status` 先設 `needs_review`，不宣稱逐項審核完成。
- **公開隱私**：未匯入朋友的真人聲音、私人聊天全文或個人稱呼（例如 `개리`）。
- **特殊詞**：`ㅅㅂ` 已標示粗口縮寫，可在 UI 複習中排除或由你選擇保留。

現有 Repo：`https://github.com/qwerty10218/language-exchange-diary.git`。
