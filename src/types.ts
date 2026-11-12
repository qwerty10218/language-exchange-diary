export type Language = 'ko' | 'ja';
export type Entry = {
  id: string; language: Language; kind: 'word' | 'phrase' | 'grammar'; text: string;
  meaning_zh: string; reading: string | null; romaji: string | null;
  personal_mnemonic: string | null; examples: {text: string; meaning_zh: string; reading?: string | null}[];
  notes: string; review_status: 'needs_review' | 'verified';
  audio: null | {kind: 'human_recording'; src: string; source_page: string; creator: string; license: string; attribution: string; verified_by: string; checked_on: string};
};
