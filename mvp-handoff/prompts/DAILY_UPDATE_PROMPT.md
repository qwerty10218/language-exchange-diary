# 後續每日單字追加提示詞（給 Codex）

只做詞條更新，不修改 UI 或書寫引擎。

讀取 `AGENTS.md`、既有 `schemas/entry.schema.json` 和目前 `data/ja.entries.json`／`data/ko.entries.json`。
把新增 Markdown 詞條對應合併到正確語言 JSON；維持穩定 ID、原始記音、繁體中文詞義與 `needs_review` 狀態。不要重複建立同一詞條，不改舊單字未授權的內容。
驗證 JSON／Schema 後簡短列出新增、更新、衝突筆數；不要 Commit、Push 或部署。
