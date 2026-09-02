import type {
  PageSetup,
  PageOrientation,
  PageSizePreset,
  LineNumberMode,
  HeaderFooter,
  HeaderFooterZones,
} from '@officewrite/core';
import { MARGIN_PRESETS, PAGE_SIZE_LABELS, footerZonesOf, headerZonesOf } from '@officewrite/core';

interface PageSetupDialogProps {
  open: boolean;
  pageSetup: PageSetup;
  onChange: (setup: PageSetup) => void;
  onClose: () => void;
}

export function PageSetupDialog({ open, pageSetup, onChange, onClose }: PageSetupDialogProps) {
  // Which preset the current margins match, so the select reflects reality.
  const activeMarginPreset =
    Object.keys(MARGIN_PRESETS).find((name) => {
      const preset = MARGIN_PRESETS[name];
      return (
        preset.top === pageSetup.margins.top &&
        preset.bottom === pageSetup.margins.bottom &&
        preset.left === pageSetup.margins.left &&
        preset.right === pageSetup.margins.right
      );
    }) ?? '';

  if (!open) return null;

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog panel-card" onClick={(e) => e.stopPropagation()}>
        <h2>Page Setup</h2>
        <div className="dialog-grid">
          <label>
            Page size
            <select
              value={pageSetup.size}
              onChange={(e) => onChange({ ...pageSetup, size: e.target.value as PageSizePreset })}
            >
              {(Object.keys(PAGE_SIZE_LABELS) as PageSizePreset[]).map((size) => (
                <option key={size} value={size}>
                  {PAGE_SIZE_LABELS[size]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Orientation
            <select
              value={pageSetup.orientation}
              onChange={(e) =>
                onChange({ ...pageSetup, orientation: e.target.value as PageOrientation })
              }
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label>
            Margin preset
            {/* Controlled: without a `value` this always displayed "Custom",
                and re-picking the preset already in effect fired nothing. */}
            <select
              data-testid="page-margin-preset"
              value={activeMarginPreset}
              onChange={(e) => {
                const preset = MARGIN_PRESETS[e.target.value];
                if (preset) onChange({ ...pageSetup, margins: { ...preset } });
              }}
            >
              <option value="">Custom</option>
              {Object.keys(MARGIN_PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <label key={side}>
              {side[0].toUpperCase() + side.slice(1)} margin (px)
              <input
                type="number"
                min={0}
                value={pageSetup.margins[side]}
                onChange={(e) =>
                  onChange({
                    ...pageSetup,
                    margins: { ...pageSetup.margins, [side]: Number(e.target.value) },
                  })
                }
              />
            </label>
          ))}
          <label>
            Columns
            <select
              value={pageSetup.columns.count}
              onChange={(e) =>
                onChange({
                  ...pageSetup,
                  columns: { ...pageSetup.columns, count: Number(e.target.value) },
                })
              }
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {pageSetup.columns.count > 1 && (
            <>
              <label>
                Column gap (px)
                <input
                  type="number"
                  min={12}
                  value={pageSetup.columns.gap}
                  onChange={(e) =>
                    onChange({
                      ...pageSetup,
                      columns: { ...pageSetup.columns, gap: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={pageSetup.columns.line}
                  onChange={(e) =>
                    onChange({
                      ...pageSetup,
                      columns: { ...pageSetup.columns, line: e.target.checked },
                    })
                  }
                />
                Line between columns
              </label>
            </>
          )}
          <label>
            Line numbers
            <select
              value={pageSetup.lineNumbers}
              onChange={(e) =>
                onChange({ ...pageSetup, lineNumbers: e.target.value as LineNumberMode })
              }
            >
              <option value="none">None</option>
              <option value="continuous">Continuous</option>
              <option value="restartEachPage">Restart each page</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={pageSetup.hyphenation}
              onChange={(e) => onChange({ ...pageSetup, hyphenation: e.target.checked })}
            />
            Hyphenate automatically
          </label>
        </div>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface HeaderFooterDialogProps {
  open: boolean;
  value: HeaderFooter;
  onChange: (next: HeaderFooter) => void;
  onClose: () => void;
}

/**
 * A header and footer are laid out in three zones. This was two single-line
 * inputs, so a title on the left with a page number on the right - the
 * commonest arrangement there is - could not be expressed at all.
 */
export function HeaderFooterDialog({ open, value, onChange, onClose }: HeaderFooterDialogProps) {
  if (!open) return null;

  const headerZones = headerZonesOf(value);
  const footerZones = footerZonesOf(value);

  const setZone = (which: 'headerZones' | 'footerZones', zone: keyof HeaderFooterZones, text: string) => {
    const current = which === 'headerZones' ? headerZones : footerZones;
    const next: HeaderFooter = { ...value, [which]: { ...current, [zone]: text } };
    // Keep the flat fields in step so a document saved here still opens in a
    // build that only knows about them.
    if (which === 'headerZones' && zone === 'center') next.header = text;
    if (which === 'footerZones' && zone === 'center') next.footer = text;
    onChange(next);
  };

  const ZONES: Array<{ id: keyof HeaderFooterZones; label: string }> = [
    { id: 'left', label: 'Left' },
    { id: 'center', label: 'Centre' },
    { id: 'right', label: 'Right' },
  ];

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog panel-card" onClick={(e) => e.stopPropagation()} data-testid="header-footer-dialog">
        <h2>Header &amp; Footer</h2>

        <h3 className="dialog-subhead">Header</h3>
        <div className="hf-zone-row">
          {ZONES.map((zone) => (
            <label key={`header-${zone.id}`}>
              {zone.label}
              <input
                value={headerZones[zone.id]}
                onChange={(e) => setZone('headerZones', zone.id, e.target.value)}
                data-testid={`header-${zone.id}`}
              />
            </label>
          ))}
        </div>

        <h3 className="dialog-subhead">Footer</h3>
        <div className="hf-zone-row">
          {ZONES.map((zone) => (
            <label key={`footer-${zone.id}`}>
              {zone.label}
              <input
                value={footerZones[zone.id]}
                onChange={(e) => setZone('footerZones', zone.id, e.target.value)}
                data-testid={`footer-${zone.id}`}
              />
            </label>
          ))}
        </div>
        <p className="dialog-hint">
          %p becomes the page number and %P the page count when the document is printed.
        </p>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={value.showPageNumbers}
            onChange={(e) => onChange({ ...value, showPageNumbers: e.target.checked })}
            data-testid="hf-page-numbers"
          />
          Show page numbers in the centre footer
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(value.differentFirstPage)}
            onChange={(e) => onChange({ ...value, differentFirstPage: e.target.checked })}
            data-testid="hf-different-first-page"
          />
          Different first page
        </label>
        <div className="dialog-actions">
          <button className="icon-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
