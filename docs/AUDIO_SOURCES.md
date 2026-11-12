# 真人發音方案（必須與 TTS 區分）

## 使用者的需求
希望聽到準確、自然的真人發音。**優先人工錄製的合格語音，不使用瀏覽器合成語音冒充。**

## 目前查到的候選來源
| 候選 | 適合用途 | 實際限制 |
|---|---|---|
| Wikimedia Commons / Wiktionary 語音 | 單字、部分語句、字音 | 每檔可能不同授權、口音、音質和人聲；不保證每個詞都有 |
| Lingua Libre（Wikimedia 系） | 真人逐字錄音 | 需要找到確切詞條及核對個別檔案資料；程式碼開源≠每個音檔可直接使用 |
| Tatoeba | 完整例句的人聲 | 錄音逐個授權，不是每筆都有；音訊不一定可離站重用 |
| Mozilla Common Voice | 人聲資料來源 | CC0 資料，但偏整句錄音語料，並非現成逐字發音詞典；不適合未經處理就配音 |

參考：
- https://commons.wikimedia.org/wiki/Commons:Pronunciation_files_requests
- https://github.com/lingua-libre
- https://en.wiktionary.org/
- https://en.wiki.tatoeba.org/articles/show/faq
- https://commonvoice.mozilla.org/dav/terms

## 選音檔程序（必做）
1. 搜尋**完整原文**，確認語言（`ko-KR`／`ja-JP`）及意義一致，不只比字面。
2. 確認為真人錄音，且原檔頁面有允許重用的授權。
3. 人工聆聽：發音正確、無截斷、無雜音、語速自然。韓文連音／音變要與整個詞的讀法一致。
4. 記錄 `source_page`、`creator`、`license`、`attribution`、`verified_by`、`checked_on`。
5. 下載且重命名到 `public/audio/`，前端**只用本地音檔**，避免依賴來源站防盜鏈／CORS／檔案異動。
6. 在關於頁附音檔出處與所需授權聲明。

## 韓文 40 字母的特別問題
- `ㄱ` 這類子音通常不能孤立發出完整音節；**字母名稱（기역）**與**音節中的發音（例如 가）**不是同一個項目。
- 所以資料中應區分 `letter_name_audio` 與 `example_syllable_audio`，不能把 `가` 錄音誤標為「ㄱ 的獨立聲音」。
- 複合母音、緊音、輔音音變需逐項檢聽，不以羅馬拼音推定實際音值。
- 日文平片假名也要查核清音及常見語速，不把中文字或機器音冒充原生讀法。

## 發行規則
- 缺少音檔時顯示「尚無真人錄音」，播放功能 disabled。**不產生虛構 MP3、不自動播 TTS。**
- 先做音訊試點（各語言 5 條），確認取得及授權流程，然後再補齊上線所需的核心學習內容。
- 若無法取得可合法使用、合格的真人語音，停在發音資料準備階段並明確告知維護者，不假裝已達到完整要求。
- 使用者未授權把朋友私人語音公開，不能擷取、轉傳或自動上傳她的聊天語音。

## Phase 0 調查與審核交接（2026-10-30）
- `data/phase0.audio-candidates.json` 與公開詞條嚴格分開：各語言五條候選，`audio: null`；不代表現有詞庫覆蓋率，也不自動新增詞條。
- `research_url` 是已查詢的來源；只有找到具體檔案才填 `source_page`、作者與授權資訊。API metadata 只能作為初步證據，不能當成人工通過。
- 審核順序：逐檔確認可在公開 repo 重用與署名 → 檢聽真人、語言／讀法與原文一致、無截斷／雜音 → 記錄確認者與日期 → 下載至 `public/audio` → 依既有 entry schema 填 `human_recording` 完整欄位 → 資料檢查及手機播放驗收。
- 任一關未通過仍維持候選，禁止填 `verified_by`／`checked_on` 或虛構 `src`；韓文子音名稱和示例音節需獨立音訊項目。
- 沒有下載任何候選音檔，也沒有人工聆聽；未驗證手機 Safari／Chrome 的真實播放品質。Phase 0 不宣稱完整真人發音。
