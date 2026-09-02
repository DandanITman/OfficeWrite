import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ensureDir, revisionsDir } from '../store';

const MAX_REVISIONS_PER_DOCUMENT = 20;

function revisionKeyForDoc(docPath: string) {
  return Buffer.from(docPath.toLowerCase()).toString('base64url').slice(0, 48);
}

export function registerRevisionIpc() {
  ipcMain.handle('revisions:save', async (_e, docPath: string, snapshot: unknown, label: string) => {
    const dir = path.join(revisionsDir, revisionKeyForDoc(docPath));
    ensureDir(dir);

    const timestamp = Date.now();
    const id = String(timestamp);
    await fs.writeFile(
      path.join(dir, `${id}.json`),
      JSON.stringify({ id, timestamp, label, content: snapshot }, null, 2),
      'utf-8',
    );

    const entries = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse();
    for (const old of entries.slice(MAX_REVISIONS_PER_DOCUMENT)) {
      await fs.unlink(path.join(dir, old)).catch(() => undefined);
    }

    return { id, timestamp, label, filePath: docPath };
  });

  ipcMain.handle('revisions:list', async (_e, docPath: string) => {
    const dir = path.join(revisionsDir, revisionKeyForDoc(docPath));
    if (!existsSync(dir)) return [];

    const revisions = [];
    for (const entry of (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))) {
      try {
        const parsed = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf-8')) as {
          id: string;
          timestamp: number;
          label: string;
        };
        revisions.push({ ...parsed, filePath: docPath });
      } catch {
        // A truncated snapshot should not take the whole history down with it.
      }
    }
    return revisions.sort((a, b) => b.timestamp - a.timestamp);
  });

  ipcMain.handle('revisions:load', async (_e, docPath: string, id: string) => {
    const filePath = path.join(revisionsDir, revisionKeyForDoc(docPath), `${id}.json`);
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8')) as { content: unknown };
    return parsed.content;
  });
}
