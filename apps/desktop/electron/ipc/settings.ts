import { app, ipcMain } from 'electron';
import path from 'node:path';
import { ensureDir, readJson, recentsPath, settingsPath, writeJson } from '../store';

export function registerSettingsIpc() {
  ipcMain.handle('settings:get', async () => readJson(settingsPath, null));

  ipcMain.handle('settings:set', async (_e, settings: unknown) => {
    await writeJson(settingsPath, settings);
    return true;
  });

  ipcMain.handle('recents:get', async () => readJson(recentsPath, []));

  ipcMain.handle('recents:set', async (_e, recents: unknown) => {
    await writeJson(recentsPath, recents);
    return true;
  });

  ipcMain.handle('app:getDefaultSaveDir', async () => {
    const settings = await readJson<{ defaultSaveLocation?: string } | null>(settingsPath, null);
    const configured = settings?.defaultSaveLocation?.trim();
    const saveDir = configured || path.join(app.getPath('documents'), 'Officewrite');
    ensureDir(saveDir);
    return saveDir;
  });
}
