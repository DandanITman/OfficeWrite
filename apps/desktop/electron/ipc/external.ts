import { ipcMain, shell } from 'electron';

/**
 * The only origin the app will ever hand to the user's browser.
 *
 * Help and update-release links leave the app through this allowlist.
 * Rather than trust the renderer, the main
 * process re-parses the URL and refuses anything that is not this project's
 * repository over HTTPS - so a bug (or an injected string) in the renderer
 * cannot turn Help into a general-purpose "open any link" primitive.
 */
const ALLOWED_HOST = 'github.com';
const ALLOWED_PATH_PREFIX = '/DandanITman/OfficeWrite';

export function isAllowedExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.hostname !== ALLOWED_HOST) return false;
  // Guard the separator too, so /DandanITman/OfficeWriteEvil is not a prefix match.
  if (url.pathname !== ALLOWED_PATH_PREFIX && !url.pathname.startsWith(`${ALLOWED_PATH_PREFIX}/`)) {
    return false;
  }
  return true;
}

/** Help tab: hand a repository URL to the OS browser, never to a window here. */
export function registerExternalIpc() {
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string' || !isAllowedExternalUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });
}
