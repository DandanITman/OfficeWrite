import { Save, Undo2, Redo2, Grid3x3, Search, Settings } from 'lucide-react';
import { appIconUrl } from '../utils/assets';

interface EditorTitleBarProps {
  fileName: string;
  isDirty: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onHome: () => void;
  onRename: () => void;
  /** Rename only makes sense once the document exists on disk. */
  canRename: boolean;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

/**
 * The header: app launcher, product mark, document
 * name, then the command search box in the middle.
 *
 * Two deliberate departures from the mockup. There is no account picture,
 * because Officewrite has no account - and no cloud-save tick, because it saves to
 * disk. The quick-access buttons stay, for the same reason: nothing here
 * autosaves to a server, so Save has to be reachable without opening a menu.
 */
export function EditorTitleBar({
  fileName,
  isDirty,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onHome,
  onRename,
  canRename,
  onOpenSearch,
  onOpenSettings,
}: EditorTitleBarProps) {
  return (
    <div className="editor-titlebar" data-testid="editor-titlebar">
      <div className="editor-titlebar-qat">
        {/* A suite would open an app launcher here. There is nothing to
            launch here, so it goes to the Officewrite home screen instead. */}
        <button className="qat-btn qat-menu" onClick={onHome} title="Home screen">
          <Grid3x3 size={18} />
        </button>
        <img className="editor-titlebar-icon" src={appIconUrl} alt="" width={22} height={22} />
        <span className="editor-titlebar-product">Officewrite</span>

        <button
          className="editor-titlebar-name"
          onClick={canRename ? onRename : undefined}
          disabled={!canRename}
          title={canRename ? 'Rename this document' : 'Save the document to rename it'}
          data-testid="editor-filename"
        >
          {fileName}
          {isDirty ? ' *' : ''}
        </button>
      </div>

      <div className="editor-titlebar-doc">
        <button
          className="titlebar-search"
          onClick={onOpenSearch}
          title="Search for tools, help, and more (Alt+Q)"
          data-testid="titlebar-search"
        >
          <Search size={15} />
          <span>Search for tools, help, and more (Alt + Q)</span>
        </button>
      </div>

      <div className="editor-titlebar-right">
        <button className="qat-btn" onClick={onSave} title="Save (Ctrl+S)" data-testid="titlebar-save">
          <Save size={16} />
        </button>
        <button
          className="qat-btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          data-testid="ribbon-undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="qat-btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          data-testid="ribbon-redo"
        >
          <Redo2 size={16} />
        </button>
        <button
          className="qat-btn"
          onClick={onOpenSettings}
          title="Settings"
          data-testid="titlebar-settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
