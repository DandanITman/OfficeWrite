import { app } from 'electron';
import fs from 'node:fs/promises';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const dataDir = path.join(app.getPath('userData'), 'data');
export const settingsPath = path.join(dataDir, 'settings.json');
export const recentsPath = path.join(dataDir, 'recents.json');
export const revisionsDir = path.join(dataDir, 'revisions');
export const windowStatePath = path.join(dataDir, 'window.json');

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function ensureDataDir() {
  ensureDir(dataDir);
}

/**
 * Folders an older build of this app may have written its data to.
 *
 * Electron derives userData from the package name, so a package rename moves
 * the whole folder. Both the scoped and the plain spelling are tried, because
 * a build that set a plain productName would have used the second, and
 * checking costs nothing.
 */
function legacyDataDirs(): string[] {
  const current = app.getPath('userData');
  return [
    // ...\@officewrite\desktop  ->  ...\@dansword\desktop
    current.replace(/@officewrite/i, '@dansword'),
    // ...\Officewrite  ->  ...\DansWord
    path.join(path.dirname(current), 'DansWord'),
  ]
    .filter((dir) => dir !== current)
    .map((dir) => path.join(dir, 'data'));
}

/**
 * Carry settings, recents and version history over from an older build.
 *
 * Electron derives userData from the product name, so a rename moves the whole
 * folder. Without this, anyone upgrading from an older build would be returned
 * to a first-run state - no recents, no pinned files, and no revision history
 * for documents they had been keeping versions of.
 *
 * The guard is simply whether this install already has a data folder. If it
 * does, it owns its own state and nothing is copied over the top; if it does
 * not, there is nothing to lose by importing. That makes the migration safe to
 * attempt on every launch without a marker file to keep in sync.
 */
export function migrateLegacyUserData() {
  if (existsSync(dataDir)) return;

  const legacyDir = legacyDataDirs().find((dir) => existsSync(dir));
  if (!legacyDir) return;

  try {
    cpSync(legacyDir, dataDir, { recursive: true });
    console.log(`Migrated user data from ${legacyDir}`);
  } catch (error) {
    // A failed migration must never stop the app starting. The user begins
    // with defaults, and their documents on disk are untouched either way.
    console.warn('Could not migrate legacy user data:', error);
  }
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath: string, data: unknown) {
  ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
