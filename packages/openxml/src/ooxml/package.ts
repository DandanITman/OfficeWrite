import JSZip from 'jszip';
import { attr, children, parseXml, type XmlNode } from './xml';

/** Relationship id -> target, as declared in a `_rels/*.rels` part. */
export type Relationships = Record<string, { target: string; mode?: string }>;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  emf: 'image/emf',
  wmf: 'image/wmf',
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa exists in browsers and in Node 16+.
  return btoa(binary);
}

/**
 * A loaded .docx, with the parts the importer needs already resolved.
 *
 * Everything is read up front: the previous importer went through mammoth,
 * which only ever exposed a lossy HTML rendering of `document.xml` and
 * discarded section properties, headers, footers and footnotes entirely.
 */
export class DocxPackage {
  private constructor(
    private readonly zip: JSZip,
    readonly document: XmlNode | undefined,
    readonly numbering: XmlNode | undefined,
    readonly styles: XmlNode | undefined,
    readonly footnotes: XmlNode | undefined,
    readonly comments: XmlNode | undefined,
    readonly rels: Relationships,
    private readonly media: Map<string, string>,
  ) {}

  static async load(data: ArrayBuffer | Uint8Array): Promise<DocxPackage> {
    const zip = await JSZip.loadAsync(data);

    const readXml = async (name: string): Promise<XmlNode | undefined> => {
      const file = zip.file(name);
      if (!file) return undefined;
      const roots = parseXml(await file.async('string'));
      // Skip the <?xml ...?> declaration entry fast-xml-parser emits.
      return roots.find((r) => r.name !== '?xml');
    };

    const [document, numbering, styles, footnotes, comments, relsXml] = await Promise.all([
      readXml('word/document.xml'),
      readXml('word/numbering.xml'),
      readXml('word/styles.xml'),
      readXml('word/footnotes.xml'),
      readXml('word/comments.xml'),
      readXml('word/_rels/document.xml.rels'),
    ]);

    const rels: Relationships = {};
    for (const rel of children(relsXml, 'Relationship')) {
      const id = attr(rel, 'Id');
      const target = attr(rel, 'Target');
      if (id && target) rels[id] = { target, mode: attr(rel, 'TargetMode') };
    }

    // Inline every image as a data URI so the document stays self-contained,
    // matching how images are represented everywhere else in the app.
    const media = new Map<string, string>();
    await Promise.all(
      Object.values(rels).map(async ({ target, mode }) => {
        if (mode === 'External') return;
        const normalized = target.replace(/^\.?\//, '');
        if (!/^media\//.test(normalized)) return;
        const file = zip.file(`word/${normalized}`);
        if (!file) return;
        const ext = normalized.split('.').pop()?.toLowerCase() ?? '';
        const mime = MIME_BY_EXT[ext];
        if (!mime) return;
        const bytes = await file.async('uint8array');
        media.set(normalized, `data:${mime};base64,${bytesToBase64(bytes)}`);
      }),
    );

    return new DocxPackage(zip, document, numbering, styles, footnotes, comments, rels, media);
  }

  /** Resolve a relationship id to its target, or undefined. */
  relTarget(id: string | undefined): string | undefined {
    if (!id) return undefined;
    return this.rels[id]?.target;
  }

  /** External hyperlink URL for a relationship id. */
  hyperlink(id: string | undefined): string | undefined {
    if (!id) return undefined;
    const rel = this.rels[id];
    if (!rel) return undefined;
    return rel.mode === 'External' ? rel.target : undefined;
  }

  /** Data URI for an image relationship id. */
  imageData(id: string | undefined): string | undefined {
    const target = this.relTarget(id);
    if (!target) return undefined;
    return this.media.get(target.replace(/^\.?\//, ''));
  }

  /** Parse a header or footer part by relationship id. */
  async part(id: string | undefined): Promise<XmlNode | undefined> {
    const target = this.relTarget(id);
    if (!target) return undefined;
    const file = this.zip.file(`word/${target.replace(/^\.?\//, '')}`);
    if (!file) return undefined;
    const roots = parseXml(await file.async('string'));
    return roots.find((r) => r.name !== '?xml');
  }
}
