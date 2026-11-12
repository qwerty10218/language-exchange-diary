import { readFile, access } from 'node:fs/promises';
import { validateEntries } from './data-validation.mjs';
import { svgPathProperties } from 'svg-path-properties';
const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const args = process.argv.slice(2);
const errors = [];
if (args.length) {
  // Phase 0 only previews; this command never writes project data.
  const [flag, language, file] = args;
  if (flag !== '--preview' || !['ko', 'ja'].includes(language) || !file || args.length !== 3) throw Error('用法：npm run validate:data -- --preview ko|ja <JSON檔案>');
  const entries = JSON.parse(await readFile(file, 'utf8'));
  errors.push(...validateEntries(entries, language));
  console.log('本機預覽檢查：未寫入專案資料，也不會同步朋友。');
} else {
  for (const language of ['ko', 'ja']) {
    const entries = await read(`data/${language}.entries.json`);
    errors.push(...validateEntries(entries, language).map(e => `${language}: ${e}`));
    for (const entry of entries) if (entry.audio) {
      try { await access(new URL(`public${entry.audio.src}`, root)); } catch { errors.push(`缺少本地音檔 ${entry.audio.src}`); }
    }
    console.log(`${language}: ${entries.length} 詞條`);
  }
  const inventory = await read('data/character_inventory.json');
  const groups = Object.values(inventory.groups);
  if (groups.map(g => g.length).join(',') !== '19,21,46,46' || new Set(groups.flat()).size !== 132 || inventory.required_total !== 132) errors.push('字元清單應為 19+21+46+46，且不重複');
  const strokes = await read('data/phase0.strokes.json');
  if (JSON.stringify(strokes) !== JSON.stringify(await read('public/strokes/sources/phase0.strokes.json'))) errors.push('公開筆順來源副本與原型資料不一致');
  if (strokes.status !== 'prototype_needs_human_review' || strokes.characters.map(c => c.display).join('') !== 'ㅏあア') errors.push('Phase 0 只能含三字原型，不能標示正式完成');
  for (const c of strokes.characters) {
    const count = c.display === 'あ' ? 3 : 2;
    if (c.paths.length !== count || c.starts.length !== count || !c.source || !c.license || !c.creator) errors.push(`${c.display}: 筆畫或來源資料不完整`);
    for (const path of c.paths) {
      if (!/^M[\d\s.,+\-MLCc]+$/.test(path)) { errors.push(`${c.display}: 非原型支援的逐筆中心線`); continue; }
      try {
        const curve = new svgPathProperties(path), length = curve.getTotalLength();
        if (!Number.isFinite(length) || length <= 0) errors.push(`${c.display}: 無效筆畫長度`);
        for (let n = 0; n <= 100; n++) {
          const p = curve.getPointAtLength(length * n / 100);
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > 1024 || p.y > 1024) { errors.push(`${c.display}: 路徑超出 viewBox`); break; }
        }
      } catch (error) { errors.push(`${c.display}: SVG 路徑解析失敗：${error.message}`); }
    }
  }
  const candidates = await read('data/phase0.audio-candidates.json');
  for (const language of ['ko', 'ja']) if (candidates.candidates.filter(c => c.language === language).length !== 5) errors.push(`${language} 音訊調查須有五條`);
  for (const c of candidates.candidates) if (c.status !== 'needs_review' || c.audio !== null || c.verified_by !== null || c.checked_on !== null || !c.research_url || c.quality_review !== 'pending') errors.push(`${c.text}: 候選不可當作已通過錄音`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('資料驗證通過。');
