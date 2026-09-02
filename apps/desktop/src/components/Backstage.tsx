import { useEffect, useState } from 'react';
import type { AppSettings, DocumentMetadata, DocumentRevision, RecentFile } from '@officewrite/core';
import { DEFAULT_SETTINGS, TEMPLATES, TEMPLATE_CATEGORIES } from '@officewrite/core';
import { TemplatePreview } from './TemplatePreview';
import { RevisionHistoryPanel } from './RevisionHistoryPanel';
import { PROOFING_LANGUAGES } from '../constants/languages';

type BackstageSection = 'info' | 'new' | 'open' | 'save' | 'export' | 'print' | 'options' | 'history';

interface BackstageProps {
  section: BackstageSection;
  onSectionChange: (section: BackstageSection) => void;
  onClose: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportDocx: () => void;
  onExportOfficewrite: () => void;
  onExportPdf: () => void;
  onPrint: (options?: { copies?: number; pageRange?: string }) => void;
  /** Renders the paginated document for the Print pane's preview. */
  onBuildPreview?: () => Promise<Uint8Array | null>;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  fileName: string;
  filePath: string | null;
  revisions: DocumentRevision[];
  onRestoreRevision: (id: string) => void;
  metadata: DocumentMetadata;
  onMetadataChange: (metadata: DocumentMetadata) => void;
  onExportRtf: () => void;
  onExportHtml: () => void;
  /** New and Open show templates and recents. */
  onNewFromTemplate: (id: string) => void;
  recents: RecentFile[];
  onOpenRecent: (path: string) => void;
}

const NAV: { id: BackstageSection; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'new', label: 'New' },
  { id: 'open', label: 'Open' },
  { id: 'save', label: 'Save / Save As' },
  { id: 'export', label: 'Export' },
  { id: 'print', label: 'Print' },
  { id: 'history', label: 'Version History' },
  { id: 'options', label: 'Options' },
];

const EXPORT_FORMATS = [
  { label: 'DOCX', desc: 'Default, the standard .docx format', action: 'docx' as const },
  { label: '.officewrite', desc: 'Officewrite native format with version history', action: 'officewrite' as const },
  { label: 'RTF', desc: 'Rich Text Format', action: 'rtf' as const },
  { label: 'HTML', desc: 'Web page with styling', action: 'html' as const },
  { label: 'PDF', desc: 'Print to PDF', action: 'pdf' as const },
];

export function Backstage({
  section,
  onSectionChange,
  onClose,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportDocx,
  onExportOfficewrite,
  onExportPdf,
  onPrint,
  settings,
  onSettingsChange,
  fileName,
  filePath,
  revisions,
  onRestoreRevision,
  metadata,
  onMetadataChange,
  onExportRtf,
  onExportHtml,
  onNewFromTemplate,
  recents,
  onOpenRecent,
  onBuildPreview,
}: BackstageProps) {
  const [copies, setCopies] = useState(1);
  const [pageRange, setPageRange] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /**
   * The preview is the same PDF the exporter produces, so what it shows is
   * exactly what prints. Built only while the Print pane is open, and revoked
   * on the way out - a blob URL per visit would otherwise leak.
   */
  useEffect(() => {
    if (section !== 'print' || !onBuildPreview) return;
    let url: string | null = null;
    let cancelled = false;

    setPreviewError(null);
    setPreviewUrl(null);
    void (async () => {
      try {
        const bytes = await onBuildPreview();
        if (cancelled) return;
        if (!bytes?.byteLength) {
          setPreviewError('No preview available for this document.');
          return;
        }
        // Copy into a fresh ArrayBuffer: Uint8Array's buffer may be shared.
        url = URL.createObjectURL(new Blob([new Uint8Array(bytes).slice().buffer], { type: 'application/pdf' }));
        setPreviewUrl(url);
      } catch {
        if (!cancelled) setPreviewError('Could not build a preview.');
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [section, onBuildPreview]);

  const exportHandlers = {
    docx: onExportDocx,
    officewrite: onExportOfficewrite,
    rtf: onExportRtf,
    html: onExportHtml,
    pdf: onExportPdf,
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="backstage" onClick={(e) => e.stopPropagation()} data-testid="backstage">
        <nav className="backstage-nav">
          <div className="backstage-nav-header">File</div>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              data-testid={`backstage-nav-${item.id}`}
              onClick={() => onSectionChange(item.id)}
            >
              {item.label}
            </button>
          ))}
          <div className="backstage-nav-back">
            <button className="icon-btn ghost-muted" onClick={onClose}>
              ← Back to document
            </button>
          </div>
        </nav>
        <div className="backstage-content">
          {section === 'info' && (
            <>
              <h2>Document Properties</h2>
              <p className="backstage-subtitle">Edit metadata stored with your document.</p>
              <div className="dialog-grid">
                <label>
                  Title
                  <input
                    value={metadata.title}
                    onChange={(e) => onMetadataChange({ ...metadata, title: e.target.value })}
                  />
                </label>
                <label>
                  Author
                  <input
                    value={metadata.author}
                    onChange={(e) => onMetadataChange({ ...metadata, author: e.target.value })}
                  />
                </label>
                <label>
                  Subject
                  <input
                    value={metadata.subject ?? ''}
                    onChange={(e) => onMetadataChange({ ...metadata, subject: e.target.value })}
                  />
                </label>
                <label>
                  Keywords
                  <input
                    value={metadata.keywords ?? ''}
                    onChange={(e) => onMetadataChange({ ...metadata, keywords: e.target.value })}
                  />
                </label>
                <label>
                  Company
                  <input
                    value={metadata.company ?? ''}
                    onChange={(e) => onMetadataChange({ ...metadata, company: e.target.value })}
                  />
                </label>
              </div>
              <div className="meta-grid">
                <div className="meta-card">
                  <div className="meta-card-label">File name</div>
                  <div className="meta-card-value">{fileName}</div>
                </div>
                <div className="meta-card">
                  <div className="meta-card-label">Location</div>
                  <div className="meta-card-value">{filePath ?? 'Not saved yet'}</div>
                </div>
                <div className="meta-card">
                  <div className="meta-card-label">Created</div>
                  <div className="meta-card-value">{new Date(metadata.created).toLocaleString()}</div>
                </div>
                <div className="meta-card">
                  <div className="meta-card-label">Modified</div>
                  <div className="meta-card-value">{new Date(metadata.modified).toLocaleString()}</div>
                </div>
              </div>
            </>
          )}
          {/* New and Open used to be one button each. The templates and the
              recent list existed only on the start screen, so once a document
              was open they were unreachable - the backstage should carry both. */}
          {section === 'new' && (
            <>
              <h2>New</h2>
              <p className="backstage-subtitle">Start from a blank page or a template.</p>
              <div className="backstage-template-grid">
                <button
                  className="backstage-tpl-card"
                  onClick={onNew}
                  data-testid="backstage-template-blank"
                >
                  <span className="backstage-tpl-thumb">Aa</span>
                  <span>Blank Document</span>
                </button>
              </div>
              {/* Grouped rather than one flat wall of cards: the catalogue is
                  long enough now that a heading is the only way to find the
                  letter templates without reading all of them. */}
              {TEMPLATE_CATEGORIES.filter((category) => category !== 'Basic').map((category) => {
                const inCategory = TEMPLATES.filter(
                  (template) => template.category === category && template.id !== 'blank',
                );
                if (inCategory.length === 0) return null;
                return (
                  <div key={category}>
                    <h3 className="backstage-subhead">{category}</h3>
                    <div className="backstage-template-grid">
                      {inCategory.map((template) => (
                        <button
                          key={template.id}
                          className="backstage-tpl-card"
                          onClick={() => onNewFromTemplate(template.id)}
                          data-testid={`backstage-template-${template.id}`}
                          title={template.description}
                        >
                          <span className="backstage-tpl-thumb">
                            <TemplatePreview template={template} />
                          </span>
                          <span>{template.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {section === 'open' && (
            <>
              <h2>Open</h2>
              <p className="backstage-subtitle">Pick up where you left off, or browse.</p>
              <button className="icon-btn primary" onClick={onOpen}>
                Browse for file…
              </button>
              <h3 className="backstage-subhead">Recent</h3>
              {recents.length === 0 ? (
                <p className="backstage-subtitle">No recent documents yet.</p>
              ) : (
                <ul className="backstage-recents" data-testid="backstage-recents">
                  {recents.slice(0, 12).map((recent) => (
                    <li key={recent.path}>
                      <button
                        className="backstage-recent"
                        onClick={() => onOpenRecent(recent.path)}
                        title={recent.path}
                      >
                        <span className="backstage-recent-name">{recent.name}</span>
                        <span className="backstage-recent-path">{recent.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {section === 'save' && (
            <>
              <h2>Save</h2>
              <p className="backstage-subtitle">
                Documents save as DOCX by default, so they open in Microsoft Word, LibreOffice and
            OpenOffice.
              </p>
              <div className="action-row">
                <button className="icon-btn primary" onClick={onSave}>
                  Save
                </button>
                <button className="icon-btn" onClick={onSaveAs}>
                  Save As…
                </button>
              </div>
            </>
          )}
          {section === 'export' && (
            <>
              <h2>Export</h2>
              <p className="backstage-subtitle">
                Save a copy in another format. Try the native .officewrite format for version history and
                full Officewrite features.
              </p>
              <div className="export-grid">
                {EXPORT_FORMATS.map((fmt) => (
                  <button
                    key={fmt.action}
                    className="export-card"
                    data-testid={`export-${fmt.action}`}
                    onClick={exportHandlers[fmt.action]}
                  >
                    <span className="export-card-title">{fmt.label}</span>
                    <span className="export-card-desc">{fmt.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {/* The Print backstage is settings beside a live paginated
              preview. This was a heading and one button - and because the
              editor scrolls continuously rather than reflowing pages on
              screen, it was the only place a user could ever have seen where
              the pages actually break, so they could not. */}
          {section === 'print' && (
            <>
              <h2>Print</h2>
              <p className="backstage-subtitle">
                Check the page breaks before sending the document to your printer.
              </p>
              <div className="print-pane">
                <div className="print-settings">
                  <label>
                    Copies
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={copies}
                      onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
                      data-testid="print-copies"
                    />
                  </label>
                  <label>
                    Pages
                    <input
                      type="text"
                      placeholder="All"
                      value={pageRange}
                      onChange={(event) => setPageRange(event.target.value)}
                      data-testid="print-range"
                    />
                  </label>
                  <p className="print-hint">e.g. 1-3, 5. Leave blank for every page.</p>
                  <button
                    className="icon-btn primary"
                    onClick={() => onPrint({ copies, pageRange: pageRange.trim() || undefined })}
                    data-testid="print-confirm"
                  >
                    Print
                  </button>
                </div>
                <div className="print-preview" data-testid="print-preview">
                  {previewError ? (
                    <p className="muted">{previewError}</p>
                  ) : previewUrl ? (
                    <iframe title="Print preview" src={previewUrl} />
                  ) : (
                    <p className="muted">Building preview…</p>
                  )}
                </div>
              </div>
            </>
          )}
          {section === 'history' && (
            <RevisionHistoryPanel
              revisions={revisions}
              onRestore={onRestoreRevision}
              onClose={onClose}
            />
          )}
          {section === 'options' && (
            <>
              <h2>Options</h2>
              <p className="backstage-subtitle">Customize appearance and behavior.</p>
              <div className="dialog-grid" style={{ maxWidth: 420 }}>
                <label>
                  Theme
                  <select
                    value={settings.theme}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        theme: e.target.value as AppSettings['theme'],
                      })
                    }
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label>
                  Accent color
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => onSettingsChange({ ...settings, accentColor: e.target.value })}
                  />
                </label>
                <label>
                  Default font
                  <input
                    value={settings.defaultFontFamily}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, defaultFontFamily: e.target.value })
                    }
                  />
                </label>
                <label>
                  Default font size
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={settings.defaultFontSize}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, defaultFontSize: Number(e.target.value) || DEFAULT_SETTINGS.defaultFontSize })
                    }
                  />
                </label>
                <label>
                  Default save location
                  <input
                    value={settings.defaultSaveLocation}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, defaultSaveLocation: e.target.value })
                    }
                    placeholder="Leave blank for Documents\\Officewrite"
                  />
                </label>
                <label>
                  Auto-save interval (seconds)
                  <input
                    type="number"
                    min={5}
                    value={settings.autoSaveIntervalMs / 1000}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        autoSaveIntervalMs: Number(e.target.value) * 1000,
                      })
                    }
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={settings.spellCheckEnabled}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, spellCheckEnabled: e.target.checked })
                    }
                  />
                  Enable spell check (Hunspell)
                </label>
                <label>
                  Proofing language
                  <select
                    value={settings.language}
                    onChange={(e) => onSettingsChange({ ...settings, language: e.target.value })}
                  >
                    {PROOFING_LANGUAGES.map((language) => (
                      <option key={language.id} value={language.id}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="icon-btn"
                  onClick={() => onSettingsChange({ ...DEFAULT_SETTINGS })}
                >
                  Reset to defaults
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export type { BackstageSection };
