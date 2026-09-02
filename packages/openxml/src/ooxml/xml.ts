import { XMLParser } from 'fast-xml-parser';

/**
 * A minimal ordered XML tree.
 *
 * We deliberately avoid `DOMParser` here: `packages/openxml` unit tests run in
 * the `node` environment, and the previous mammoth-based importer could not be
 * tested at all because it required a browser DOM. fast-xml-parser gives the
 * same tree in both environments.
 */
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Text content for `#text` nodes. */
  text?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  // OOXML is namespace-qualified (w:p, r:id). Keep the prefixes: they carry meaning.
  removeNSPrefix: false,
});

type RawEntry = Record<string, unknown> & { ':@'?: Record<string, string> };

function convert(entries: RawEntry[]): XmlNode[] {
  const out: XmlNode[] = [];
  for (const entry of entries) {
    const attrs = entry[':@'] ?? {};
    for (const key of Object.keys(entry)) {
      if (key === ':@') continue;
      const value = entry[key];
      if (key === '#text') {
        const text = String(value ?? '');
        if (text) out.push({ name: '#text', attrs: {}, children: [], text });
        continue;
      }
      out.push({
        name: key,
        attrs: attrs as Record<string, string>,
        children: Array.isArray(value) ? convert(value as RawEntry[]) : [],
      });
    }
  }
  return out;
}

export function parseXml(xml: string): XmlNode[] {
  return convert(parser.parse(xml) as RawEntry[]);
}

/** First direct child with the given tag name. */
export function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return node?.children.find((c) => c.name === name);
}

/** All direct children with the given tag name. */
export function children(node: XmlNode | undefined, name: string): XmlNode[] {
  return node?.children.filter((c) => c.name === name) ?? [];
}

/** Walk a chain of tag names, e.g. path(p, 'w:pPr', 'w:jc'). */
export function path(node: XmlNode | undefined, ...names: string[]): XmlNode | undefined {
  let current = node;
  for (const name of names) {
    current = child(current, name);
    if (!current) return undefined;
  }
  return current;
}

export function attr(node: XmlNode | undefined, name: string): string | undefined {
  return node?.attrs[name];
}

/** `w:val` on a child element - the most common OOXML shape. */
export function val(node: XmlNode | undefined, name: string): string | undefined {
  return attr(child(node, name), 'w:val');
}

/**
 * OOXML booleans: `<w:b/>` means on, `<w:b w:val="0"/>` means off. Absence
 * means inherit, which we treat as off.
 */
export function boolProp(parent: XmlNode | undefined, name: string): boolean {
  const el = child(parent, name);
  if (!el) return false;
  const v = el.attrs['w:val'];
  return v === undefined || v === '1' || v === 'true' || v === 'on';
}

/**
 * Elements whose text is machinery rather than document content.
 * `w:instrText` holds field codes such as `PAGE` and `NUMPAGES`; `w:delText`
 * holds text removed under track changes.
 */
const NON_VISIBLE_TEXT = new Set(['w:instrText', 'w:delText']);

/** Concatenated visible text of a subtree, honouring `w:t` and tab elements. */
export function textOf(node: XmlNode | undefined): string {
  if (!node) return '';
  let out = '';
  const walk = (n: XmlNode) => {
    if (n.name === '#text') {
      out += n.text ?? '';
      return;
    }
    if (NON_VISIBLE_TEXT.has(n.name)) return;
    if (n.name === 'w:tab') out += '\t';
    for (const c of n.children) walk(c);
  };
  for (const c of node.children) walk(c);
  return out;
}

/**
 * Field instruction codes within a subtree, one entry per `w:instrText`.
 *
 * Returned as a list rather than a concatenated string: `PAGE` followed by
 * `NUMPAGES` would otherwise read as `PAGENUMPAGES`, where a `\bPAGE\b` test
 * finds no match.
 */
export function fieldInstructions(node: XmlNode | undefined): string[] {
  if (!node) return [];
  const out: string[] = [];
  const walk = (n: XmlNode) => {
    if (n.name === 'w:instrText') {
      let text = '';
      const collect = (m: XmlNode) => {
        if (m.name === '#text') text += m.text ?? '';
        m.children.forEach(collect);
      };
      n.children.forEach(collect);
      if (text.trim()) out.push(text.trim());
      return;
    }
    n.children.forEach(walk);
  };
  node.children.forEach(walk);
  return out;
}

/** Twips (1/20 pt) to CSS pixels at 96 DPI - the unit the document model uses. */
export function twipsToPx(twips: number | string | undefined): number {
  const n = typeof twips === 'string' ? parseFloat(twips) : twips;
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.round(n / 15);
}

/** EMUs (English Metric Units) to CSS pixels at 96 DPI. */
export function emuToPx(emu: number | string | undefined): number {
  const n = typeof emu === 'string' ? parseFloat(emu) : emu;
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.round(n / 9525);
}
