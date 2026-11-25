import { questionWeight } from './quiz-model.mjs';

function shuffle(items, random = Math.random) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.max(0, Math.min(0.999999, random())) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function primaryMeaning(entry) {
  return String(entry.meaning_zh ?? '').trim();
}

export function eligibleChallengeEntries(entries, language) {
  return entries.filter(
    e => e.language === language && e.text !== 'ㅅㅂ' && e.kind !== 'grammar' && primaryMeaning(e).length > 0,
  );
}

function pickWeighted(pool, records, count, now, random) {
  const remaining = [...pool];
  const chosen = [];
  while (chosen.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, e) => sum + questionWeight(records[e.id], now), 0);
    let target = Math.max(0, Math.min(0.999999, random())) * total;
    let pickedIndex = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      target -= questionWeight(records[remaining[i].id], now);
      if (target < 0) {
        pickedIndex = i;
        break;
      }
    }
    chosen.push(remaining.splice(pickedIndex, 1)[0]);
  }
  return chosen;
}

function buildChoiceStep(entry, pool, direction, random, kind = 'choice') {
  const targetMeaning = primaryMeaning(entry);
  const distractors = shuffle(
    pool.filter(other => other.id !== entry.id && other.text !== entry.text && primaryMeaning(other) !== targetMeaning),
    random,
  ).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle([entry, ...distractors], random).map(item => ({
    id: item.id,
    label: direction === 'to_meaning' ? primaryMeaning(item) : item.text,
    sub: direction === 'to_meaning' ? '' : (item.reading && item.reading !== item.text ? item.reading : ''),
    correct: item.id === entry.id,
  }));
  return {
    id: `${kind}-${entry.id}-${direction}`,
    kind,
    direction,
    entry,
    prompt: direction === 'to_meaning' ? entry.text : targetMeaning,
    reading: direction === 'to_meaning' && entry.reading && entry.reading !== entry.text ? entry.reading : '',
    options,
  };
}

function buildMatchStep(pool, random) {
  const unique = [];
  const seenText = new Set();
  const seenMeaning = new Set();
  for (const item of shuffle(pool, random)) {
    const m = primaryMeaning(item);
    if (seenText.has(item.text) || seenMeaning.has(m)) continue;
    seenText.add(item.text);
    seenMeaning.add(m);
    unique.push(item);
    if (unique.length === 4) break;
  }
  if (unique.length < 4) return null;
  return {
    id: `match-${unique.map(u => u.id).join('_')}`,
    kind: 'match',
    pairs: unique.map(item => ({ id: item.id, text: item.text, meaning: primaryMeaning(item), entry: item })),
    leftOrder: shuffle(unique.map(u => u.id), random),
    rightOrder: shuffle(unique.map(u => u.id), random),
  };
}

/**
 * Build a Duolingo-style mixed interactive challenge round (5–6 varied steps).
 * Pure function for deterministic testing and zero side effects.
 * @param {any[]} entries
 * @param {'ja'|'ko'} language
 * @param {Record<string, any>} [records]
 * @param {{speechAvailable?:boolean,writableUnitForEntry?:((entry:any)=>any)|null,now?:number,random?:()=>number}} [options]
 */
export function buildDailyChallenge(
  entries,
  language,
  records = {},
  {
    speechAvailable = false,
    writableUnitForEntry = null,
    now = Date.now(),
    random = Math.random,
  } = {},
) {
  const pool = eligibleChallengeEntries(entries, language);
  if (pool.length < 4) return [];

  const focus = pickWeighted(pool, records, Math.min(6, pool.length), now, random);
  const steps = [];

  // Step 1: Warmup quick choice (word -> meaning)
  const s1 = buildChoiceStep(focus[0], pool, 'to_meaning', random, 'choice');
  if (s1) steps.push(s1);

  // Step 2: Listen & pick (if device speech exists) or reverse choice (meaning -> word)
  if (focus[1]) {
    const s2 = buildChoiceStep(focus[1], pool, speechAvailable ? 'to_meaning' : 'to_word', random, speechAvailable ? 'listen' : 'choice');
    if (s2) steps.push(s2);
  }

  // Step 3: Tactile Match Pairs (消消樂)
  const matchPool = focus.length >= 4 ? [...focus.slice(0, 4), ...pool] : pool;
  const s3 = buildMatchStep(matchPool, random);
  if (s3) steps.push(s3);

  // Step 4: Reverse choice (meaning -> word)
  if (focus[2]) {
    const s4 = buildChoiceStep(focus[2], pool, 'to_word', random, 'choice');
    if (s4) steps.push(s4);
  }

  // Step 5: Embedded guided handwriting challenge (if any entry has a supported letter/block)
  if (typeof writableUnitForEntry === 'function') {
    for (const candidate of [...focus.slice(3), ...focus.slice(0, 3)]) {
      const unit = writableUnitForEntry(candidate);
      if (unit) {
        steps.push({
          id: `write-${candidate.id}-${unit.id}`,
          kind: 'write',
          entry: candidate,
          character: unit,
        });
        break;
      }
    }
  }

  // Step 6: Finale quick choice
  const finaleEntry = focus[4] ?? focus[3] ?? focus[0];
  if (finaleEntry) {
    const s6 = buildChoiceStep(finaleEntry, pool, 'to_meaning', random, 'choice');
    if (s6 && !steps.some(st => st.id === s6.id)) steps.push(s6);
  }

  return steps;
}
