import {
  BookOpen,
  BookOpenCheck,
  FileStack,
  FileText,
  Globe,
  Grid3x3,
  Hash,
  ListTree,
  MoonStar,
  PanelLeft,
  PanelTop,
  Printer,
  Ruler,
  ScrollText,
  Search,
  Sun,
  Superscript,
  ZoomIn,
} from 'lucide-react';
import {
  RibbonButton,
  RibbonGroup,
  RibbonLine,
  RibbonMenuButton,
  RibbonMenuHeader,
  RibbonMenuItem,
  RibbonMenuSeparator,
  RibbonStack,
} from '../RibbonKit';
import type { RibbonTabProps, ViewMode } from '../types';

const VIEWS: Array<{ id: ViewMode; label: string; icon: typeof FileText; title: string }> = [
  { id: 'read', label: 'Read Mode', icon: BookOpen, title: 'Read the document without the editing chrome' },
  { id: 'print', label: 'Print Layout', icon: FileText, title: 'See the pages as they will print' },
  { id: 'web', label: 'Web Layout', icon: Globe, title: 'See the document as one continuous page' },
  { id: 'outline', label: 'Outline', icon: ListTree, title: 'Work with the heading structure' },
  { id: 'draft', label: 'Draft', icon: ScrollText, title: 'Plain text for fast editing' },
];

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

export function ViewTab({ actions, flags }: RibbonTabProps) {
  return (
    <>
      <RibbonGroup label="Views">
        <RibbonLine>
          {VIEWS.map((view) => (
            <RibbonButton
              key={view.id}
              icon={<view.icon size={20} />}
              label={view.label}
              title={view.title}
              size="large"
              active={flags.viewMode === view.id}
              onClick={() => actions.onSetViewMode(view.id)}
              testId={`view-mode-${view.id}`}
            />
          ))}
        </RibbonLine>
      </RibbonGroup>

      <RibbonGroup label="Immersive">
        <RibbonButton
          icon={<BookOpenCheck size={20} />}
          label="Immersive Reader"
          title="Read without the editing chrome, with reading comfort settings"
          size="large"
          active={flags.focusMode}
          onClick={actions.onToggleFocusMode}
          testId="view-immersive-reader"
        />
      </RibbonGroup>

      <RibbonGroup label="Show">
        <RibbonStack>
          <RibbonButton
            icon={<Ruler size={14} />}
            label="Ruler"
            title="Show the rulers"
            active={flags.showRuler}
            onClick={actions.onToggleRuler}
            testId="view-ruler"
          />
          <RibbonButton
            icon={<Grid3x3 size={14} />}
            label="Gridlines"
            title="Show a layout grid on the page"
            active={flags.showGridlines}
            onClick={actions.onToggleGridlines}
            testId="view-gridlines"
          />
          <RibbonButton
            icon={<PanelLeft size={14} />}
            label="Navigation Pane"
            title="Browse the document by heading"
            active={flags.navigationOpen}
            onClick={actions.onToggleNavigation}
            testId="view-navigation"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<PanelTop size={14} />}
            label="Header & Footer"
            title="Show the header and footer on the page"
            active={flags.showHeaderFooter}
            onClick={actions.onToggleShowHeaderFooter}
            testId="view-header-footer"
          />
          <RibbonButton
            icon={<Superscript size={14} />}
            label="Footnotes"
            title="Show the footnotes area"
            active={flags.showFootnotes}
            onClick={actions.onToggleShowFootnotes}
            testId="view-footnotes"
          />
          <RibbonButton
            icon={<FileStack size={14} />}
            label="Endnotes"
            title="Show the endnotes area"
            active={flags.showEndnotes}
            onClick={actions.onToggleShowEndnotes}
            testId="view-endnotes"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Dark Mode">
        <RibbonButton
          icon={flags.theme === 'dark' ? <Sun size={20} /> : <MoonStar size={20} />}
          label="Dark Mode"
          title={flags.theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          size="large"
          active={flags.theme === 'dark'}
          onClick={actions.onToggleTheme}
          testId="view-dark-mode"
        />
      </RibbonGroup>

      <RibbonGroup label="Zoom">
        <RibbonStack>
          <RibbonMenuButton
            icon={<ZoomIn size={20} />}
            label="Zoom"
            title="Zoom"
            size="large"
            testId="view-zoom"
          >
            <RibbonMenuHeader label="Zoom to" />
            {ZOOM_LEVELS.map((level) => (
              <RibbonMenuItem
                key={level}
                label={`${level}%`}
                checked={flags.zoom === level}
                onClick={() => actions.onSetZoom(level)}
              />
            ))}
            <RibbonMenuSeparator />
            <RibbonMenuItem label="Custom…" onClick={actions.onOpenZoomDialog} />
          </RibbonMenuButton>
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            label="100%"
            title="Zoom to 100%"
            active={flags.zoom === 100}
            onClick={() => actions.onSetZoom(100)}
            testId="view-zoom-100"
          />
          <RibbonButton
            label="One Page"
            title="Fit a whole page on screen"
            onClick={() => actions.onZoomToFit('onePage')}
            testId="view-zoom-one-page"
          />
          {/* Multiple Pages was built and wired into the Zoom dialog, but had
              no button here - the Zoom group carries it between One Page
              and Page Width. */}
          <RibbonButton
            label="Multiple Pages"
            title="Fit several pages on screen"
            onClick={() => actions.onZoomToFit('multiplePages')}
            testId="view-zoom-multiple-pages"
          />
          <RibbonButton
            label="Page Width"
            title="Fit the page width to the window"
            onClick={() => actions.onZoomToFit('pageWidth')}
            testId="view-zoom-page-width"
          />
        </RibbonStack>
      </RibbonGroup>

      {/* The View > Window is New Window / Split / Side by Side, none of
          which exist in a single-window app. These are shortcuts, so the group
          is named for what it holds rather than borrowing the label. */}
      <RibbonGroup label="Tools">
        <RibbonStack>
          <RibbonButton
            icon={<Search size={14} />}
            label="Find"
            title="Find (Ctrl+F)"
            onClick={() => actions.onToggleFindReplace('find')}
            testId="view-find"
          />
          <RibbonButton
            icon={<Printer size={14} />}
            label="Print"
            title="Print the document (Ctrl+P)"
            onClick={actions.onPrint}
            testId="view-print"
          />
          <RibbonButton
            icon={<Hash size={14} />}
            label="Word Count"
            title="Word count"
            onClick={actions.onOpenWordCount}
            testId="view-word-count"
          />
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
