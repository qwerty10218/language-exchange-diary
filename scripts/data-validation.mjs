import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(new URL('../schemas/entry.schema.json', import.meta.url), 'utf8'));
const validate = ajv.compile(schema);
export function validateEntries(entries, language) {
  const errors = [];
  if (!Array.isArray(entries)) return ['詞條必須是 JSON 陣列'];
  const ids = new Set(), words = new Set();
  entries.forEach((entry, i) => {
    if (!validate(entry)) errors.push(`${i + 1}: ${ajv.errorsText(validate.errors)}`);
    if (!entry || typeof entry !== 'object') return;
    if (entry.language !== language || typeof entry.id !== 'string' || !entry.id.startsWith(`${language}-`)) errors.push(`${i + 1}: 語言或 ID 前綴不符 ${language}`);
    if (ids.has(entry.id)) errors.push(`${i + 1}: 重複 ID ${entry.id}`);
    const key = typeof entry.text === 'string' ? entry.text.normalize('NFC').trim() : '';
    if (words.has(key)) errors.push(`${i + 1}: 重複詞條 ${key}`);
    ids.add(entry.id); words.add(key);
    if (entry.audio && !/^\/audio\/[a-zA-Z0-9_-]+\.(mp3|ogg|wav|webm)$/.test(entry.audio.src)) errors.push(`${i + 1}: 音檔必須是安全的本地檔名`);
  });
  return errors;
}
