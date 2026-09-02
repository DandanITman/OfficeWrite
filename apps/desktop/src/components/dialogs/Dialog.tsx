import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * The shell every dialog in the app shares.
 *
 * It lives here rather than beside the format dialogs because the Help dialogs
 * need it too: they used to roll their own markup and so missed the close
 * button, the Escape key and the pinned action row, which left What's New
 * scrolling its own title out of view.
 */
export function Dialog({
  title,
  onClose,
  children,
  testId,
  wide,
  closeLabel = 'Done',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  testId: string;
  wide?: boolean;
  closeLabel?: string;
}) {
  // Escape closes, as it does in every dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className={`dialog panel-card${wide ? ' dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close"
            title="Close"
            data-testid={`${testId}-close`}
            onClick={onClose}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        {/* Only the body scrolls, so the title and the action row stay put. */}
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
