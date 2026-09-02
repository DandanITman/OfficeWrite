import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  FilePlus,
  FolderOpen,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Star,
  Clock,
  Settings,
  Info,
  Moon,
  Sun,
  FileText,
  MoreHorizontal,
  Pin,
  PinOff,
  LayoutGrid,
  Search,
  ArrowRight,
  Maximize2,
} from 'lucide-react';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '@officewrite/core';
import type { RecentFile, AppSettings, Template } from '@officewrite/core';
import { appIconUrl } from '../utils/assets';
import { TemplatePreview } from './TemplatePreview';

type HomeTab = 'recent' | 'favorites';
type SidebarItem = 'home' | 'new' | 'open';

interface HomeScreenProps {
  recents: RecentFile[];
  settings: AppSettings;
  onNewFromTemplate: (templateId: string) => void;
  onOpenFile: () => void;
  onOpenRecent: (path: string) => void;
  onBrowseFolder: () => void;
  onTogglePin: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onGoToEditor: () => void;
}

/**
 * Thumbnails are drawn from the template's own content, so the only thing left
 * to choose is an accent. Colouring by category rather than by id means a new
 * template arrives already styled instead of silently falling back to blue.
 */
const CATEGORY_COLOR: Record<string, string> = {
  Basic: '#2563eb',
  Business: '#0891b2',
  'Resumes and Cover Letters': '#059669',
  Letters: '#7c3aed',
  Education: '#d97706',
  Flyers: '#db2777',
  Cards: '#e11d48',
  Holiday: '#c026d3',
  Personal: '#0d9488',
};

/**
 * The home rail is a shelf, not the catalogue: it holds the handful people
 * reach for most and sends everyone else to the gallery. Ordered deliberately,
 * because the rail scrolls horizontally and the tail rarely gets seen.
 */
const FEATURED_TEMPLATE_IDS = [
  'letter',
  'resume',
  'coverletter',
  'report',
  'invoice',
  'agenda',
  'essay',
  'todolist',
];

function colorFor(template: Template) {
  return CATEGORY_COLOR[template.category] ?? CATEGORY_COLOR.Basic;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Card for one template.
 *
 * Two controls, not one: the card creates the document, and the corner button
 * opens the full-page preview. A template gallery works the same way, and the split
 * matters here because the thumbnail can only ever be a hint - the preview is
 * where you read the template before committing to it.
 */
function TemplateCard({
  template,
  onPick,
  onPreview,
  showDescription = false,
}: {
  template: Template;
  onPick: () => void;
  onPreview: () => void;
  showDescription?: boolean;
}) {
  return (
    <div className="home-tpl-card-wrap">
      <button
        className="home-tpl-card"
        data-testid={`home-template-${template.id}`}
        onClick={onPick}
        title={template.description}
      >
        <div className="home-tpl-thumb" style={{ borderColor: colorFor(template) }}>
          <TemplatePreview template={template} />
        </div>
        <span>{template.name}</span>
        {showDescription && <small className="home-tpl-desc">{template.description}</small>}
      </button>
      <button
        className="home-tpl-zoom"
        title={`Preview ${template.name}`}
        aria-label={`Preview ${template.name}`}
        data-testid={`home-template-preview-${template.id}`}
        onClick={(event) => {
          // The zoom button sits inside the card's hover area, so the click must
          // not also reach the card and create the document.
          event.stopPropagation();
          onPreview();
        }}
      >
        <Maximize2 size={13} />
      </button>
    </div>
  );
}

/**
 * The preview dialog: the template at a size you can actually read, with the
 * Create button beside it. Escape and the backdrop both close it.
 */
function TemplatePreviewDialog({
  template,
  onCreate,
  onClose,
}: {
  template: Template;
  onCreate: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel-card template-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${template.name} preview`}
        data-testid="template-preview-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <h2>{template.name}</h2>
            <p className="muted">
              {template.category}: {template.description}
            </p>
          </div>
          <button
            className="dialog-close"
            aria-label="Close"
            data-testid="template-preview-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="template-preview-stage">
          <TemplatePreview template={template} variant="page" />
        </div>
        <div className="dialog-actions">
          <button className="icon-btn" onClick={onClose}>
            Close
          </button>
          <button className="icon-btn primary" data-testid="template-preview-create" onClick={onCreate}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomeScreen({
  recents,
  settings,
  onNewFromTemplate,
  onOpenFile,
  onOpenRecent,
  onBrowseFolder,
  onTogglePin,
  onRemoveRecent,
  onOpenSettings,
  onToggleTheme,
  onGoToEditor,
}: HomeScreenProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sidebarItem, setSidebarItem] = useState<SidebarItem>('home');
  const [tab, setTab] = useState<HomeTab>('recent');
  const [newExpanded, setNewExpanded] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const favorites = recents.filter((r) => r.pinned);
  const recentDocs = recents.filter((r) => !r.pinned);
  const displayed = tab === 'favorites' ? favorites : recentDocs;

  const featured = FEATURED_TEMPLATE_IDS.map((id) => TEMPLATES.find((t) => t.id === id)).filter(
    (t): t is Template => t !== undefined,
  );

  /**
   * One pass over name, description, category and keywords. Keywords exist for
   * the words people actually type - "CV" finds the resumes, "christmas" finds
   * the holiday templates - none of which appear in any template's name.
   */
  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return TEMPLATES.filter((template) => {
      if (template.id === 'blank') return false;
      if (category && template.category !== category) return false;
      if (terms.length === 0) return true;
      const haystack = [
        template.name,
        template.description,
        template.category,
        ...template.keywords,
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [query, category]);

  const handleSidebar = (item: SidebarItem) => {
    setSidebarItem(item);
    if (item === 'open') onOpenFile();
  };

  /** Opening the gallery from the rail should not inherit a stale filter. */
  const showGallery = (preset: string | null = null) => {
    setSidebarItem('new');
    setCategory(preset);
    setQuery('');
  };

  const previewTemplate = previewId ? (TEMPLATES.find((t) => t.id === previewId) ?? null) : null;

  return (
    <div className="home-backstage" data-testid="home-screen">
      {previewTemplate && (
        <TemplatePreviewDialog
          template={previewTemplate}
          onCreate={() => {
            setPreviewId(null);
            onNewFromTemplate(previewTemplate.id);
          }}
          onClose={() => setPreviewId(null)}
        />
      )}
      {aboutOpen && (
        <div className="backdrop" onClick={() => setAboutOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} data-testid="about-dialog">
            <h2>About Officewrite</h2>
            <p className="muted">
              A free, open-source word processor. Local-first: documents stay on this
              machine and the app makes no network requests.
            </p>
            <p className="muted">Licensed under MIT.</p>
            <div className="dialog-actions">
              <button className="btn-primary" onClick={() => setAboutOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className="home-sidebar">
        <button className="home-sidebar-back" onClick={onGoToEditor} title="Back to editor">
          <ChevronLeft size={20} />
        </button>

        <nav className="home-sidebar-nav">
          <button
            className={sidebarItem === 'home' ? 'active' : ''}
            onClick={() => { setSidebarItem('home'); }}
          >
            <Home size={18} /> Home
          </button>
          <button
            className={sidebarItem === 'new' ? 'active' : ''}
            onClick={() => showGallery()}
            data-testid="home-nav-new"
          >
            <FilePlus size={18} /> New
          </button>
          <button
            className={sidebarItem === 'open' ? 'active' : ''}
            onClick={() => handleSidebar('open')}
          >
            <FolderOpen size={18} /> Open
          </button>
        </nav>

        <div className="home-sidebar-divider" />

        <nav className="home-sidebar-nav secondary">
          <button onClick={onOpenSettings}>
            <Settings size={18} /> Settings
          </button>
          <button onClick={onToggleTheme}>
            {settings.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            {settings.theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
          <button onClick={() => setAboutOpen(true)} data-testid="home-about">
            <Info size={18} /> About
          </button>
        </nav>

        <div className="home-sidebar-brand">
          <img src={appIconUrl} alt="" width={20} height={20} />
          <span>Officewrite</span>
        </div>
      </aside>

      {sidebarItem === 'new' ? (
        <main className="home-main" data-testid="template-gallery">
          <header className="home-main-header">
            <div>
              <h1>New</h1>
              <p className="home-greeting">
                {TEMPLATES.length} templates, all editable. Nothing here is locked or paid for.
              </p>
            </div>
            <div className="home-header-actions">
              <button className="home-header-chip" onClick={() => setSidebarItem('home')}>
                <ChevronLeft size={14} /> Back to Home
              </button>
            </div>
          </header>

          <div className="home-template-rail-scroll">
            <div className="home-template-rail">
              <button
                className="home-tpl-card home-tpl-blank"
                onClick={() => onNewFromTemplate('blank')}
                data-testid="gallery-blank-template"
              >
                <div className="home-tpl-thumb blank">
                  <FilePlus size={32} strokeWidth={1.5} />
                </div>
                <span>Blank Document</span>
              </button>
            </div>
          </div>

          <div className="home-template-search">
            <Search size={16} />
            <input
              type="search"
              value={query}
              placeholder="Search templates"
              aria-label="Search templates"
              data-testid="template-search"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="home-template-filters">
            <span className="home-filter-label">Categories:</span>
            <button
              className={category === null ? 'home-filter-chip active' : 'home-filter-chip'}
              onClick={() => setCategory(null)}
            >
              All
            </button>
            {TEMPLATE_CATEGORIES.filter((name) => name !== 'Basic').map((name) => (
              <button
                key={name}
                className={category === name ? 'home-filter-chip active' : 'home-filter-chip'}
                onClick={() => setCategory(category === name ? null : name)}
              >
                {name}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <div className="home-empty-table">
              <FileText size={32} strokeWidth={1.25} />
              <p>
                Nothing matches “{query}”. Try a broader word, or start from a blank
                document and build what you need.
              </p>
              <button className="icon-btn primary" onClick={() => onNewFromTemplate('blank')}>
                New Document
              </button>
            </div>
          ) : (
            <div className="home-template-grid" data-testid="template-grid">
              {results.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  showDescription
                  onPick={() => onNewFromTemplate(template.id)}
                  onPreview={() => setPreviewId(template.id)}
                />
              ))}
            </div>
          )}
        </main>
      ) : (
      <main className="home-main">
        <header className="home-main-header">
          <div>
            <h1>Get Started</h1>
            <p className="home-greeting">
              A free alternative to Microsoft Word, LibreOffice and OpenOffice. A non-profit
              educational project, open source for anyone to edit.
            </p>
          </div>
          <div className="home-header-actions">
            <button className="home-header-chip" onClick={onBrowseFolder}>
              <LayoutGrid size={14} /> Browse folder
            </button>
          </div>
        </header>

        <section className="home-new-panel">
          <div className="home-panel-head">
            <button className="home-panel-toggle" onClick={() => setNewExpanded((v) => !v)}>
              {newExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span>New</span>
            </button>
            <button
              className="home-more-templates"
              onClick={() => showGallery()}
              data-testid="home-more-templates"
            >
              More templates <ArrowRight size={15} />
            </button>
          </div>
          {newExpanded && (
            <div className="home-template-rail-scroll">
              <div className="home-template-rail">
              <button className="home-tpl-card home-tpl-blank" onClick={() => onNewFromTemplate('blank')} data-testid="home-blank-template">
                <div className="home-tpl-thumb blank">
                  <FilePlus size={32} strokeWidth={1.5} />
                </div>
                <span>Blank Document</span>
              </button>
              {featured.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onPick={() => onNewFromTemplate(template.id)}
                  onPreview={() => setPreviewId(template.id)}
                />
              ))}
              </div>
            </div>
          )}
        </section>

        <section className="home-docs-panel">
          <div className="home-tabs">
            <button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')} data-testid="home-tab-recent">
              <Clock size={14} /> Recent
            </button>
            <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')} data-testid="home-tab-favorites">
              <Star size={14} /> Favorites
            </button>
          </div>

          {displayed.length === 0 ? (
            <div className="home-empty-table">
              <FileText size={32} strokeWidth={1.25} />
              <p>
                {tab === 'favorites'
                  ? 'Pin documents from Recent to see them here.'
                  : 'No recent documents yet. Create a new document or open a file.'}
              </p>
              <button className="icon-btn primary" onClick={() => onNewFromTemplate('blank')}>
                New Document
              </button>
            </div>
          ) : (
            <div className="home-doc-table-wrap">
              <table className="home-doc-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Date modified</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((file) => (
                    <tr key={file.path} className="home-doc-row" data-testid="home-recent-row">
                      <td>
                        <button className="home-doc-link" onClick={() => onOpenRecent(file.path)}>
                          <span className="home-doc-icon">
                            <FileText size={16} />
                          </span>
                          <span className="home-doc-text">
                            <strong>{file.name}</strong>
                            <small>{file.path}</small>
                          </span>
                        </button>
                      </td>
                      <td className="home-doc-date">{formatDate(file.lastOpened)}</td>
                      <td className="home-doc-actions">
                        <button
                          className="icon-btn ghost-muted"
                          onClick={() => onTogglePin(file.path)}
                          title={file.pinned ? 'Unpin' : 'Pin to favorites'}
                        >
                          {file.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                        </button>
                        <button
                          className="icon-btn ghost-muted"
                          onClick={() => onRemoveRecent(file.path)}
                          title="Remove from recent"
                          data-testid={`home-remove-recent-${file.name}`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
