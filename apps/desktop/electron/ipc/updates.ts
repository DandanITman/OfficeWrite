import { app, ipcMain, net } from 'electron';
import { version as developmentVersion } from '../../package.json';
import type { UpdateCheckResult } from '../../src/platform/api';

const REPOSITORY_URL = 'https://github.com/DandanITman/OfficeWrite';
const RELEASE_API_URL = 'https://api.github.com/repos/DandanITman/OfficeWrite/releases/latest';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_DURATION_MS = 60_000;

/** Release tags use stable semantic versions; compare components numerically. */
function parseVersion(value: unknown): number[] | null {
  if (typeof value !== 'string') return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function isNewerVersion(latest: number[], current: number[]): boolean {
  for (let index = 0; index < 3; index++) {
    if (latest[index] !== current[index]) return latest[index] > current[index];
  }
  return false;
}

function hasWindowsInstaller(assets: unknown, tag: string): boolean {
  if (!Array.isArray(assets)) return false;
  const prefix = `${REPOSITORY_URL}/releases/download/${encodeURIComponent(tag)}/`;
  return assets.some((asset: unknown) => {
    if (!asset || typeof asset !== 'object') return false;
    const candidate = asset as Record<string, unknown>;
    return candidate.state === 'uploaded'
      && typeof candidate.name === 'string'
      && candidate.name.toLowerCase().endsWith('.exe')
      && typeof candidate.browser_download_url === 'string'
      && candidate.browser_download_url.startsWith(prefix);
  });
}

async function fetchLatestRelease(): Promise<UpdateCheckResult> {
  // Online status is a useful first gate, not proof that GitHub is reachable.
  if (!net.isOnline()) return { status: 'offline' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await net.fetch(RELEASE_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
      return { status: 'rate-limited' };
    }
    if (!response.ok) return { status: 'unavailable' };

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') return { status: 'unavailable' };
    const release = data as Record<string, unknown>;
    const latest = parseVersion(release.tag_name);
    const current = parseVersion(app.isPackaged ? app.getVersion() : developmentVersion);
    if (!latest || !current || typeof release.tag_name !== 'string'
      || release.draft !== false || release.prerelease !== false
      || !hasWindowsInstaller(release.assets, release.tag_name)) {
      return { status: 'unavailable' };
    }

    return isNewerVersion(latest, current)
      ? {
          status: 'available',
          version: latest.join('.'),
          // Build the link from the validated tag, never from a remote URL field.
          releaseUrl: `${REPOSITORY_URL}/releases/tag/${encodeURIComponent(release.tag_name)}`,
        }
      : { status: 'up-to-date' };
  } catch {
    return { status: net.isOnline() ? 'unavailable' : 'offline' };
  } finally {
    clearTimeout(timeout);
  }
}

export function registerUpdateIpc() {
  let pending: Promise<UpdateCheckResult> | null = null;
  let cached: { result: UpdateCheckResult; expiresAt: number } | null = null;

  // No timer or startup check: only the About button can initiate a request.
  ipcMain.handle('app:checkForUpdates', async (): Promise<UpdateCheckResult> => {
    if (!net.isOnline()) return { status: 'offline' };
    if (cached && Date.now() < cached.expiresAt) return cached.result;
    if (pending) return pending;

    pending = fetchLatestRelease();
    try {
      const result = await pending;
      if (result.status === 'available' || result.status === 'up-to-date') {
        cached = { result, expiresAt: Date.now() + CACHE_DURATION_MS };
      }
      return result;
    } finally {
      pending = null;
    }
  });
}
