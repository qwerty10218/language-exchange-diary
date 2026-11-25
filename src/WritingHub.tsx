import { useMemo } from 'react';
import { writingCharacters, canPractice } from './writing';
import { wordWritingUnits } from './writing-units';
import { localDateKey } from './game-state.mjs';
import { useChinese } from './Chinese';
import type { Entry, Language } from './types';

type Props = {
  language: Language;
  entries: Entry[];
  activeId?: string;
  activeWordId?: string;
  writingCounts: Record<string, number>;
  onSwitchLanguage: (lang: Language) => void;
  onSelectCharacter: (id: string) => void;
  onSelectWord: (entry: Entry) => void;
  onOpenAlphabet: () => void;
};

function dateSeed(language: Language) {
  const key = `${localDateKey()}-${language}`;
  return [...key].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9973, 17);
}

export default function WritingHub({
  language,
  entries,
  activeId,
  activeWordId,
  writingCounts,
  onSwitchLanguage,
  onSelectCharacter,
  onSelectWord,
  onOpenAlphabet,
}: Props) {
  const { t } = useChinese();
  const seed = dateSeed(language);

  const dailyLetters = useMemo(() => {
    const pool = writingCharacters.filter(c => c.language === language && canPractice(c));
    if (!pool.length) return [];
    // Prioritize unpracticed letters gently, then rotate deterministically per day.
    const sorted = [...pool].sort((a, b) => {
      const diff = (writingCounts[a.id] ?? 0) - (writingCounts[b.id] ?? 0);
      if (diff !== 0) return diff;
      const ha = ([...a.id].reduce((n, c) => n + c.charCodeAt(0), 0) * 19 + seed) % 389;
      const hb = ([...b.id].reduce((n, c) => n + c.charCodeAt(0), 0) * 19 + seed) % 389;
      return ha - hb;
    });
    return sorted.slice(0, 4);
  }, [language, seed, writingCounts]);

  const dailyWords = useMemo(() => {
    const eligible = entries.filter(e => e.text !== 'ㅅㅂ' && wordWritingUnits(e).supported.length > 0 && wordWritingUnits(e).unsupported.length === 0);
    if (!eligible.length) return [];
    const rotated = eligible.map((entry, idx) => ({ entry, rank: (idx * 37 + seed) % 251 })).sort((a, b) => a.rank - b.rank);
    return rotated.slice(0, 3).map(item => item.entry);
  }, [entries, seed]);

  return (
    <section className="writing-hub" aria-label={t('今日手寫推薦與快速切換')}>
      <div className="writing-hub-top">
        <span className="writing-hub-title">{t('今日推薦練寫')}</span>
        <div className="writing-hub-lang" role="group" aria-label={t('手寫語言切換')}>
          <button type="button" aria-pressed={language === 'ko'} onClick={() => onSwitchLanguage('ko')}>{t('韓文')}</button>
          <button type="button" aria-pressed={language === 'ja'} onClick={() => onSwitchLanguage('ja')}>{t('日文')}</button>
        </div>
        <button type="button" className="text-button writing-hub-all" onClick={onOpenAlphabet}>{t('完整字母表 →')}</button>
      </div>
      <div className="writing-hub-strip">
        {dailyLetters.map(c => {
          const count = writingCounts[c.id] ?? 0;
          const active = !activeWordId && activeId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              className={`writing-chip${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onSelectCharacter(c.id)}
            >
              <span className="writing-chip-char" lang={c.language}>{c.display}</span>
              <small>{c.romanization}{count > 0 ? ` · ✓${count}` : ''}</small>
            </button>
          );
        })}
        {dailyWords.map(word => {
          const key = `word:${word.id}`;
          const count = writingCounts[key] ?? 0;
          const active = activeWordId === word.id;
          return (
            <button
              key={word.id}
              type="button"
              className={`writing-chip writing-chip-word${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => onSelectWord(word)}
            >
              <span className="writing-chip-char" lang={word.language}>{word.text}</span>
              <small>{t(word.meaning_zh || '單字')}{count > 0 ? ` · ✓${count}` : ''}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
