// Pure geometry: independent of browser pixels and device pixel ratio.
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function resample(points, count = 48) {
  if (points.length < 2) return [];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  const total = lengths.at(-1);
  if (!Number.isFinite(total) || total < 1) return [];
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < target) segment++;
    const span = lengths[segment] - lengths[segment - 1];
    const t = span ? (target - lengths[segment - 1]) / span : 0;
    const a = points[segment - 1], b = points[segment];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}
export function judgeStroke(actual, expected) {
  const a = resample(actual), b = resample(expected);
  if (!a.length || !b.length) return { ok: false, reason: '筆畫太短，請畫完整一筆。' };
  const start = distance(a[0], b[0]), end = distance(a.at(-1), b.at(-1));
  if (distance(a[0], b.at(-1)) + distance(a.at(-1), b[0]) + 50 < start + end)
    return { ok: false, reason: '方向可能相反，請沿起點箭頭重畫。' };
  if (start > 140 || end > 160) return { ok: false, reason: '起點或終點偏離，請確認筆順。' };
  // Ordered DTW permits uneven finger speed, but cannot reorder a stroke.
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(Infinity));
  dp[0][0] = 0;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = distance(a[i - 1], b[j - 1]) + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  const score = dp[a.length][b.length] / Math.max(a.length, b.length);
  return { ok: score < 85, reason: score < 85 ? '這一筆通過。' : '軌跡偏離較多，請看示範再試。', score };
}
export function toPoint(clientX, clientY, rect) {
  return { x: (clientX - rect.left) / rect.width * 1024, y: (clientY - rect.top) / rect.height * 1024 };
}

// Ratios of the SVG square; override per character/stroke without changing data.
export const GUIDE_DEFAULTS = Object.freeze({
  side: 1024, startRadius: .15, snapRadius: .13, maxDeviation: .20,
  completion: .75, closeRatio: .60, sampleSpacing: 4,
  maxInputGap: .12, maxReverseTravel: .06,
  maxSearchFraction: .25, recoveryWindow: .025,
  forwardSlack: .008, travelMultiplier: 1.6, acceptanceMs: 450,
  autoTriggerDistance: .04, autoTriggerFraction: .15, autoDirectionCosine: .5,
});
/** @type {Record<string, Record<number, Partial<typeof GUIDE_DEFAULTS>>>} */
export const GUIDE_OVERRIDES = {}; // Character id -> zero-based stroke -> optional settings.
export const guideOptions = (characterId, strokeIndex) => GUIDE_OVERRIDES[characterId]?.[strokeIndex] ?? {};
export function screenToSvg(svg, clientX, clientY) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX; point.y = clientY;
  const local = point.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}
export const insideSquare = (p, side = 1024) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= side && p.y <= side;

// Local, ordered segment projections, never a global nearest-point search.
export function project(point, samples, lengths, min, max) {
  let best = null;
  for (let i = 1; i < samples.length; i++) {
    if (lengths[i] < min || lengths[i - 1] > max) continue;
    const a = samples[i - 1], b = samples[i];
    const dx = b.x - a.x, dy = b.y - a.y, span = lengths[i] - lengths[i - 1];
    if (!span) continue;
    const lower = Math.max(0, (min - lengths[i - 1]) / span);
    const upper = Math.min(1, (max - lengths[i - 1]) / span);
    const t = Math.max(lower, Math.min(upper, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
    const projected = { x: a.x + dx * t, y: a.y + dy * t };
    const gap = distance(point, projected);
    if (!best || gap < best.gap) best = { point: projected, gap, arc: lengths[i - 1] + span * t };
  }
  return best;
}
export function createGuidedStroke(expected, overrides = {}) {
  const config = { ...GUIDE_DEFAULTS, ...overrides };
  const total = expected.slice(1).reduce((n, p, i) => n + distance(expected[i], p), 0);
  const samples = resample(expected, Math.max(2, Math.ceil(total / config.sampleSpacing) + 1));
  const lengths = [0];
  for (let i = 1; i < samples.length; i++) lengths.push(lengths[i - 1] + distance(samples[i - 1], samples[i]));
  const length = lengths.at(-1);
  const trace = {
    phase: 'waiting', rawPoints: [], snappedPoints: [], progress: 0,
    invalid: '', closeTravel: 0, rawTravel: 0, reverseTravel: 0, arc: 0, pendingTravel: 0, recovering: false,
    directionArc: 0, directionPeak: 0, startOffset: { x: 0, y: 0 },
    result: { ok: false, reason: '尚未書寫。' },
    start(point) {
      if (this.phase !== 'waiting') return;
      this.phase = 'drawing'; this.rawPoints.push({ ...point });
      if (samples.length) this.startOffset = { x: point.x - samples[0].x, y: point.y - samples[0].y };
      if (!insideSquare(point, config.side) || !samples.length) this.invalid = '請在字框內開始。';
      else if (distance(point, samples[0]) > config.side * config.startRadius)
        this.invalid = distance(point, samples.at(-1)) < config.side * config.startRadius ? '方向相反，請從數字起點開始。' : '筆順不符，請從目前標示的起點開始。';
      // No ink appears at another stroke or at an arbitrary location.
      if (!this.invalid) this.snappedPoints.push({ ...samples[0] });
    },
    add(point) {
      if (this.phase !== 'drawing') return;
      const previous = this.rawPoints.at(-1);
      this.rawPoints.push({ ...point });
      if (!insideSquare(point, config.side)) { this.invalid ||= '超出字框，請重畫這一筆。'; return; }
      if (this.invalid) return;
      const travel = distance(previous, point);
      if (!travel) return;
      this.rawTravel += travel;
      if (travel > Math.min(config.side * config.maxInputGap, length * config.maxSearchFraction)) { this.invalid = '軌跡不連續，請沿整筆描寫。'; return; }
      // Off-line motion never buys forward progress. Rejoin close to the frozen arc.
      if (this.recovering) {
        const rejoin = project(point, samples, lengths, this.arc, Math.min(length, this.arc + Math.min(config.side * config.maxInputGap, length * config.maxSearchFraction)));
        if (!rejoin || rejoin.gap > config.side * config.maxDeviation) { this.invalid = '偏離超出目前容許範圍，請重畫這一筆。'; return; }
        if (!rejoin || rejoin.gap > config.side * config.snapRadius) return;
        const i = Math.min(samples.length - 1, Math.max(1, lengths.findIndex(n => n > rejoin.arc)));
        const a = samples[i - 1], b = samples[i];
        const along = Math.abs(((point.x - rejoin.point.x) * (b.x - a.x) + (point.y - rejoin.point.y) * (b.y - a.y)) / distance(a, b));
        if (along > Math.min(config.side * config.recoveryWindow, length * .04)) return;
        this.recovering = false;
        this.pendingTravel = 0;
        return; // Resume on the next event, with no leap credited for the excursion.
      }
      this.pendingTravel += travel;
      const from = this.arc;
      const allowance = Math.min(config.side * config.maxInputGap, length * config.maxSearchFraction, this.pendingTravel * config.travelMultiplier + config.side * config.forwardSlack);
      const to = Math.min(length, this.arc + allowance);
      const match = project(point, samples, lengths, from, to);
      if (!match || match.gap > config.side * config.maxDeviation) { this.invalid = '偏離超出目前容許範圍，請重畫這一筆。'; return; }
      if (match.gap <= config.side * config.snapRadius) this.closeTravel += travel;
      // Check ordered direction on a translation-compensated copy of raw input.
      // This avoids treating the permitted positional offset at a hairpin as reversal.
      // Display/progress/coverage still use the original raw coordinates above.
      if (match.gap <= config.side * config.snapRadius) {
        const directionPoint = { x: point.x - this.startOffset.x, y: point.y - this.startOffset.y };
        const window = Math.min(config.side * config.maxInputGap, length * config.maxSearchFraction, travel * config.travelMultiplier + config.side * config.forwardSlack);
        const direction = project(directionPoint, samples, lengths, Math.max(0, this.directionArc - window), Math.min(length, this.directionArc + window));
        if (direction) {
          this.directionArc = direction.arc; this.directionPeak = Math.max(this.directionPeak, direction.arc);
          this.reverseTravel = this.directionPeak - direction.arc;
          if (this.reverseTravel > config.side * config.maxReverseTravel) { this.invalid = '方向相反，請沿箭頭方向描寫。'; return; }
        }
      }
      // Do not reveal the centerline ahead while the finger is outside magnet range.
      if (match.gap > config.side * config.snapRadius) { this.recovering = true; this.pendingTravel = 0; return; }
      if (match.arc <= this.arc) return;
      // Render all intervening centerline points, including loops, without shortcuts.
      for (let i = 1; i < samples.length; i++) if (lengths[i] > this.arc && lengths[i] < match.arc) this.snappedPoints.push(samples[i]);
      this.snappedPoints.push(match.point);
      this.pendingTravel = Math.max(0, this.pendingTravel - (match.arc - this.arc) / config.travelMultiplier);
      this.arc = match.arc; this.progress = this.arc / length;
    },
    finish() {
      if (this.phase !== 'drawing') return this.result;
      this.phase = 'validating';
      const reason = this.invalid || (this.recovering ? '請回到目前筆畫末端再繼續描寫。' : '') || (this.rawPoints.length < 4 || this.rawTravel < length * config.completion ? '軌跡太短，請完整描寫。' : '') ||
        (this.progress < config.completion || this.directionPeak / length < config.completion ? '尚未完成這一筆，請沿引導線寫到底。' : '') ||
        (this.closeTravel / this.rawTravel < config.closeRatio ? '請讓手指多沿著目前筆畫描寫。' : '');
      this.result = { ok: !reason, reason: reason || '這一筆完成，看看正確筆畫。' };
      this.phase = reason ? 'rejected' : 'accepted';
      return this.result;
    },
    canAutoComplete() {
      if (this.phase !== 'drawing' || this.invalid || this.recovering) return false;
      const trigger = Math.min(config.side * config.autoTriggerDistance, length * config.autoTriggerFraction);
      const target = project(samples[0], samples, lengths, trigger, trigger)?.point;
      const first = this.rawPoints[0], last = this.rawPoints.at(-1);
      if (!target || !first || !last) return false;
      const dx = last.x - first.x, dy = last.y - first.y;
      const tx = target.x - samples[0].x, ty = target.y - samples[0].y;
      const net = Math.hypot(dx, dy), span = Math.hypot(tx, ty);
      const alignment = net && span ? (dx * tx + dy * ty) / (net * span) : -1;
      return this.directionPeak >= trigger && this.rawTravel >= trigger && net >= trigger * .8 &&
        this.closeTravel / this.rawTravel >= config.closeRatio && alignment >= config.autoDirectionCosine;
    },
    finishDirection() {
      if (this.phase !== 'drawing') return this.result;
      const ok = this.canAutoComplete();
      const first = this.rawPoints[0], last = this.rawPoints.at(-1);
      const tip = samples[Math.min(samples.length - 1, 4)];
      const reverse = first && last && tip && (last.x - first.x) * (tip.x - samples[0].x) + (last.y - first.y) * (tip.y - samples[0].y) < -1;
      this.phase = 'validating';
      this.result = { ok, reason: ok ? '方向正確，這一筆會自動補完，可以放開。' : this.invalid || (reverse ? '方向相反，請沿箭頭方向起拉。' : '請從目前起點沿箭頭拉一小段；只點一下不會補完。') };
      this.phase = ok ? 'accepted' : 'rejected';
      return this.result;
    },
    cancel() {
      if (this.phase !== 'drawing' && this.phase !== 'validating') return;
      this.phase = 'rejected'; this.snappedPoints = [];
      this.result = { ok: false, reason: '書寫已取消，請重新開始這一筆。' };
    },
    afterAnimation(last = false) {
      if (this.phase === 'accepted') this.phase = last ? 'completed' : 'waiting';
    },
  };
  return trace;
}
