import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDailyChallenge, eligibleChallengeEntries } from '../src/challenge-model.mjs';

const readJson = rel => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const ja = readJson('../data/ja.entries.json');
const ko = readJson('../data/ko.entries.json');

test('daily challenge excludes profanity/grammar and builds varied interactive steps for both languages', () => {
  assert.ok(eligibleChallengeEntries(ko, 'ko').every(e => e.text !== 'ㅅㅂ'));

  for (const [entries, lang] of [[ja, 'ja'], [ko, 'ko']]) {
    let seed = 0.13;
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const steps = buildDailyChallenge(entries, lang, {}, {
      speechAvailable: true,
      writableUnitForEntry: e => ({ id: `${lang}-sample-${e.id}`, display: e.text[0] }),
      random: rng,
    });
    assert.ok(steps.length >= 5, `${lang} should have at least 5 steps`);
    assert.ok(steps.some(s => s.kind === 'choice'), `${lang} includes quick choice`);
    assert.ok(steps.some(s => s.kind === 'listen'), `${lang} includes listen step when speech available`);
    assert.ok(steps.some(s => s.kind === 'match'), `${lang} includes match-pairs step`);
    assert.ok(steps.some(s => s.kind === 'write'), `${lang} includes embedded writing step`);

    for (const step of steps) {
      if (step.kind === 'choice' || step.kind === 'listen') {
        assert.equal(step.options.length, 4);
        assert.equal(step.options.filter(o => o.correct).length, 1);
        assert.equal(new Set(step.options.map(o => o.label)).size, 4, 'choice options must have distinct labels');
      }
      if (step.kind === 'match') {
        assert.equal(step.pairs.length, 4);
        assert.equal(new Set(step.pairs.map(p => p.text)).size, 4);
        assert.equal(new Set(step.pairs.map(p => p.meaning)).size, 4);
      }
    }
  }
});

test('daily challenge degrades cleanly when device speech or writing unit is unavailable', () => {
  const steps = buildDailyChallenge(ja, 'ja', {}, { speechAvailable: false, writableUnitForEntry: null });
  assert.ok(steps.length >= 4);
  assert.equal(steps.some(s => s.kind === 'listen'), false);
  assert.equal(steps.some(s => s.kind === 'write'), false);
});
