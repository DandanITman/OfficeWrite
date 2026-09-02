/**
 * The font list, in one place.
 *
 * There used to be three hardcoded lists - fifteen names in the ribbon,
 * fourteen in the Font dialog, five in the style editor - which disagreed with
 * each other and with the machine. A word processor offers every installed font, so this
 * measures which of a broad candidate set the system can actually render and
 * offers those.
 *
 * Detection is by text metrics rather than `queryLocalFonts`, which needs a
 * permission prompt and a user gesture: a string is drawn in the candidate
 * face backed by a generic fallback, and again in the fallback alone. If the
 * widths differ the candidate resolved to a real face. That is unavoidably a
 * probe of a known list rather than true enumeration, so the candidates below
 * cover the Windows and Office families a document is likely to name.
 */

/** Faces worth offering when they are present. Order is the: alphabetical. */
export const FONT_CANDIDATES: readonly string[] = [
  'Agency FB', 'Algerian', 'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold',
  'Bahnschrift', 'Baskerville Old Face', 'Bauhaus 93', 'Bell MT', 'Berlin Sans FB',
  'Bernard MT Condensed', 'Book Antiqua', 'Bookman Old Style', 'Bradley Hand ITC',
  'Britannic Bold', 'Broadway', 'Brush Script MT', 'Calibri', 'Calibri Light',
  'Californian FB', 'Cambria', 'Cambria Math', 'Candara', 'Cascadia Code', 'Cascadia Mono',
  'Castellar', 'Centaur', 'Century', 'Century Gothic', 'Century Schoolbook', 'Chiller',
  'Colonna MT', 'Comic Sans MS', 'Consolas', 'Constantia', 'Cooper Black', 'Copperplate Gothic Bold',
  'Corbel', 'Courier New', 'Curlz MT', 'Ebrima', 'Elephant', 'Engravers MT', 'Eras Bold ITC',
  'Felix Titling', 'Footlight MT Light', 'Forte', 'Franklin Gothic Book', 'Franklin Gothic Medium',
  'Freestyle Script', 'French Script MT', 'Gabriola', 'Gadugi', 'Garamond', 'Georgia',
  'Gill Sans MT', 'Gloucester MT Extra Condensed', 'Goudy Old Style', 'Haettenschweiler',
  'Harlow Solid Italic', 'Harrington', 'High Tower Text', 'Impact', 'Imprint MT Shadow',
  'Informal Roman', 'Ink Free', 'Javanese Text', 'Jokerman', 'Juice ITC', 'Kristen ITC',
  'Kunstler Script', 'Leelawadee UI', 'Lucida Bright', 'Lucida Calligraphy', 'Lucida Console',
  'Lucida Fax', 'Lucida Handwriting', 'Lucida Sans', 'Lucida Sans Typewriter', 'Lucida Sans Unicode',
  'Magneto', 'Maiandra GD', 'Malgun Gothic', 'Marlett', 'Matura MT Script Capitals',
  'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa',
  'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti',
  'MingLiU', 'Mistral', 'Modern No. 20', 'Mongolian Baiti', 'Monotype Corsiva', 'MS Gothic',
  'MS PGothic', 'MS Reference Sans Serif', 'MS UI Gothic', 'MV Boli', 'Myanmar Text',
  'Niagara Engraved', 'Niagara Solid', 'Nirmala UI', 'OCR A Extended', 'Old English Text MT',
  'Onyx', 'Palace Script MT', 'Palatino Linotype', 'Papyrus', 'Parchment', 'Perpetua',
  'Perpetua Titling MT', 'Playbill', 'Poor Richard', 'Pristina', 'Rage Italic', 'Ravie',
  'Rockwell', 'Rockwell Condensed', 'Rockwell Extra Bold', 'Script MT Bold', 'Segoe Print',
  'Segoe Script', 'Segoe UI', 'Segoe UI Emoji', 'Segoe UI Historic', 'Segoe UI Semibold',
  'Segoe UI Symbol', 'Showcard Gothic', 'SimSun', 'Sitka Banner', 'Sitka Display', 'Sitka Heading',
  'Sitka Small', 'Sitka Subheading', 'Sitka Text', 'Snap ITC', 'Stencil', 'Sylfaen', 'Symbol',
  'Tahoma', 'Tempus Sans ITC', 'Times New Roman', 'Trebuchet MS', 'Tw Cen MT', 'Verdana',
  'Viner Hand ITC', 'Vivaldi', 'Vladimir Script', 'Webdings', 'Wide Latin', 'Wingdings',
  'Wingdings 2', 'Wingdings 3', 'Yu Gothic', 'Yu Mincho',
];

/**
 * What to offer when measurement is unavailable - a headless test environment,
 * or a canvas the platform refuses. the defaults, so the app is never
 * left without a usable list.
 */
export const FALLBACK_FONTS: readonly string[] = [
  'Arial', 'Calibri', 'Calibri Light', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas',
  'Courier New', 'Garamond', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Verdana',
];

/** Generic families a candidate is measured against; a real face differs from all three. */
const PROBES = ['monospace', 'sans-serif', 'serif'] as const;
const PROBE_TEXT = 'mmmmmmmmmmlli';
const PROBE_SIZE = '72px';

/**
 * Filter `candidates` down to the faces this machine can actually render.
 * Returns `null` when measurement is not possible, so callers can fall back
 * rather than show an empty list.
 */
export function detectInstalledFonts(
  candidates: readonly string[] = FONT_CANDIDATES,
): string[] | null {
  if (typeof document === 'undefined') return null;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;

  const baseline = new Map<string, number>();
  for (const probe of PROBES) {
    context.font = `${PROBE_SIZE} ${probe}`;
    baseline.set(probe, context.measureText(PROBE_TEXT).width);
  }
  // A canvas that measures every probe identically is not really measuring.
  if (new Set(baseline.values()).size === 1) return null;

  const found = candidates.filter((family) =>
    PROBES.some((probe) => {
      context.font = `${PROBE_SIZE} "${family}", ${probe}`;
      return context.measureText(PROBE_TEXT).width !== baseline.get(probe);
    }),
  );
  return found.length ? found : null;
}

let cached: readonly string[] | null = null;

/**
 * The fonts to offer. Measured once per session - the installed set does not
 * change while the app runs, and probing ~160 faces is not free.
 *
 * The baseline set is always included, even when this machine cannot render it.
 * Detection alone would have *removed* choices the app used to offer: a lean
 * container has no Georgia, so Georgia vanished from the Font dialog and the
 * style editor. A document may also name a font this machine lacks, and a word processor
 * still lists it rather than silently dropping it.
 */
export function availableFonts(): readonly string[] {
  if (!cached) {
    const detected = detectInstalledFonts() ?? [];
    cached = [...new Set([...FALLBACK_FONTS, ...detected])].sort((a, b) => a.localeCompare(b));
  }
  return cached;
}

/** Test seam: drop the memoised list so the next call measures again. */
export function resetFontCache(): void {
  cached = null;
}
