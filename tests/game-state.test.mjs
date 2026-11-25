import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_KEY,
  awardActivity,
  dailyQuestList,
  defaultGameState,
  loadGameState,
  localDateKey,
  rolloverDay,
  saveGameState,
  setGamePrefs,
  shiftDateKey,
  weekStamps,
} from '../src/game-state.mjs';

test('daily XP, streak progression, gentle reset and 7-day notebook stamps', () => {
  const day1 = new Date(2026, 10, 20, 10, 0, 0).getTime();
  const day2 = new Date(2026, 10, 21, 9, 0, 0).getTime();
  const day4 = new Date(2026, 10, 23, 18, 0, 0).getTime();

  let state = defaultGameState(day1);
  assert.equal(state.streak, 0);
  state = awardActivity(state, { xp: 15, rounds: 1, correct: 5, strokes: 2, writingId: 'ko-a' }, day1);
  assert.equal(state.todayXp, 15);
  assert.equal(state.streak, 1);
  assert.equal(state.writingCounts['ko-a'], 1);
  assert.ok(dailyQuestList(state, day1).every(q => q.done));

  // Consecutive day increments streak and resets daily XP/quests
  const nextMorning = rolloverDay(state, day2);
  assert.equal(nextMorning.todayXp, 0);
  assert.equal(nextMorning.streak, 1);
  const afterDay2 = awardActivity(nextMorning, { xp: 20, correct: 3 }, day2);
  assert.equal(afterDay2.streak, 2);
  assert.equal(afterDay2.bestStreak, 2);
  assert.equal(afterDay2.totalXp, 35);

  // Skipping a day resets current streak gently while keeping bestStreak & history
  const skipped = rolloverDay(afterDay2, day4);
  assert.equal(skipped.streak, 0);
  assert.equal(skipped.bestStreak, 2);
  const stamps = weekStamps(skipped, day4);
  assert.equal(stamps.length, 7);
  assert.equal(stamps.filter(s => s.stamped).length, 2);
  assert.equal(stamps.at(-1).isToday, true);
  assert.equal(shiftDateKey(localDateKey(day1), 1), localDateKey(day2));
});

test('game state uses independent localStorage key and protects corrupt/newer data', () => {
  const map = new Map([
    ['language-exchange-diary:review:v1', '{"keep":1}'],
    ['language-exchange-diary:learning:v2', '{"keep":2}'],
  ]);
  const storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };

  let state = setGamePrefs(defaultGameState(), { sound: false, haptics: true });
  assert.equal(saveGameState(() => storage, state), null);
  const loaded = loadGameState(() => storage);
  assert.equal(loaded.error, null);
  assert.equal(loaded.readOnly, false);
  assert.equal(loaded.state.prefs.sound, false);
  assert.equal(map.get('language-exchange-diary:review:v1'), '{"keep":1}');
  assert.equal(map.get('language-exchange-diary:learning:v2'), '{"keep":2}');

  // Corrupt or future version must never be overwritten
  map.set(GAME_KEY, JSON.stringify({ version: 99, future: true }));
  const broken = loadGameState(() => storage);
  assert.equal(broken.readOnly, true);
  assert.ok(broken.error);
  assert.ok(saveGameState(() => storage, state));
  assert.equal(map.get(GAME_KEY), JSON.stringify({ version: 99, future: true }));
});
