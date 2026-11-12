export const PROGRESS_KEY = 'language-exchange-diary:review:v1';
/** @typedef {'remembered' | 'forgotten'} ReviewStatus */
/** @typedef {Record<string, ReviewStatus>} Progress */

export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function searchEntries(entries, query) {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  return entries.filter(entry => {
    const haystack = normalizeSearch([entry.text, entry.meaning_zh, entry.reading, entry.romaji,
      entry.personal_mnemonic, entry.notes, ...entry.examples.flatMap(e => [e.text, e.meaning_zh, e.reading])].filter(Boolean).join(' '));
    return terms.every(term => haystack.includes(term));
  });
}
export function reviewPool(entries, includeStrongLanguage = false) {
  return entries.filter(e => includeStrongLanguage || e.text !== 'ㅅㅂ');
}
/** @param {any[]} entries @param {Progress} progress @param {number | 'all'} limit */
export function reviewQueue(entries, progress, limit) {
  const priority = { forgotten: 0, unseen: 1, remembered: 2 };
  const sorted = [...entries].sort((a, b) => priority[progress[a.id] ?? 'unseen'] - priority[progress[b.id] ?? 'unseen']);
  return limit === 'all' ? sorted : sorted.slice(0, Math.max(0, limit));
}
/** @param {Progress} progress @param {string} id @param {ReviewStatus} status */
export function recordReview(progress, id, status) {
  return { ...progress, [id]: status };
}
/** @returns {{progress: Progress, error: string | null}} */
export function loadProgress(getStorage) {
  try {
    const raw = getStorage().getItem(PROGRESS_KEY);
    if (raw === null) return { progress: {}, error: null };
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('Unknown progress format');
    /** @type {Progress} */
    const progress = {};
    for (const [id, value] of Object.entries(data.entries)) {
      if (/^(ja|ko)-[a-z0-9-]+$/.test(id) && (value === 'remembered' || value === 'forgotten')) progress[id] = value;
    }
    return { progress, error: null };
  } catch {
    return { progress: {}, error: '本機練習紀錄無法讀取；本次進度只會暫存，重新整理後不保留。原紀錄未覆寫。' };
  }
}
/** @param {() => Storage} getStorage @param {Progress} progress */
export function saveProgress(getStorage, progress) {
  try {
    getStorage().setItem(PROGRESS_KEY, JSON.stringify({ version: 1, entries: progress }));
    return null;
  } catch {
    return '瀏覽器無法儲存進度；本次仍可練習，但重新整理後不保留。';
  }
}
