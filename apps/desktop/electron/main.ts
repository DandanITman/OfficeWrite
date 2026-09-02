import { app, BrowserWindow, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ensureDataDir, migrateLegacyUserData } from './store';
import { loadWindowState, trackWindowState } from './windowState';
import { attachWindow, documentFromArgv, queueFileOpen } from './fileOpenQueue';
import { registerFileIpc } from './ipc/files';
import { registerSettingsIpc } from './ipc/settings';
import { registerRevisionIpc } from './ipc/revisions';
import { registerOutputIpc } from './ipc/output';
import { attachCloseGuard, registerWindowIpc } from './ipc/window';
import { registerExternalIpc } from './ipc/external';

/**
 * The dev server URL, injected by vite-plugin-electron when running `npm run
 * dev`. Keying off `!app.isPackaged` instead meant *any* unpackaged launch --
 * including running the built dist-electron/main.js directly, and every
 * automated test -- tried to load http://localhost:5173 and rendered nothing.
 */
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
let mainWindow: BrowserWindow | null = null;

const getWindow = () => mainWindow;

function resolveAppIcon() {
  const candidates = [
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../../build/icon.png'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return nativeImage.createFromPath(candidate);
  }
  return undefined;
}

async function createWindow() {
  const { options, maximized } = await loadWindowState();

  mainWindow = new BrowserWindow({
    ...options,
    minWidth: 900,
    minHeight: 600,
    title: 'Officewrite',
    icon: resolveAppIcon(),
    backgroundColor: '#f3f4f6',
    autoHideMenuBar: true,
    // Shown once the renderer has painted, so the window never flashes empty.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (maximized) mainWindow.maximize();
  trackWindowState(mainWindow);
  attachCloseGuard(mainWindow);
  attachWindow(mainWindow);

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// A second launch (e.g. double-clicking another document) must route the file
// into the running window rather than starting a rival instance.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    queueFileOpen(documentFromArgv(argv));
  });

  // macOS delivers associated files through this event instead of argv.
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    queueFileOpen(filePath);
  });

  app.whenReady().then(async () => {
    // Before anything reads settings or recents: bring across the folder the
    // app used under its old name, or the rename looks like data loss.
    migrateLegacyUserData();
    ensureDataDir();
    Menu.setApplicationMenu(null);

    registerFileIpc(getWindow);
    registerSettingsIpc();
    registerRevisionIpc();
    registerOutputIpc(getWindow);
    registerWindowIpc(getWindow);
    registerExternalIpc();

    // Capture the launch argument before the window exists; the renderer
    // collects it once it has mounted.
    queueFileOpen(documentFromArgv(process.argv));

    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
