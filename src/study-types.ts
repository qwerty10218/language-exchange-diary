export type LearningRecord = {
  correct:number;wrong:number;streak:number;lastPracticed:number|null;nextReview:number|null;
  state:'new'|'practicing'|'mastered'|'due';legacyReview?:'remembered'|'forgotten';
};
export type LearningRecords=Record<string,LearningRecord>;
