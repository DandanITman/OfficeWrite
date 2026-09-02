import nspell from 'nspell';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

const LOCALE_PACKAGES: Record<string, string> = {
  'en-US': 'dictionary-en',
  'en-GB': 'dictionary-en',
  'en': 'dictionary-en',
  'de-DE': 'dictionary-de',
  'de': 'dictionary-de',
  'es-ES': 'dictionary-es',
  'es': 'dictionary-es',
  'fr-FR': 'dictionary-fr',
  'fr': 'dictionary-fr',
};

const cache = new Map<string, ReturnType<typeof nspell>>();

function resolveLocale(language: string) {
  if (LOCALE_PACKAGES[language]) return language;
  const base = language.split('-')[0];
  if (LOCALE_PACKAGES[base]) return base;
  return 'en-US';
}

function loadDictionary(localeKey: string) {
  const pkg = LOCALE_PACKAGES[localeKey] ?? 'dictionary-en';
  const dictEntry = require.resolve(pkg);
  const dir = path.dirname(dictEntry);
  const aff = fs.readFileSync(path.join(dir, 'index.aff'), 'utf-8');
  const dic = fs.readFileSync(path.join(dir, 'index.dic'), 'utf-8');
  return { aff, dic };
}

function getSpellChecker(language: string) {
  const locale = resolveLocale(language);
  if (cache.has(locale)) return cache.get(locale)!;

  try {
    const { aff, dic } = loadDictionary(locale);
    const checker = nspell(aff, dic);
    cache.set(locale, checker);
    return checker;
  } catch {
    if (locale !== 'en-US') return getSpellChecker('en-US');
    const { aff, dic } = loadDictionary('en-US');
    const checker = nspell(aff, dic);
    cache.set('en-US', checker);
    return checker;
  }
}

export async function checkWords(words: string[], language = 'en-US'): Promise<boolean[]> {
  const spell = getSpellChecker(language);
  return words.map((w) => spell.correct(w));
}

export async function suggestWord(word: string, language = 'en-US'): Promise<string[]> {
  const spell = getSpellChecker(language);
  return spell.suggest(word).slice(0, 8);
}
