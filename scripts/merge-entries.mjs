import { validateEntries } from './data-validation.mjs';

// Pure merge: previewable; writing the returned data is an explicit separate step.
export function mergeEntries(existing, candidates, language) {
  const errors = [...validateEntries(existing, language), ...validateEntries(candidates, language)];
  if (errors.length) throw new Error(errors.join('\n'));
  if (candidates.some(e => e.review_status !== 'needs_review' || e.audio !== null)) throw new Error('本次 MVP 候選必須為 needs_review、audio:null');
  const entries = structuredClone(existing), conflicts = [], added = [], filled = [];
  const key = text => text.normalize('NFC').trim();
  const empty = value => value === null || value === '' || (Array.isArray(value) && !value.length);
  for (const candidate of candidates) {
    const byId = entries.find(e => e.id === candidate.id);
    const byText = entries.find(e => key(e.text) === key(candidate.text));
    if (byId && byText && byId.id !== byText.id) {
      conflicts.push({ id: candidate.id, text: candidate.text, field: 'identity', existing: [byId.id, byText.id], candidate: candidate.id });
      continue;
    }
    const current = byId ?? byText;
    if (!current) { entries.push(structuredClone(candidate)); added.push(candidate.id); continue; }
    for (const [field, value] of Object.entries(candidate)) {
      if (field === 'id' || empty(value) || JSON.stringify(current[field]) === JSON.stringify(value)) continue;
      if (empty(current[field])) { current[field] = structuredClone(value); filled.push({ id: current.id, field }); }
      else conflicts.push({ id: current.id, text: current.text, field, existing: current[field], candidate: value });
    }
  }
  const resultErrors = validateEntries(entries, language);
  if (resultErrors.length) throw new Error(resultErrors.join('\n'));
  return { entries, added, filled, conflicts };
}
