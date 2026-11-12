# Codex：每日單字增量更新（建議先在 ChatGPT 整理）

請依 `docs/DATA_AND_IMPORT.md`、`schemas/entry.schema.json`，把我提供的新 JSON 與 `data/ko.entries.json` 或 `data/ja.entries.json` 做增量合併。

規則：
- 只修改指定語言的資料；保留另一份筆記和原有備註。
- ID 和文本重複時先比對：相同資料跳過；有差異顯示摘要；不確定就標待確認。
- 對未核對的意思和發音保留 `needs_review`；不得新增假音檔或授權。
- 更新完成，跑 JSON schema 驗證、編譯／相關測試；只回覆更新數量、差異和失敗項目。
- 不修改網站外觀、不自動 Commit／Push／部署。

【把本次 GPT 整理好的 JSON 貼在此處】
