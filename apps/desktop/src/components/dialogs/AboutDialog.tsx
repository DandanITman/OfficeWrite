import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { version } from '../../../package.json';
import { getPlatform, isPlatformAvailable } from '../../platform';
import type { UpdateCheckResult } from '../../platform/api';
import { Dialog } from './Dialog';

function describeResult(result: UpdateCheckResult | null): string {
  switch (result?.status) {
    case 'available': return `Officewrite ${result.version} is available.`;
    case 'up-to-date': return 'You have the latest available version.';
    case 'offline': return "You're offline. Connect to the internet to check for updates.";
    case 'rate-limited': return 'GitHub is receiving too many update checks. Please try again later.';
    case 'unavailable': return "Couldn't reach the update service or read its release information. Please try again later.";
    default: return 'Check for a newer Windows version.';
  }
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const host = isPlatformAvailable() ? getPlatform() : null;
  const canCheck = typeof host?.checkForUpdates === 'function';
  const [online, setOnline] = useState(() => navigator.onLine);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [linkError, setLinkError] = useState('');
  const active = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    active.current = true;
    const updateConnection = () => {
      setOnline(navigator.onLine);
      setResult(null);
      setLinkError('');
    };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      active.current = false;
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  async function checkForUpdates() {
    if (!host?.checkForUpdates || pending.current) return;
    setLinkError('');
    if (!navigator.onLine) {
      setOnline(false);
      setResult({ status: 'offline' });
      return;
    }
    pending.current = true;
    setChecking(true);
    setResult(null);
    try {
      const next = await host.checkForUpdates();
      if (active.current) setResult(next);
    } catch {
      if (active.current) setResult({ status: navigator.onLine ? 'unavailable' : 'offline' });
    } finally {
      pending.current = false;
      if (active.current) setChecking(false);
    }
  }

  async function openRelease() {
    if (!host || result?.status !== 'available') return;
    setLinkError('');
    try {
      const opened = await host.openExternal(result.releaseUrl);
      if (!opened && active.current) setLinkError("Couldn't open your browser. Please try again.");
    } catch {
      if (active.current) setLinkError("Couldn't open your browser. Please try again.");
    }
  }

  const status = !online
    ? describeResult({ status: 'offline' })
    : checking ? 'Checking for updates...' : describeResult(result);

  return (
    <Dialog title="About Officewrite" onClose={onClose} testId="about-dialog" closeLabel="Close" className="about-dialog">
      <div className="about-version-row">
        <span>Version {version}</span>
        {canCheck && (
          <button
            type="button"
            className="about-update-check"
            onClick={() => void checkForUpdates()}
            disabled={checking || !online}
            aria-label="Check for updates"
            title={!online ? 'Connect to the internet to check for updates' : checking ? 'Checking for updates...' : 'Check for updates'}
            data-testid="about-check-updates"
          >
            <RefreshCw size={16} aria-hidden="true" className={checking && online ? 'about-update-spinning' : undefined} />
          </button>
        )}
      </div>
      <p>A free, open-source word processor. Your documents stay on this machine. No account or telemetry.</p>
      <p>Licensed under MIT.</p>
      {canCheck && (
        <div className="about-updates">
          <p className="about-update-status" role="status" aria-live="polite" data-testid="about-update-status">{status}</p>
          {online && !checking && result?.status === 'available' && (
            <button type="button" className="about-release-link" onClick={() => void openRelease()} data-testid="about-view-release">
              View release and download
            </button>
          )}
          {linkError && <p role="status">{linkError}</p>}
          <p className="about-update-note">Only checks GitHub when you click the arrows. Nothing is downloaded or installed automatically.</p>
        </div>
      )}
    </Dialog>
  );
}
