import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { Editor } from '@tiptap/react';
import type { RibbonTab } from '@officewrite/core';
import { useRibbonState } from './useRibbonState';
import type { RibbonActions, RibbonFlags, RibbonTabProps } from './types';
import { HomeTab } from './tabs/HomeTab';
import { InsertTab } from './tabs/InsertTab';
import { DrawTab } from './tabs/DrawTab';
import { LayoutTab } from './tabs/LayoutTab';
import { ReferencesTab } from './tabs/ReferencesTab';
import { MailingsTab } from './tabs/MailingsTab';
import { ReviewTab } from './tabs/ReviewTab';
import { ViewTab } from './tabs/ViewTab';
import { HelpTab } from './tabs/HelpTab';
import { PictureFormatTab } from './tabs/PictureFormatTab';
import { TableLayoutTab } from './tabs/TableLayoutTab';
import { FileMenu } from '../components/FileMenu';
import {
  RibbonStripActions,
  type EditingMode,
  type RibbonLayout,
  type RibbonVisibility,
} from '../components/RibbonStripActions';

/**
 * Below this panel width the ribbon switches to its compact density. Home is
 * the widest tab at full density - about 1245px with its four Styles tiles -
 * so this sits just above that and 1280px still gets the full gallery.
 */
const COMPACT_BELOW = 1250;

const TABS: { id: RibbonTab; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'pageLayout', label: 'Layout' },
  { id: 'references', label: 'References' },
  { id: 'mailings', label: 'Mailings' },
  { id: 'review', label: 'Review' },
  { id: 'view', label: 'View' },
  { id: 'help', label: 'Help' },
];

/** Tabs that only appear while their object is selected, by convention. */
const CONTEXTUAL: { id: RibbonTab; label: string }[] = [
  { id: 'draw', label: 'Draw' },
  { id: 'pictureFormat', label: 'Picture Format' },
  { id: 'tableLayout', label: 'Table Layout' },
];

// 'file' is absent on purpose: it opens a dropdown, not a panel.
const PANELS: Record<Exclude<RibbonTab, 'file'>, (props: RibbonTabProps) => React.ReactElement> = {
  home: HomeTab,
  insert: InsertTab,
  pageLayout: LayoutTab,
  references: ReferencesTab,
  mailings: MailingsTab,
  review: ReviewTab,
  view: ViewTab,
  help: HelpTab,
  draw: DrawTab,
  pictureFormat: PictureFormatTab,
  tableLayout: TableLayoutTab,
};

export interface RibbonProps {
  activeTab: RibbonTab;
  onTabChange: (tab: RibbonTab) => void;
  editor: Editor | null;
  actions: RibbonActions;
  flags: RibbonFlags;
  /** Collapse the ribbon to just its tab strip, as Ctrl+F1 does in a word processor. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** File > Rename, Create a Copy and Delete need a document on disk. */
  hasFile: boolean;
  layout: RibbonLayout;
  onSetLayout: (layout: RibbonLayout) => void;
  visibility: RibbonVisibility;
  onSetVisibility: (visibility: RibbonVisibility) => void;
  editingMode: EditingMode;
  onSetEditingMode: (mode: EditingMode) => void;
  onToggleComments: () => void;
}

export function Ribbon({
  activeTab,
  onTabChange,
  editor,
  actions,
  flags,
  collapsed,
  onToggleCollapsed,
  hasFile,
  layout,
  onSetLayout,
  visibility,
  onSetVisibility,
  editingMode,
  onSetEditingMode,
  onToggleComments,
}: RibbonProps) {
  const [fileMenuAnchor, setFileMenuAnchor] = useState<HTMLElement | null>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  // Recomputed on every editor transaction, so control state follows the caret.
  const state = useRibbonState(editor);
  const previous = useRef({ image: false, table: false, ink: false });
  /** The tab to come back to when an object is deselected. */
  const returnTab = useRef<RibbonTab>('home');

  /**
   * The panel used to scroll sideways once the groups outgrew the window, so
   * below about 1280px the rightmost groups simply went behind a scrollbar -
   * A word processor never scrolls its ribbon. The window can be as narrow as 900px, so
   * the density steps down first and buys back the space instead.
   */
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [density, setDensity] = useState<'normal' | 'compact'>('normal');

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // A width threshold, not a scrollWidth measurement: compacting changes
    // what scrollWidth reports, so feeding it back in oscillates and then
    // latches - the ribbon sat compact at 1280px with 400px to spare.
    const measure = () => setDensity(panel.clientWidth < COMPACT_BELOW ? 'compact' : 'normal');

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [activeTab, collapsed]);

  /**
   * Follow the selection into the contextual tabs and back out again.
   *
   * A word processor only *activates* a contextual tab when you select an object - a
   * picture or a drawing canvas. Putting the caret in a table reveals Table
   * Layout but leaves the tab alone, because you are usually typing, and
   * yanking Bold and the font boxes away mid-sentence is hostile. Table Layout
   * is revealed here and left for the user to click.
   *
   * Leaving an object returns to the tab you came from. This used to hardcode
   * 'home', so editing from Insert or Review and clicking away dumped you
   * somewhere you had not been.
   */
  useEffect(() => {
    const wasImage = previous.current.image;
    const wasInk = previous.current.ink;
    previous.current = { image: state.imageActive, table: state.inTable, ink: state.inkActive };

    // Ink first: a drawing canvas is a block atom, so it can never be selected
    // at the same time as a picture or from inside a table.
    if (state.inkActive && !wasInk) {
      if (activeTab !== 'draw') returnTab.current = activeTab;
      onTabChange('draw');
      return;
    }
    if (state.imageActive && !wasImage) {
      if (activeTab !== 'pictureFormat') returnTab.current = activeTab;
      onTabChange('pictureFormat');
      return;
    }
  }, [state.imageActive, state.inkActive, activeTab, onTabChange]);

  const contextualVisible = {
    draw: state.inkActive,
    pictureFormat: state.imageActive,
    tableLayout: state.inTable,
  } as const;

  /**
   * Leave a contextual tab as soon as it stops being offered.
   *
   * Keyed on the tab's own visibility rather than on the selection flags: the
   * panel could otherwise be left rendering Table Layout after its button had
   * gone, with no active tab and no way back.
   */
  useEffect(() => {
    const active = CONTEXTUAL.find((tab) => tab.id === activeTab);
    if (!active || contextualVisible[active.id as keyof typeof contextualVisible]) return;

    const stored = returnTab.current;
    const storedContextual = CONTEXTUAL.some((tab) => tab.id === stored);
    const storedStillVisible =
      storedContextual && contextualVisible[stored as keyof typeof contextualVisible];
    onTabChange(storedContextual && !storedStillVisible ? 'home' : stored);
  }, [
    activeTab,
    contextualVisible.draw,
    contextualVisible.pictureFormat,
    contextualVisible.tableLayout,
    onTabChange,
  ]);

  /**
   * Arrow-key navigation across the tab strip, with a roving tab stop so Tab
   * enters the ribbon once rather than walking every tab.
   */
  const onTabStripKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const strip = event.currentTarget;
    const tabs = Array.from(strip.querySelectorAll<HTMLElement>('[role="tab"]'));
    if (!tabs.length) return;

    const current = tabs.findIndex((tab) => tab.getAttribute('data-tab') === activeTab);
    const index = current === -1 ? 0 : current;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;

    const target = tabs[next]?.getAttribute('data-tab') as RibbonTab | null;
    if (!target) return;
    event.preventDefault();
    if (collapsed) onToggleCollapsed();
    onTabChange(target);
    tabs[next].focus();
  };

  // Keep the document selection while a ribbon button is pressed.
  const preserveEditorFocus = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, select, textarea')) return;
    if (target.closest('button')) event.preventDefault();
  };

  // The File tab never becomes active, so fall back to whatever is showing.
  const Panel = PANELS[activeTab === 'file' ? 'home' : activeTab];
  const visibleContextual = CONTEXTUAL.filter(
    (tab) => contextualVisible[tab.id as keyof typeof contextualVisible],
  );

  return (
    <div
      className={`ribbon office-ribbon${collapsed ? ' is-collapsed' : ''}${
        layout === 'singleLine' ? ' is-single-line' : ''
      }`}
      data-testid="ribbon"
    >
      {/* A tablist owes arrow-key navigation and a single tab stop. Without
          them Tab stepped through all eight tabs one at a time and the arrow
          keys did nothing, which is not how anyone drives a ribbon. */}
      <div
        className="ribbon-tabs office-ribbon-tabs"
        role="tablist"
        aria-label="Ribbon"
        onKeyDown={onTabStripKeyDown}
      >
        {TABS.map((tab) =>
          tab.id === 'file' ? (
            <button
              key={tab.id}
              ref={setFileMenuAnchor}
              className={`ribbon-tab ${fileMenuOpen ? 'active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={fileMenuOpen}
              onClick={() => setFileMenuOpen((open) => !open)}
              data-tab={tab.id}
              data-testid={`ribbon-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ) : (
            <button
              key={tab.id}
              className={`ribbon-tab ${activeTab === tab.id ? 'active' : ''}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => {
                if (collapsed) onToggleCollapsed();
                onTabChange(tab.id);
              }}
              data-tab={tab.id}
              data-testid={`ribbon-tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ),
        )}
        {visibleContextual.map((tab) => (
          <button
            key={tab.id}
            className={`ribbon-tab is-contextual ${activeTab === tab.id ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => {
              // Clicking a contextual tab by hand - the only way to reach
              // Table Layout - must remember where to come back to, or
              // leaving the table strands the user on Home.
              if (!CONTEXTUAL.some((contextual) => contextual.id === activeTab)) {
                returnTab.current = activeTab;
              }
              onTabChange(tab.id);
            }}
            data-tab={tab.id}
            data-testid={`ribbon-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
        <RibbonStripActions
          unresolvedComments={flags.unresolvedComments}
          commentsOpen={flags.commentsOpen}
          onToggleComments={onToggleComments}
          editingMode={editingMode}
          onSetEditingMode={onSetEditingMode}
          layout={layout}
          onSetLayout={onSetLayout}
          visibility={visibility}
          onSetVisibility={onSetVisibility}
        />
      </div>
      {!collapsed && (
        <div
          ref={panelRef}
          className={`ribbon-panel office-ribbon-panel${density === 'compact' ? ' is-compact' : ''}`}
          role="tabpanel"
          onMouseDown={preserveEditorFocus}
        >
          <Panel editor={editor} state={state} actions={actions} flags={flags} />
        </div>
      )}
      <FileMenu
        anchor={fileMenuAnchor}
        open={fileMenuOpen}
        onClose={() => setFileMenuOpen(false)}
        actions={actions}
        hasFile={hasFile}
      />
    </div>
  );
}
