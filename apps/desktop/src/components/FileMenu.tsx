import {
  ChevronRight,
  Copy,
  FileDown,
  FilePlus,
  FolderOpen,
  History,
  Info,
  Pencil,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';
import { RibbonPopover } from '../ribbon/RibbonKit';
import type { RibbonActions } from '../ribbon/types';

export interface FileMenuProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  actions: RibbonActions;
  /** Rename, Create a Copy and Delete all need a file on disk to act on. */
  hasFile: boolean;
}

interface ItemProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  /** Draws the submenu chevron: this one opens the Backstage instead of acting. */
  opensPanel?: boolean;
  disabled?: boolean;
  danger?: boolean;
  testId: string;
  onClick: () => void;
}

function FileMenuItem({ icon, label, hint, opensPanel, disabled, danger, testId, onClick }: ItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`file-menu-item${danger ? ' is-danger' : ''}`}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
    >
      <span className="file-menu-icon">{icon}</span>
      <span className="file-menu-label">{label}</span>
      {hint && <span className="file-menu-hint">{hint}</span>}
      {opensPanel && <ChevronRight size={14} className="file-menu-chevron" />}
    </button>
  );
}

/**
 * File as a dropdown under the tab rather than a
 * full-screen panel.
 *
 * The lightweight commands act immediately; the ones that need a screen of
 * their own (Open, Export, Info) still open the Backstage, which is where
 * recents, templates, export formats and document properties already live.
 */
export function FileMenu({ anchor, open, onClose, actions, hasFile }: FileMenuProps) {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <RibbonPopover
      anchor={anchor}
      open={open}
      onClose={onClose}
      label="File"
      width={280}
      testId="file-menu"
    >
      <FileMenuItem
        icon={<FilePlus size={16} />}
        label="New"
        opensPanel
        testId="file-menu-new"
        onClick={run(actions.onOpenNewBackstage)}
      />
      <FileMenuItem
        icon={<FolderOpen size={16} />}
        label="Open"
        opensPanel
        testId="file-menu-open"
        onClick={run(actions.onOpenBackstageOpen)}
      />
      <div className="file-menu-separator" />
      <FileMenuItem
        icon={<Save size={16} />}
        label="Save"
        hint="Ctrl+S"
        testId="file-menu-save"
        onClick={run(actions.onSave)}
      />
      <FileMenuItem
        icon={<Save size={16} />}
        label="Save As"
        hint="F12"
        testId="file-menu-save-as"
        onClick={run(actions.onSaveAs)}
      />
      <FileMenuItem
        icon={<Copy size={16} />}
        label="Create a Copy"
        disabled={!hasFile}
        testId="file-menu-copy"
        onClick={run(actions.onCreateCopy)}
      />
      <FileMenuItem
        icon={<FileDown size={16} />}
        label="Export"
        opensPanel
        testId="file-menu-export"
        onClick={run(actions.onOpenBackstage)}
      />
      <FileMenuItem
        icon={<Printer size={16} />}
        label="Print"
        hint="Ctrl+P"
        testId="file-menu-print"
        onClick={run(actions.onPrint)}
      />
      <div className="file-menu-separator" />
      <FileMenuItem
        icon={<Pencil size={16} />}
        label="Rename"
        disabled={!hasFile}
        testId="file-menu-rename"
        onClick={run(actions.onRenameFile)}
      />
      <FileMenuItem
        icon={<History size={16} />}
        label="Version History"
        opensPanel
        disabled={!hasFile}
        testId="file-menu-history"
        onClick={run(actions.onOpenVersionHistory)}
      />
      <FileMenuItem
        icon={<Trash2 size={16} />}
        label="Delete"
        danger
        disabled={!hasFile}
        testId="file-menu-delete"
        onClick={run(actions.onDeleteFile)}
      />
      <div className="file-menu-separator" />
      <FileMenuItem
        icon={<Info size={16} />}
        label="Info"
        opensPanel
        testId="file-menu-info"
        onClick={run(actions.onOpenInfo)}
      />
    </RibbonPopover>
  );
}
