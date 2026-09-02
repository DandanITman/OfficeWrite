/**
 * WCAG 2.1 contrast maths, used by the accessibility checker.
 *
 * Small enough to implement directly, and doing so keeps the app dependency-free
 * and offline. See https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio.
 */

/** Accepts `#rgb`, `#rrggbb` and `rgb(r, g, b)`; returns null for anything else. */
export function parseColor(value: string): [number, number, number] | null {
  const text = value.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3) {
      return [
        parseInt(digits[0] + digits[0], 16),
        parseInt(digits[1] + digits[1], 16),
        parseInt(digits[2] + digits[2], 16),
      ];
    }
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(text);
  if (rgb) {
    const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (channels.every((channel) => channel >= 0 && channel <= 255)) {
      return channels as [number, number, number];
    }
  }

  return null;
}

/** Relative luminance, 0 for black and 1 for white. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** From 1 (identical) to 21 (black on white). Returns null if either colour is unparseable. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return null;

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text (18pt, or 14pt bold). */
export const CONTRAST_AA_NORMAL = 4.5;
export const CONTRAST_AA_LARGE = 3;
