import { createContext, useContext, useMemo } from 'react';
import { toSimplified, chineseNote } from './zh-script.mjs';

export type ChineseScript = 'hant' | 'hans';
export const ChineseContext = createContext<ChineseScript>('hant');

// Translate at render time. Tagged templates translate only their literal parts:
// vocabulary, names and personal mnemonics passed as values stay untouched.
export function useChinese() {
  const script = useContext(ChineseContext);
  return useMemo(() => {
    const convert = (value: string) => script === 'hans' ? toSimplified(value) : value;
    const t = (value: string | TemplateStringsArray, ...values: unknown[]): string =>
      typeof value === 'string' ? convert(value) : value.reduce((text, part, i) => text + convert(part) + (i < values.length ? String(values[i]) : ''), '');
    return { t, note: (value: string) => script === 'hans' ? chineseNote(value) : value };
  }, [script]);
}
