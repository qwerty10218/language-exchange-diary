import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildDailyChallenge } from './challenge-model.mjs';
import { wordWritingUnits } from './writing-units';
import { EMPTY_SPEECH, entrySpeechText, speechPlayer, preferredVoice } from './speech.mjs';
import { playCorrect, playWrong, playCelebration } from './sound-fx.mjs';
import SpeechButton from './SpeechButton';
import { useChinese } from './Chinese';
import type { Entry, Language } from './types';
import type { LearningRecords } from './study-types';
import type { WritingCharacter } from './writing';

const Phase0 = lazy(() => import('./Phase0'));

type ChoiceStep = {
  id: string;
  kind: 'choice' | 'listen';
  direction: 'to_meaning' | 'to_word';
  entry: Entry;
  prompt: string;
  reading: string;
  options: { id: string; label: string; sub: string; correct: boolean }[];
};

type MatchStep = {
  id: string;
  kind: 'match';
  pairs: { id: string; text: string; meaning: string; entry: Entry }[];
  leftOrder: string[];
  rightOrder: string[];
};

type WriteStep = {
  id: string;
  kind: 'write';
  entry: Entry;
  character: WritingCharacter;
};

type ChallengeStep = ChoiceStep | MatchStep | WriteStep;

type Props = {
  entries: Entry[];
  language: Language;
  records: LearningRecords;
  streak: number;
  onGrade: (id: string, correct: boolean) => void;
  onActivity: (delta: { xp?: number; rounds?: number; correct?: number; strokes?: number; writingId?: string | null }) => void;
  onExit: () => void;
};

export default function DailyChallenge({ entries, language, records, streak, onGrade, onActivity, onExit }: Props) {
  const { t } = useChinese();
  const [roundKey, setRoundKey] = useState(0);
  const speechState = useSyncExternalStore(speechPlayer.subscribe, speechPlayer.getSnapshot, () => EMPTY_SPEECH);
  const speechAvailable = Boolean(speechState.supported && preferredVoice(speechState.voices, language));

  const steps = useMemo<ChallengeStep[]>(
    () =>
      buildDailyChallenge(entries, language, records, {
        speechAvailable,
        writableUnitForEntry: (entry: Entry) => {
          const units = wordWritingUnits(entry);
          return units.supported[0] ?? null;
        },
      }) as ChallengeStep[],
    [entries, language, roundKey],
  );

  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [peakCombo, setPeakCombo] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [stepDone, setStepDone] = useState(false);
  const [stepCorrect, setStepCorrect] = useState<boolean | null>(null);

  // Match-pairs local state
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [mismatchFlash, setMismatchFlash] = useState<string | null>(null);
  const [roundFinished, setRoundFinished] = useState(false);

  const step = steps[index];

  const resetStepUi = () => {
    setSelectedOption(null);
    setStepDone(false);
    setStepCorrect(null);
    setPickedLeft(null);
    setPickedRight(null);
    setMatchedIds([]);
    setMismatchFlash(null);
  };

  useEffect(() => {
    resetStepUi();
    setIndex(0);
    setCombo(0);
    setPeakCombo(0);
    setXpEarned(0);
    setCorrectCount(0);
    setAnsweredCount(0);
    setRoundFinished(false);
  }, [language, roundKey]);

  const advance = () => {
    if (index + 1 >= steps.length) {
      const finishBonus = 15;
      setXpEarned(x => x + finishBonus);
      setRoundFinished(true);
      onActivity({ xp: finishBonus, rounds: 1 });
      playCelebration();
      return;
    }
    resetStepUi();
    setIndex(i => i + 1);
  };

  const handleChoice = (option: ChoiceStep['options'][number]) => {
    if (stepDone || !step || (step.kind !== 'choice' && step.kind !== 'listen')) return;
    setSelectedOption(option.id);
    setStepDone(true);
    setStepCorrect(option.correct);
    setAnsweredCount(c => c + 1);
    onGrade(step.entry.id, option.correct);
    if (option.correct) {
      const nextCombo = combo + 1;
      const gain = 5 + (nextCombo >= 3 ? 2 : 0);
      setCombo(nextCombo);
      setPeakCombo(p => Math.max(p, nextCombo));
      setCorrectCount(c => c + 1);
      setXpEarned(x => x + gain);
      onActivity({ xp: gain, correct: 1 });
      playCorrect(nextCombo);
    } else {
      setCombo(0);
      playWrong();
    }
  };

  const tryMatchPair = (leftId: string, rightId: string, matchStep: MatchStep) => {
    if (leftId === rightId) {
      const nextMatched = [...matchedIds, leftId];
      setMatchedIds(nextMatched);
      setPickedLeft(null);
      setPickedRight(null);
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setPeakCombo(p => Math.max(p, nextCombo));
      setXpEarned(x => x + 3);
      onActivity({ xp: 3, correct: 1 });
      playCorrect(nextCombo);
      if (nextMatched.length >= matchStep.pairs.length) {
        setStepDone(true);
        setStepCorrect(true);
        setCorrectCount(c => c + 1);
        setAnsweredCount(c => c + 1);
      }
    } else {
      setMismatchFlash(`${leftId}:${rightId}`);
      setCombo(0);
      playWrong();
      window.setTimeout(() => {
        setPickedLeft(null);
        setPickedRight(null);
        setMismatchFlash(null);
      }, 420);
    }
  };

  const pickLeft = (id: string, matchStep: MatchStep) => {
    if (matchedIds.includes(id) || mismatchFlash) return;
    setPickedLeft(id);
    if (pickedRight) tryMatchPair(id, pickedRight, matchStep);
  };

  const pickRight = (id: string, matchStep: MatchStep) => {
    if (matchedIds.includes(id) || mismatchFlash) return;
    setPickedRight(id);
    if (pickedLeft) tryMatchPair(pickedLeft, id, matchStep);
  };

  if (!steps.length) {
    return (
      <section className="notebook-panel challenge-panel">
        <h2>{t('目前詞條數不足，無法開啟混合闖關')}</h2>
        <button className="primary-button" onClick={onExit}>{t('回到首頁')}</button>
      </section>
    );
  }

  if (roundFinished) {
    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 100;
    return (
      <section className="notebook-panel challenge-summary" aria-live="polite">
        <div className="finish-mark" aria-hidden="true">★</div>
        <p className="section-kicker">DAILY CHALLENGE COMPLETE</p>
        <h2>{t('太棒了！完成今日一輪闖關')}</h2>
        <div className="challenge-metrics">
          <span><strong>+{xpEarned}</strong>{t('獲得 XP')}</span>
          <span><strong>{accuracy}%</strong>{t('本輪準確率')}</span>
          <span><strong>{peakCombo}</strong>{t('最高連擊')}</span>
          <span><strong>{Math.max(1, streak)}</strong>{t('連續天數')}</span>
        </div>
        <p className="muted">{t('這份紀錄會儲存在本機手帳，明天再花 3 分鐘蓋下新印章！')}</p>
        <div className="review-actions">
          <button className="primary-button" onClick={() => setRoundKey(k => k + 1)}>{t('再闖一關 →')}</button>
          <button onClick={onExit}>{t('回到今日手帳')}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="challenge-panel" aria-label={t('每日混合闖關')}>
      <div className="challenge-hud">
        <button type="button" className="text-button" onClick={onExit}>{t('← 結束')}</button>
        <div className="challenge-progress-track" role="progressbar" aria-valuenow={index + (stepDone ? 1 : 0)} aria-valuemin={0} aria-valuemax={steps.length} aria-label={t('闖關進度')}>
          <span style={{ width: `${Math.round(((index + (stepDone ? 1 : 0)) / steps.length) * 100)}%` }} />
        </div>
        <span className="challenge-xp-pill">+{xpEarned} XP</span>
        {combo >= 2 && <span className="challenge-combo-pill" aria-live="polite">{t`🔥 ${combo} 連擊`}</span>}
      </div>

      {step && (step.kind === 'choice' || step.kind === 'listen') && (
        <section className={`notebook-panel challenge-card${stepDone ? (stepCorrect ? ' answer-correct' : ' answer-wrong') : ''}`}>
          <p className="section-kicker">
            {step.kind === 'listen'
              ? t('聽音辨詞 · 裝置合成語音')
              : step.direction === 'to_meaning'
                ? t('四選一快答 · 選出中文意思')
                : t('四選一快答 · 選出對應原文')}
          </p>
          {step.kind === 'listen' ? (
            <div className="challenge-listen-box">
              <SpeechButton text={entrySpeechText(step.entry)} language={language} label={step.entry.text} compact />
              <p className="muted">{t('點擊聽發音，選出正確的意思')}</p>
            </div>
          ) : (
            <>
              <h2 className="challenge-prompt" lang={step.direction === 'to_meaning' ? language : undefined}>
                {step.direction === 'to_meaning' ? step.prompt : t(step.prompt)}
              </h2>
              {step.reading && <p className="challenge-reading" lang={language}>{step.reading}</p>}
            </>
          )}

          <div className="challenge-options">
            {step.options.map(opt => {
              const isSelected = selectedOption === opt.id;
              const stateClass = stepDone
                ? opt.correct
                  ? ' is-correct'
                  : isSelected
                    ? ' is-wrong'
                    : ''
                : '';
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`challenge-option${stateClass}`}
                  disabled={stepDone}
                  onClick={() => handleChoice(opt)}
                >
                  <span lang={step.direction === 'to_word' ? language : undefined}>
                    {step.direction === 'to_word' ? opt.label : t(opt.label)}
                  </span>
                  {opt.sub && <small lang={language}>{opt.sub}</small>}
                </button>
              );
            })}
          </div>

          {stepDone && (
            <div className="quiz-feedback" role="status">
              <h3>{stepCorrect ? t('✓ 答對了！節奏很好') : t('✕ 差一點，記住這個提示')}</h3>
              <p>
                <strong lang={language}>{step.entry.text}</strong> · {t(step.entry.meaning_zh || '')}
              </p>
              {step.entry.personal_mnemonic && (
                <p>{t('朋友的記音：')}<span data-preserve-script="true">{step.entry.personal_mnemonic}</span></p>
              )}
              <div className="quiz-actions">
                <SpeechButton text={entrySpeechText(step.entry)} language={language} label={step.entry.text} compact />
                <button type="button" className="primary-button" onClick={advance}>
                  {index + 1 >= steps.length ? t('查看通關結果 →') : t('下一題 →')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {step && step.kind === 'match' && (
        <section className={`notebook-panel challenge-card${stepDone ? ' answer-correct' : ''}`}>
          <p className="section-kicker">{t('字義配對消消樂 · 點兩兩配對')}</p>
          <p className="muted">{t`已配對 ${matchedIds.length}／${step.pairs.length} 組`}</p>
          <div className="match-columns">
            <div className="match-col">
              {step.leftOrder.map(id => {
                const pair = step.pairs.find(p => p.id === id)!;
                const matched = matchedIds.includes(id);
                const selected = pickedLeft === id;
                const wrong = mismatchFlash?.startsWith(`${id}:`);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={matched}
                    aria-pressed={selected}
                    className={`match-tile${matched ? ' is-matched' : ''}${wrong ? ' is-wrong' : ''}`}
                    lang={language}
                    onClick={() => pickLeft(id, step)}
                  >
                    {matched ? '✓ ' : ''}{pair.text}
                  </button>
                );
              })}
            </div>
            <div className="match-col">
              {step.rightOrder.map(id => {
                const pair = step.pairs.find(p => p.id === id)!;
                const matched = matchedIds.includes(id);
                const selected = pickedRight === id;
                const wrong = mismatchFlash?.endsWith(`:${id}`);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={matched}
                    aria-pressed={selected}
                    className={`match-tile${matched ? ' is-matched' : ''}${wrong ? ' is-wrong' : ''}`}
                    onClick={() => pickRight(id, step)}
                  >
                    {matched ? '✓ ' : ''}{t(pair.meaning)}
                  </button>
                );
              })}
            </div>
          </div>
          {stepDone && (
            <div className="quiz-feedback" role="status">
              <h3>{t('✓ 全部配對消除！')}</h3>
              <button type="button" className="primary-button" onClick={advance}>
                {index + 1 >= steps.length ? t('查看通關結果 →') : t('繼續下一題 →')}
              </button>
            </div>
          )}
        </section>
      )}

      {step && step.kind === 'write' && (
        <section className="notebook-panel challenge-card challenge-write-card">
          <div className="challenge-write-head">
            <div>
              <p className="section-kicker">{t('手寫挑戰 · 動手記更牢')}</p>
              <h2>
                <span lang={language}>{step.character.display}</span>
                <small> · {t('來自')} <span lang={language}>{step.entry.text}</span>（{t(step.entry.meaning_zh || '')}）</small>
              </h2>
            </div>
            <button type="button" className="text-button" onClick={advance}>{t('略過手寫 →')}</button>
          </div>
          <Suspense fallback={<p role="status">{t('載入書寫畫布…')}</p>}>
            <Phase0
              key={step.id}
              practiceCharacter={step.character}
              initialCharacterId={step.character.id}
              visible
              onComplete={() => {
                const gain = 10;
                setXpEarned(x => x + gain);
                setCorrectCount(c => c + 1);
                setAnsweredCount(c => c + 1);
                onActivity({ xp: gain, strokes: 1, writingId: step.character.id });
                advance();
              }}
            />
          </Suspense>
        </section>
      )}
    </section>
  );
}
