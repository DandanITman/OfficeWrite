import { useRef, useState } from 'react';
import { ChevronDown, Eye, MessageSquare, Pencil, GitCompare } from 'lucide-react';
import { RibbonPopover, RibbonMenuHeader, RibbonMenuItem, RibbonMenuSeparator } from '../ribbon/RibbonKit';

/**
 * a browser-based editor's editing modes, mapped onto what Officewrite already has.
 *
 * Editing is the normal state. Reviewing turns track changes on so edits are
 * recorded rather than applied silently. Viewing sets the document read-only,
 * which is the same switch Review > Restrict Editing uses.
 */
export type EditingMode = 'editing' | 'reviewing' | 'viewing';

export type RibbonLayout = 'classic' | 'singleLine';
export type RibbonVisibility = 'alwaysShow' | 'tabsOnly' | 'auto';

export interface RibbonStripActionsProps {
  unresolvedComments: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
  editingMode: EditingMode;
  onSetEditingMode: (mode: EditingMode) => void;
  layout: RibbonLayout;
  onSetLayout: (layout: RibbonLayout) => void;
  visibility: RibbonVisibility;
  onSetVisibility: (visibility: RibbonVisibility) => void;
}

const MODE_LABEL: Record<EditingMode, string> = {
  editing: 'Editing',
  reviewing: 'Reviewing',
  viewing: 'Viewing',
};

const MODE_ICON = {
  editing: Pencil,
  reviewing: GitCompare,
  viewing: Eye,
} as const;

/** The right-hand end of the tab strip: Comments, the mode picker, and layout. */
export function RibbonStripActions({
  unresolvedComments,
  commentsOpen,
  onToggleComments,
  editingMode,
  onSetEditingMode,
  layout,
  onSetLayout,
  visibility,
  onSetVisibility,
}: RibbonStripActionsProps) {
  const modeAnchor = useRef<HTMLButtonElement>(null);
  const layoutAnchor = useRef<HTMLButtonElement>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  const ModeIcon = MODE_ICON[editingMode];

  return (
    <div className="ribbon-strip-actions">
      <button
        className={`strip-action${commentsOpen ? ' is-active' : ''}`}
        onClick={onToggleComments}
        title="Show the comments pane"
        data-testid="strip-comments"
      >
        <MessageSquare size={15} />
        <span>Comments</span>
        {unresolvedComments > 0 && (
          <span className="strip-badge" data-testid="strip-comment-count">
            {unresolvedComments}
          </span>
        )}
      </button>

      <button
        ref={modeAnchor}
        className="strip-action"
        aria-haspopup="menu"
        aria-expanded={modeOpen}
        onClick={() => setModeOpen((open) => !open)}
        title="Choose how you are working on this document"
        data-testid="strip-editing-mode"
      >
        <ModeIcon size={15} />
        <span>{MODE_LABEL[editingMode]}</span>
        <ChevronDown size={13} />
      </button>
      <RibbonPopover
        anchor={modeAnchor.current}
        open={modeOpen}
        onClose={() => setModeOpen(false)}
        label="Editing mode"
        width={260}
        testId="editing-mode-menu"
      >
        <RibbonMenuItem
          label="Editing"
          hint="Make changes directly"
          checked={editingMode === 'editing'}
          onClick={() => onSetEditingMode('editing')}
          testId="editing-mode-editing"
        />
        <RibbonMenuItem
          label="Reviewing"
          hint="Record every change as a tracked change"
          checked={editingMode === 'reviewing'}
          onClick={() => onSetEditingMode('reviewing')}
          testId="editing-mode-reviewing"
        />
        <RibbonMenuItem
          label="Viewing"
          hint="Read without being able to edit"
          checked={editingMode === 'viewing'}
          onClick={() => onSetEditingMode('viewing')}
          testId="editing-mode-viewing"
        />
      </RibbonPopover>

      <button
        ref={layoutAnchor}
        className="ribbon-collapse"
        aria-haspopup="menu"
        aria-expanded={layoutOpen}
        onClick={() => setLayoutOpen((open) => !open)}
        title="Ribbon display options"
        aria-label="Ribbon display options"
        data-testid="ribbon-collapse"
      >
        <ChevronDown size={14} />
      </button>
      <RibbonPopover
        anchor={layoutAnchor.current}
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
        label="Ribbon layout"
        width={250}
        testId="ribbon-layout-menu"
      >
        <RibbonMenuHeader label="Ribbon Layout" />
        <RibbonMenuItem
          label="Classic Ribbon"
          checked={layout === 'classic'}
          onClick={() => onSetLayout('classic')}
          testId="ribbon-layout-classic"
        />
        <RibbonMenuItem
          label="Single Line Ribbon"
          checked={layout === 'singleLine'}
          onClick={() => onSetLayout('singleLine')}
          testId="ribbon-layout-single"
        />
        <RibbonMenuSeparator />
        <RibbonMenuHeader label="Show Ribbon" />
        <RibbonMenuItem
          label="Always show ribbon"
          checked={visibility === 'alwaysShow'}
          onClick={() => onSetVisibility('alwaysShow')}
          testId="ribbon-show-always"
        />
        <RibbonMenuItem
          label="Show tabs only"
          checked={visibility === 'tabsOnly'}
          onClick={() => onSetVisibility('tabsOnly')}
          testId="ribbon-show-tabs-only"
        />
        <RibbonMenuItem
          label="Adjust automatically"
          hint="Open the ribbon on a click, then collapse it again"
          checked={visibility === 'auto'}
          onClick={() => onSetVisibility('auto')}
          testId="ribbon-show-auto"
        />
      </RibbonPopover>
    </div>
  );
}
