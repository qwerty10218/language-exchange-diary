import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judgeStroke, resample, toPoint } from '../src/stroke-engine.mjs';
import { validateEntries } from '../scripts/data-validation.mjs';
import { points } from './path-samples.mjs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const characters = read('../data/phase0.strokes.json').characters;
for (const c of characters) {
  test(`${c.display}: 正確、輕微偏移通過；反向、錯序、錯形拒絕`, () => {
    const strokes = c.paths.map(points);
    for (const stroke of strokes) {
      assert.equal(judgeStroke(stroke, stroke).ok, true);
      assert.equal(judgeStroke(stroke.map(p => ({ x: p.x + 24, y: p.y - 20 })), stroke).ok, true);
      assert.equal(judgeStroke([...stroke].reverse(), stroke).ok, false);
      // Identical endpoints, large wrong detour must not pass endpoint-only checks.
      assert.equal(judgeStroke([stroke[0], { x: 1024, y: 0 }, { x: 0, y: 1024 }, stroke.at(-1)], stroke).ok, false);
    }
    assert.equal(judgeStroke(strokes[1], strokes[0]).ok, false);
  });
}
test('點擊與零長筆畫不能通過；不同採樣速度可通過', () => {
  const line = [{ x: 100, y: 100 }, { x: 100, y: 900 }];
  assert.equal(judgeStroke([line[0]], line).ok, false);
  assert.equal(judgeStroke([line[0], line[0]], line).ok, false);
  assert.equal(judgeStroke([line[0], { x: 100, y: 102 }, { x: 100, y: 110 }, line[1]], line).ok, true);
  assert.equal(resample(line).length, 48);
});
test('手機縮放與桌面字框轉為相同 viewBox 座標', () => {
  assert.deepEqual(toPoint(110, 120, { left: 10, top: 20, width: 200, height: 200 }), { x: 512, y: 512 });
  assert.deepEqual(toPoint(210, 220, { left: 10, top: 20, width: 400, height: 400 }), { x: 512, y: 512 });
});
const ko = read('../data/ko.entries.json');
test('現有 schema 可驗證；跨語言、重複、未知欄位拒絕', () => {
  assert.deepEqual(validateEntries(ko, 'ko'), []);
  assert.ok(validateEntries(ko, 'ja').length);
  assert.ok(validateEntries([ko[0], ko[0]], 'ko').length);
  assert.ok(validateEntries([{ ...ko[0], invented: true }], 'ko').length);
  assert.ok(validateEntries([null, { id: 123 }], 'ko').length);
});
test('音訊來源不可造假為外站、TTS 或路徑逃逸；來源欄位須齊全', () => {
  for (const audio of [{ kind: 'tts', src: 'https://example.com/a.mp3' }, { kind: 'human_recording', src: '/audio/../../a.mp3' }])
    assert.ok(validateEntries([{ ...ko[0], audio }], 'ko').length);
});
