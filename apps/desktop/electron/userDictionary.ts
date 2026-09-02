import path from 'node:path';
import { dataDir, readJson, writeJson } from './store';

const userDictionaryPath = path.join(dataDir, 'user-dictionary.json');

let cache: Set<string> | null = null;

async function load(): Promise<Set<string>> {
  if (cache) return cache;
  const words = await readJson<string[]>(userDictionaryPath, []);
  cache = new Set(words.map((w) => w.toLowerCase()));
  return cache;
}

/**
 * Words the user accepted via "Add to dictionary".
 *
 * The spell suggestion menu previously offered only "Ignore", which closed the
 * menu and did nothing - there was no way to teach the checker a word.
 */
export async function getUserDictionary(): Promise<string[]> {
  return [...(await load())];
}

export async function addToUserDictionary(word: string): Promise<string[]> {
  const trimmed = word.trim();
  if (!trimmed) return getUserDictionary();

  const words = await load();
  words.add(trimmed.toLowerCase());
  await writeJson(userDictionaryPath, [...words]);
  return [...words];
}

export async function isKnownWord(word: string): Promise<boolean> {
  return (await load()).has(word.trim().toLowerCase());
}
