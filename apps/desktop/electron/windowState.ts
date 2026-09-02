import { screen, type BrowserWindow, type Rectangle } from 'electron';
import { readJson, windowStatePath, writeJson } from './store';

interface WindowState {
  bounds?: Rectangle;
  maximized?: boolean;
}

const DEFAULT_SIZE = { width: 1280, height: 860 };

/** True when the saved rectangle still overlaps a currently connected display. */
function isOnScreen(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

export async function loadWindowState(): Promise<{
  options: { width: number; height: number; x?: number; y?: number };
  maximized: boolean;
}> {
  const state = await readJson<WindowState>(windowStatePath, {});
  const bounds = state.bounds;

  // Ignore a saved position that would place the window off every display -
  // e.g. after disconnecting an external monitor.
  if (bounds && isOnScreen(bounds)) {
    return {
      options: { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y },
      maximized: !!state.maximized,
    };
  }
  return { options: { ...DEFAULT_SIZE }, maximized: !!state.maximized };
}

/** Persist size, position and maximised state as the user changes them. */
export function trackWindowState(win: BrowserWindow) {
  let timer: NodeJS.Timeout | undefined;

  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed()) return;
      void writeJson(windowStatePath, {
        // getNormalBounds() reports the restored size, not the maximised one.
        bounds: win.getNormalBounds(),
        maximized: win.isMaximized(),
      });
    }, 400);
  };

  win.on('resize', persist);
  win.on('move', persist);
  win.on('maximize', persist);
  win.on('unmaximize', persist);
  win.on('close', () => {
    if (timer) clearTimeout(timer);
    if (!win.isDestroyed()) {
      void writeJson(windowStatePath, {
        bounds: win.getNormalBounds(),
        maximized: win.isMaximized(),
      });
    }
  });
}
