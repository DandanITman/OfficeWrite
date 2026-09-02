import { X } from 'lucide-react';

export type ReaderWidth = 'narrow' | 'medium' | 'wide';
export type ReaderSpacing = 'normal' | 'relaxed' | 'loose';
export type ReaderPage = 'white' | 'sepia' | 'grey';

export interface ImmersiveSettings {
  width: ReaderWidth;
  spacing: ReaderSpacing;
  page: ReaderPage;
  lineFocus: boolean;
}

export const DEFAULT_IMMERSIVE: ImmersiveSettings = {
  width: 'medium',
  spacing: 'normal',
  page: 'white',
  lineFocus: false,
};

const WIDTHS: ReaderWidth[] = ['narrow', 'medium', 'wide'];
const SPACINGS: ReaderSpacing[] = ['normal', 'relaxed', 'loose'];
const PAGES: ReaderPage[] = ['white', 'sepia', 'grey'];

const LABEL: Record<string, string> = {
  narrow: 'Narrow',
  medium: 'Medium',
  wide: 'Wide',
  normal: 'Normal',
  relaxed: 'Relaxed',
  loose: 'Loose',
  white: 'White',
  sepia: 'Sepia',
  grey: 'Grey',
};

/**
 * The reading-comfort strip Immersive Reader shows above the page.
 *
 * Everything here is presentation only - none of it touches the document - so
 * leaving the mode restores exactly what was there.
 */
export function ImmersiveReaderBar({
  settings,
  onChange,
  onExit,
}: {
  settings: ImmersiveSettings;
  onChange: (settings: ImmersiveSettings) => void;
  onExit: () => void;
}) {
  const group = <T extends string>(
    name: string,
    values: T[],
    current: T,
    apply: (value: T) => void,
  ) => (
    <div className="reader-group" role="group" aria-label={name}>
      <span className="reader-group-label">{name}</span>
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className={`reader-chip${current === value ? ' is-active' : ''}`}
          aria-pressed={current === value}
          onClick={() => apply(value)}
          data-testid={`reader-${name.toLowerCase().replace(/\s+/g, '-')}-${value}`}
        >
          {LABEL[value]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="immersive-bar" data-testid="immersive-bar">
      {group('Column width', WIDTHS, settings.width, (width) => onChange({ ...settings, width }))}
      {group('Text spacing', SPACINGS, settings.spacing, (spacing) =>
        onChange({ ...settings, spacing }),
      )}
      {group('Page colour', PAGES, settings.page, (page) => onChange({ ...settings, page }))}
      <button
        type="button"
        className={`reader-chip${settings.lineFocus ? ' is-active' : ''}`}
        aria-pressed={settings.lineFocus}
        onClick={() => onChange({ ...settings, lineFocus: !settings.lineFocus })}
        data-testid="reader-line-focus"
      >
        Line focus
      </button>
      <button className="reader-exit" onClick={onExit} data-testid="reader-exit">
        <X size={14} /> Close Immersive Reader
      </button>
    </div>
  );
}
