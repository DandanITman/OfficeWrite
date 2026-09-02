import {
  createDocumentEnvelope,
  parseOfficewriteFile,
  serializeOfficewriteFile,
  type DocumentEnvelope,
  type DocumentMetadata,
} from '@officewrite/core';
import { exportToDocx, type DocxExportOptions } from './docxExport';
import { importDocx, type DocxImportResult, type TipTapNode } from './ooxml/docxImport';

/**
 * Read a .docx into the full document model.
 *
 * Returns page setup, headers/footers and footnotes alongside the content -
 * all of which the previous mammoth-based importer silently discarded.
 */
export async function importFromDocx(
  arrayBuffer: ArrayBuffer | Uint8Array,
): Promise<DocxImportResult> {
  return importDocx(arrayBuffer);
}

/** Build a document envelope directly from a .docx, preserving section properties. */
export async function importDocxEnvelope(
  arrayBuffer: ArrayBuffer | Uint8Array,
): Promise<DocumentEnvelope> {
  const result = await importDocx(arrayBuffer);
  return createDocumentEnvelope(result.content, {
    pageSetup: result.pageSetup,
    headerFooter: result.headerFooter,
    footnotes: result.footnotes,
    comments: result.comments,
  });
}

export function wrapOfficewriteFile(
  content: unknown,
  metadata?: Partial<DocumentMetadata>,
  extras?: Partial<Omit<DocumentEnvelope, 'content' | 'metadata'>>,
) {
  const now = new Date().toISOString();
  return serializeOfficewriteFile(
    createDocumentEnvelope(content, {
      metadata: metadata
        ? {
            title: metadata.title ?? 'Untitled',
            author: metadata.author ?? '',
            subject: metadata.subject,
            keywords: metadata.keywords,
            company: metadata.company,
            created: metadata.created ?? now,
            modified: now,
          }
        : undefined,
      ...extras,
    }),
  );
}

export function unwrapOfficewriteFile(file: unknown): DocumentEnvelope {
  return parseOfficewriteFile(file);
}

export type { DocxImportResult, TipTapNode };
export { exportToDocx, type DocxExportOptions };
export { exportToRtf, importFromRtf } from './rtf';
export { exportToHtml, importFromHtml } from './html';
export { importFromDocText } from './importDoc';
