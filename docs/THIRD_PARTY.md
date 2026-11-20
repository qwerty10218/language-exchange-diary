# 第三方素材與授權核對清單

原始交接包只有候選來源；Phase 0 現已附下列 SVG 與授權，尚未納入真人音檔。候選清單不代表素材可直接使用。

| 來源 | 用途 | 已查到的關鍵資訊 | 注意 |
|---|---|---|---|
| AnimCJK | 日文假名筆順 SVG | Kana 目錄有動畫 SVG；SVG 授權與其他檔案不同 | 確認 `licenses/COPYING.txt`；不能直接拿 `svgsKo` 當 Hangul |
| hangeul-stroke-order | 韓文 Jamo 筆順圖 | 35／40；CC BY-SA 4.0 | 5 個緊音不在圖中；筆順圖不等於中心線 |
| Wikimedia Commons / Wiktionary | 真人發音 | 有帶詞條的錄音，可能含母語者聲音 | 逐檔看 license、說話者和讀法 |
| Lingua Libre | 真人逐字錄音 | Wikimedia 相關開放錄音計畫 | 須逐檔確認可重用與署名 |
| Tatoeba | 句子音訊 | 各錄音有各自授權 | 有些不允許站外重用 |
| Mozilla Common Voice | 真人句子語料 | CC0 | 偏語音訓練語料，非現成詞典配音 |

**參考網址**：
- https://github.com/parsimonhi/animCJK
- https://github.com/parsimonhi/animCJK/blob/master/licenses/COPYING.txt
- https://github.com/MagisterAdamus/hangeul-stroke-order
- https://commons.wikimedia.org/wiki/Commons:Pronunciation_files_requests
- https://github.com/lingua-libre
- https://en.wiki.tatoeba.org/articles/show/faq
- https://commonvoice.mozilla.org/dav/terms
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- https://www.korean.go.kr/eng_hangeul/principle/001.html

## 第三方新增紀錄格式（每項素材都要）
`檔名 / 來源頁 / 版本或日期 / 著作人 / 授權 / 必要署名 / 是否修改 / 人工確認者`。

如授權與網站公開重用不相容，應另尋候選或自製，不能因為 repository 在 GitHub 就視為可自由複製。

## Phase 0 已納入的三字來源
- AnimCJK / FM-SH，版本 `99dba566b92daf45ae20d05e6c91d3f68d8619f2`：只納入 `12354.svg`、`12450.svg`，選 LGPL-3.0-or-later；原檔、COPYING、LGPL／GPL 全文位於 `public/strokes/sources/`。
- Adam Stone / hangeul-stroke-order，版本 `935483f7e93d24aa2ec990bca1b43664307768d2`：只納入 `15_a.svg` 與 CC BY-SA 4.0 授權全文；依該圖箭頭順序另繪原型中心線，衍生資料同授權。
- `data/phase0.strokes.json` 逐字保留固定版本來源網址、作者、授權、修改說明；其副本隨 build 公開。2026-10-31 根因修正：停止把 AnimCJK 遮罩動畫折線當成裸露中心線，舊 SVG 僅保留供稽核與回歸測試。
- 現用假名：KanjiVG / Ulrich Apel 與貢獻者，版本 `70a0b7ae0c18ceb5cb358274b029cce0234a43bc` 的 `kanji/03042.svg`、`kanji/030a2.svg`，CC BY-SA 3.0；原檔及 `KanjiVG-COPYING.txt` 附於來源目錄。只依 1024/109 等比例換算原始曲線與六位小數取整；衍生資料同授權，網站來源頁標明修改與署名。未宣稱教師已人工確認。
- 查核日期 2026-10-30；程式核對原始檔及授權文字，尚無人類教師確認者。三字皆標 `prototype_needs_human_review`；其餘 129 字未納入，緊音缺口未解決。

## 2026-11-12 韓文新增來源
StrokeFox / BiLingoPlus LLC，2026-11-04 自製逐筆中心線，CC BY 4.0；39個新增字採此來源，ㅏ沿用原CC BY-SA 4.0。原JSON、SHA-256固定版本、授權全文與manifest位於 public/strokes/hangul/，轉換／筆法差異及教師待驗狀態見 HANGUL_WRITING.md。未使用字型外框猜筆順。


## 2026-11-13 中文繁簡轉換資料
- 開源來源：OpenCC（BYVoid 與 OpenCC contributors），Apache License 2.0。
- 資料來源檔：`data/dictionary/TSCharacters.txt`、`data/dictionary/TSPhrases.txt`，取自 `https://github.com/BYVoid/OpenCC`。
- 已於 2026-11-13 逐筆核對：TSCharacters 固定版本 `5c764a5a886f46eb365656ed91a0410d7162fac6`（3221 個變更映射），TSPhrases 固定版本 `9e9d730659fc7db366b43b4437b307444d87e23e`（498 詞，包含不變詞以保護「乾隆」等歧義）。所有映射均與該版本第一候選一致。
- `data/zh-hant-to-hans.json` 是上述來源的第一候選衍生資料；採最長詞優先、單次替換，詞語結果不再逐字二次轉換。不包含 OpenCC 的完整語境演算法，未收錄歧義仍需人工確認。
- Apache 2.0 全文保留於 `licenses/OpenCC-APACHE-2.0.txt`，原字典與專案授權可在上游查閱。
- 轉換僅用於中文介面與中文註釋顯示，不覆寫正式詞庫的原始日文、韓文、個人記音與發音欄位。
- 網站產物另附 `public/licenses/OpenCC-APACHE-2.0.txt`，頁尾提供授權連結。React Context 在渲染時選擇中文顯示；不監聽或改寫 React DOM。日文筆記的「漢字：」內容與包含假名的日文引文保留原樣。
