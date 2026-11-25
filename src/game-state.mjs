// Local-only gamification & daily habit state.
// Stored under its own key so legacy review:v1 and learning:v2 are never modified.
export const GAME_KEY = 'language-exchange-diary:game:v1';
export const DEFAULT_DAILY_GOAL = 30;
const MAX_HISTORY_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** @typedef {{rounds:number,correct:number,strokes:number}} DailyQuests */
/** @typedef {{sound:boolean,haptics:boolean}} GamePrefs */
/** @typedef {{version:1,dailyGoalXp:number,todayDate:string,todayXp:number,totalXp:number,streak:number,bestStreak:number,lastActiveDate:string|null,history:string[],todayQuests:DailyQuests,writingCounts:Record<string,number>,prefs:GamePrefs}} GameState */

export function localDateKey(now = Date.now()) {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + deltaDays, 12, 0, 0);
  return localDateKey(dt.getTime());
}

/** @returns {GameState} */
export function defaultGameState(now = Date.now()) {
  return {
    version: 1,
    dailyGoalXp: DEFAULT_DAILY_GOAL,
    todayDate: localDateKey(now),
    todayXp: 0,
    totalXp: 0,
    streak: 0,
    bestStreak: 0,
    lastActiveDate: null,
    history: [],
    todayQuests: { rounds: 0, correct: 0, strokes: 0 },
    writingCounts: {},
    prefs: { sound: true, haptics: true },
  };
}

/** @param {GameState} state @returns {GameState} */
export function rolloverDay(state, now = Date.now()) {
  const today = localDateKey(now);
  const yesterday = shiftDateKey(today, -1);
  const activeStreak = state.lastActiveDate === today || state.lastActiveDate === yesterday ? state.streak : 0;
  if (state.todayDate === today && state.streak === activeStreak) return state;
  return {
    ...state,
    todayDate: today,
    todayXp: state.todayDate === today ? state.todayXp : 0,
    todayQuests: state.todayDate === today ? state.todayQuests : { rounds: 0, correct: 0, strokes: 0 },
    streak: activeStreak,
  };
}

/**
 * @param {GameState} state
 * @param {{xp?:number,rounds?:number,correct?:number,strokes?:number,writingId?:string|null}} [delta]
 * @param {number} [now]
 * @returns {GameState}
 */
export function awardActivity(state, { xp = 0, rounds = 0, correct = 0, strokes = 0, writingId = null } = {}, now = Date.now()) {
  const current = rolloverDay(state, now);
  const today = localDateKey(now);
  const yesterday = shiftDateKey(today, -1);
  const addXp = Math.max(0, Math.round(xp));
  const addRounds = Math.max(0, Math.round(rounds));
  const addCorrect = Math.max(0, Math.round(correct));
  const addStrokes = Math.max(0, Math.round(strokes));
  const didWork = addXp > 0 || addRounds > 0 || addCorrect > 0 || addStrokes > 0 || !!writingId;

  let streak = current.streak;
  let lastActiveDate = current.lastActiveDate;
  let history = current.history;
  if (didWork) {
    if (lastActiveDate === today) streak = Math.max(1, streak);
    else if (lastActiveDate === yesterday) streak = current.streak + 1;
    else streak = 1;
    lastActiveDate = today;
    if (!history.includes(today)) history = [...history, today].sort().slice(-MAX_HISTORY_DAYS);
  }

  const writingCounts = writingId
    ? { ...current.writingCounts, [writingId]: (current.writingCounts[writingId] ?? 0) + 1 }
    : current.writingCounts;

  return {
    ...current,
    todayDate: today,
    todayXp: current.todayXp + addXp,
    totalXp: current.totalXp + addXp,
    streak,
    bestStreak: Math.max(current.bestStreak, streak),
    lastActiveDate,
    history,
    todayQuests: {
      rounds: current.todayQuests.rounds + addRounds,
      correct: current.todayQuests.correct + addCorrect,
      strokes: current.todayQuests.strokes + addStrokes,
    },
    writingCounts,
  };
}

/** @param {GameState} state @param {Partial<GamePrefs>} patch @returns {GameState} */
export function setGamePrefs(state, patch) {
  return {
    ...state,
    prefs: {
      sound: typeof patch.sound === 'boolean' ? patch.sound : state.prefs.sound,
      haptics: typeof patch.haptics === 'boolean' ? patch.haptics : state.prefs.haptics,
    },
  };
}

export function dailyQuestList(state, now = Date.now()) {
  const s = rolloverDay(state, now);
  return [
    { id: 'round', title: '完成 1 輪互動闖關或測驗', current: Math.min(1, s.todayQuests.rounds), target: 1, done: s.todayQuests.rounds >= 1, xpHint: '+15 XP' },
    { id: 'correct', title: '累計答對 5 題單字', current: Math.min(5, s.todayQuests.correct), target: 5, done: s.todayQuests.correct >= 5, xpHint: '+10 XP' },
    { id: 'strokes', title: '描寫完成 2 個字母或字塊', current: Math.min(2, s.todayQuests.strokes), target: 2, done: s.todayQuests.strokes >= 2, xpHint: '+10 XP' },
  ];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export function weekStamps(state, now = Date.now()) {
  const today = localDateKey(now);
  const set = new Set(state.history);
  return Array.from({ length: 7 }, (_, i) => {
    const dateKey = shiftDateKey(today, i - 6);
    const [y, m, d] = dateKey.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(y, m - 1, d, 12, 0, 0).getDay()];
    return { dateKey, weekday, stamped: set.has(dateKey), isToday: dateKey === today };
  });
}

function isValidGameState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (raw.version !== 1) return false;
  if (!DATE_RE.test(String(raw.todayDate ?? ''))) return false;
  if (raw.lastActiveDate !== null && !DATE_RE.test(String(raw.lastActiveDate))) return false;
  for (const key of ['dailyGoalXp', 'todayXp', 'totalXp', 'streak', 'bestStreak']) {
    if (!Number.isSafeInteger(raw[key]) || raw[key] < 0) return false;
  }
  if (!Array.isArray(raw.history) || !raw.history.every(d => typeof d === 'string' && DATE_RE.test(d))) return false;
  if (!raw.todayQuests || typeof raw.todayQuests !== 'object') return false;
  for (const k of ['rounds', 'correct', 'strokes']) {
    if (!Number.isSafeInteger(raw.todayQuests[k]) || raw.todayQuests[k] < 0) return false;
  }
  if (!raw.writingCounts || typeof raw.writingCounts !== 'object' || Array.isArray(raw.writingCounts)) return false;
  for (const v of Object.values(raw.writingCounts)) if (!Number.isSafeInteger(v) || v < 0) return false;
  if (!raw.prefs || typeof raw.prefs.sound !== 'boolean' || typeof raw.prefs.haptics !== 'boolean') return false;
  return true;
}

/** @returns {{state:GameState,error:string|null,readOnly:boolean}} */
export function loadGameState(getStorage, now = Date.now()) {
  try {
    const raw = getStorage().getItem(GAME_KEY);
    if (raw === null) return { state: defaultGameState(now), error: null, readOnly: false };
    const parsed = JSON.parse(raw);
    if (!isValidGameState(parsed)) throw Error('invalid');
    return { state: rolloverDay(parsed, now), error: null, readOnly: false };
  } catch {
    return {
      state: defaultGameState(now),
      readOnly: true,
      error: '每日手帳紀錄無法讀取或版本較新；原紀錄未覆寫，本次進度僅暫存於畫面。',
    };
  }
}

export function saveGameState(getStorage, state) {
  try {
    const storage = getStorage();
    const raw = storage.getItem(GAME_KEY);
    if (raw !== null) {
      const previous = JSON.parse(raw);
      if (!isValidGameState(previous)) return '原每日手帳紀錄格式已變更，已停止寫入以保留原資料。';
    }
    if (!isValidGameState(state)) return '每日手帳紀錄未通過檢查，原資料未變更。';
    storage.setItem(GAME_KEY, JSON.stringify(state));
    return null;
  } catch {
    return '瀏覽器無法儲存每日手帳進度，本次仍可練習。';
  }
}
