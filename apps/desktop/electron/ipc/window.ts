import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { takePendingFile } from '../fileOpenQueue';

/** Channel asking the renderer to save before the window closes. */
export const SAVE_AND_CLOSE_CHANNEL = 'officewrite:save-and-close';

interface CloseGuardState {
  /** Mirrors the renderer's unsaved-changes flag. */
  dirty: boolean;
  /** Set once the user has resolved the prompt, so the next close goes through. */
  allowClose: boolean;
}

const state: CloseGuardState = { dirty: false, allowClose: false };

export function registerWindowIpc(getWindow: () => BrowserWindow | null) {
  ipcMain.handle('window:setDirty', (_e, dirty: boolean) => {
    state.dirty = !!dirty;
    return true;
  });

  // The renderer calls this after finishing the save it was asked to perform,
  // or to abandon the close if that save failed or was cancelled.
  ipcMain.handle('window:closeNow', (_e, proceed: boolean) => {
    if (!proceed) return false;
    state.allowClose = true;
    getWindow()?.close();
    return true;
  });

  ipcMain.handle('app:takePendingFile', () => takePendingFile());
}

/**
 * Prompt before discarding unsaved work.
 *
 * The window previously had only a `closed` handler, so closing with unsaved
 * changes threw the document away without a word.
 */
export function attachCloseGuard(win: BrowserWindow) {
  win.on('close', (event) => {
    if (state.allowClose || !state.dirty) return;

    event.preventDefault();

    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'Save changes before closing?',
      detail: 'Your document has unsaved changes. They will be lost if you close without saving.',
    });

    if (choice === 2) return;

    if (choice === 1) {
      state.allowClose = true;
      win.close();
      return;
    }

    // Hand back to the renderer: it owns the save path and the format logic.
    win.webContents.send(SAVE_AND_CLOSE_CHANNEL);
  });

  win.on('closed', () => {
    state.dirty = false;
    state.allowClose = false;
  });
}
