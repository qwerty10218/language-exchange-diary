// Lightweight tactile feedback (Web Audio synthesis + Vibration API).
// Strictly UI interaction feedback only — never stored as vocabulary audio or human speech.
let prefs = { sound: true, haptics: true };
let audioCtx = null;
let lastRecoverTime = 0;

export function setFeedbackPrefs(next) {
  prefs = {
    sound: typeof next?.sound === 'boolean' ? next.sound : prefs.sound,
    haptics: typeof next?.haptics === 'boolean' ? next.haptics : prefs.haptics,
  };
}

export function getFeedbackPrefs() {
  return { ...prefs };
}

function reducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function ensureAudio() {
  if (!prefs.sound || typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

function playNotes(notes, type = 'sine') {
  const ctx = ensureAudio();
  if (!ctx) return;
  const base = ctx.currentTime;
  for (const note of notes) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type ?? type;
      osc.frequency.setValueAtTime(note.freq, base + (note.delay ?? 0));
      const start = base + (note.delay ?? 0);
      const duration = note.duration ?? 0.11;
      const peak = note.gain ?? 0.06;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.015);
    } catch {
      // Ignore audio scheduling errors on restricted mobile contexts.
    }
  }
}

export function triggerHaptic(kind = 'light') {
  if (!prefs.haptics || reducedMotion() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  const patterns = {
    light: 10,
    stroke: 12,
    success: [14, 26, 22],
    error: [18, 36, 18],
    celebration: [16, 30, 16, 30, 32],
  };
  try {
    navigator.vibrate(patterns[kind] ?? 10);
  } catch {
    // Some browsers disallow vibrate without prior gesture.
  }
}

export function playStroke() {
  playNotes([
    { freq: 523.25, duration: 0.07, gain: 0.05 },
    { freq: 659.25, delay: 0.045, duration: 0.09, gain: 0.055 },
  ], 'triangle');
  triggerHaptic('stroke');
}

export function playCharacterComplete() {
  playNotes([
    { freq: 523.25, duration: 0.09, gain: 0.06 },
    { freq: 659.25, delay: 0.065, duration: 0.1, gain: 0.065 },
    { freq: 783.99, delay: 0.13, duration: 0.16, gain: 0.07 },
  ], 'triangle');
  triggerHaptic('success');
}

export function playCorrect(combo = 1) {
  const boost = Math.min(6, Math.max(0, combo - 1));
  const semitone = 2 ** (boost / 12);
  playNotes([
    { freq: 523.25 * semitone, duration: 0.08, gain: 0.06 },
    { freq: 659.25 * semitone, delay: 0.06, duration: 0.14, gain: 0.07 },
  ], 'triangle');
  triggerHaptic('light');
}

export function playWrong() {
  playNotes([
    { freq: 246.94, duration: 0.09, gain: 0.045 },
    { freq: 196.0, delay: 0.075, duration: 0.13, gain: 0.045 },
  ], 'sine');
  triggerHaptic('error');
}

export function playRecovering() {
  const now = Date.now();
  if (now - lastRecoverTime < 650) return;
  lastRecoverTime = now;
  playNotes([{ freq: 311.13, duration: 0.05, gain: 0.025 }], 'sine');
  triggerHaptic('light');
}

export function playCelebration() {
  playNotes([
    { freq: 523.25, duration: 0.09, gain: 0.06 },
    { freq: 659.25, delay: 0.07, duration: 0.09, gain: 0.065 },
    { freq: 783.99, delay: 0.14, duration: 0.11, gain: 0.07 },
    { freq: 1046.5, delay: 0.21, duration: 0.24, gain: 0.075 },
  ], 'triangle');
  triggerHaptic('celebration');
}
