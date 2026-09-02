import {
  BookOpen,
  FileText,
  Globe,
  ListTree,
  Lock,
  ScrollText,
  SpellCheck,
} from 'lucide-react';
import type { ViewMode } from '../ribbon/types';
import { languageShortLabel } from '../constants/languages';

interface StatusBarProps {
  words: number;
  pages: number;
  currentPage?: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  language: string;
  trackChangesEnabled?: boolean;
  /** Pending tracked changes in the document, shown next to the mode flag. */
  pendingChanges?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  /** Spelling and grammar problems the checker reports. */
  proofingIssues?: number;
  spellCheckEnabled?: boolean;
  readOnly?: boolean;
  onOpenProofing?: () => void;
  onOpenWordCount?: () => void;
  onOpenGoTo?: () => void;
  onZoomToFit?: (fit: 'pageWidth' | 'onePage' | 'multiplePages') => void;
}

const VIEW_BUTTONS: Array<{ id: ViewMode; label: string; icon: typeof FileText }> = [
  { id: 'read', label: 'Read Mode', icon: BookOpen },
  { id: 'print', label: 'Print Layout', icon: FileText },
  { id: 'web', label: 'Web Layout', icon: Globe },
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'draft', label: 'Draft', icon: ScrollText },
];

export function StatusBar({
  words,
  pages,
  currentPage = 1,
  zoom,
  onZoomChange,
  language,
  trackChangesEnabled,
  pendingChanges = 0,
  viewMode = 'print',
  onViewModeChange,
  proofingIssues = 0,
  spellCheckEnabled = true,
  readOnly = false,
  onOpenProofing,
  onOpenWordCount,
  onOpenGoTo,
  onZoomToFit,
}: StatusBarProps) {

  return (
    <div className="status-bar office-status" data-testid="status-bar">
      <div className="status-bar-left">
        {/* Clicking the page count opens Go To - the
            word count beside it was already a button. */}
        <button
          className="status-flat-btn status-page-indicator"
          onClick={onOpenGoTo}
          title="Go to page (Ctrl+G)"
          data-testid="status-page-indicator"
        >
          Page {currentPage} of {pages}
        </button>
        <span className="status-divider" />
        <button
          className="status-flat-btn"
          onClick={onOpenWordCount}
          title="Word count and readability"
          data-testid="status-word-count"
        >
          {words.toLocaleString()} words
        </button>
        <span className="status-divider" />
        <span data-testid="status-language">{languageShortLabel(language)}</span>
        <span className="status-divider" />
        {/* The proofing indicator. Named "Spelling" rather than "Editor":
            this is a Hunspell checker, and calling it Editor implied more. */}
        <button
          className={`status-flat-btn status-proofing${proofingIssues > 0 ? ' has-issues' : ''}`}
          onClick={onOpenProofing}
          title={
            !spellCheckEnabled
              ? 'Proofing is turned off'
              : proofingIssues > 0
                ? `${proofingIssues} spelling or grammar ${proofingIssues === 1 ? 'problem' : 'problems'}, click to review`
                : 'No proofing errors'
          }
          data-testid="status-proofing"
        >
          <SpellCheck size={13} />
          {!spellCheckEnabled
            ? 'Spelling: Off'
            : proofingIssues > 0
              ? `Spelling: ${proofingIssues}`
              : 'Spelling: On'}
        </button>
        {trackChangesEnabled && (
          <>
            <span className="status-divider" />
            <span className="status-track">Track Changes</span>
          </>
        )}
        {/* Pending changes outlive the mode: turning tracking off does not
            resolve them, so the count shows either way. */}
        {pendingChanges > 0 && (
          <>
            <span className="status-divider" />
            <span className="status-track" data-testid="status-pending-changes">
              {pendingChanges} pending {pendingChanges === 1 ? 'change' : 'changes'}
            </span>
          </>
        )}
        {readOnly && (
          <>
            <span className="status-divider" />
            <span className="status-track" data-testid="status-read-only">
              <Lock size={12} /> Read-only
            </span>
          </>
        )}
      </div>
      <div className="status-bar-right">
        <div className="status-view-modes">
          {VIEW_BUTTONS.map((button) => (
            <button
              key={button.id}
              className={viewMode === button.id ? 'active' : ''}
              onClick={() => onViewModeChange?.(button.id)}
              title={button.label}
              aria-label={button.label}
            >
              <button.icon size={14} />
            </button>
          ))}
        </div>
        <button
          className="status-zoom-btn"
          onClick={() => onZoomChange(Math.max(10, zoom - 10))}
          title="Zoom out"
        >
          -
        </button>
        <input
          type="range"
          className="status-zoom-slider"
          min={10}
          max={500}
          step={5}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => onZoomChange(Number(e.target.value))}
        />
        <button
          className="status-zoom-btn"
          onClick={() => onZoomChange(Math.min(500, zoom + 10))}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="status-flat-btn status-zoom-pct"
          data-testid="status-zoom-pct"
          onClick={() => onZoomChange(100)}
          title="Reset the zoom to 100%"
        >
          {zoom}%
        </button>
        <button
          className="status-flat-btn status-zoom-fit"
          data-testid="status-zoom-fit"
          onClick={() => onZoomToFit?.('pageWidth')}
          title="Fit the page width to the window"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
