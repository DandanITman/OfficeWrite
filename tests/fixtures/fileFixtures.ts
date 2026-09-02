import { createDocumentEnvelope } from '@officewrite/core';
import {
  exportToDocx,
  exportToHtml,
  exportToRtf,
  wrapOfficewriteFile,
} from '@officewrite/openxml';

export const TEST_DIR = 'C:/OfficewriteTest';
export const PATHS = {
  docx: `${TEST_DIR}/sample.docx`,
  officewrite: `${TEST_DIR}/sample.officewrite`,
  txt: `${TEST_DIR}/sample.txt`,
  rtf: `${TEST_DIR}/sample.rtf`,
  html: `${TEST_DIR}/sample.html`,
  doc: `${TEST_DIR}/legacy.doc`,
  savedDocx: `${TEST_DIR}/saved.docx`,
  savedTxt: `${TEST_DIR}/saved.txt`,
  savedRtf: `${TEST_DIR}/saved.rtf`,
  savedHtml: `${TEST_DIR}/saved.html`,
  savedOfficewrite: `${TEST_DIR}/saved.officewrite`,
  recentDoc: `${TEST_DIR}/recent.docx`,
  pinnedDoc: `${TEST_DIR}/pinned.officewrite`,
  folderDoc1: `${TEST_DIR}/folder/doc-one.txt`,
  folderDoc2: `${TEST_DIR}/folder/doc-two.txt`,
  imagePng: `${TEST_DIR}/photo.png`,
  pdf: `${TEST_DIR}/export.pdf`,
} as const;

const sampleContent = {
  type: 'doc' as const,
  content: [
    {
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: 'Imported sample paragraph.' }],
    },
    {
      type: 'paragraph' as const,
      content: [
        { type: 'text' as const, text: 'Formatted ', marks: [{ type: 'bold' as const }] },
        { type: 'text' as const, text: 'text.' },
      ],
    },
  ],
};

const headingContent = {
  type: 'doc' as const,
  content: [
    {
      type: 'heading' as const,
      attrs: { level: 1 },
      content: [{ type: 'text' as const, text: 'Chapter One' }],
    },
    {
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: 'Body under chapter one.' }],
    },
    {
      type: 'heading' as const,
      attrs: { level: 2 },
      content: [{ type: 'text' as const, text: 'Section Alpha' }],
    },
    {
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: 'Typo word tehsis appears here.' }],
    },
  ],
};

let cachedDocxBase64: string | null = null;

export async function getSampleDocxBase64() {
  if (!cachedDocxBase64) {
    const blob = await exportToDocx(sampleContent, 'Sample');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    cachedDocxBase64 = Buffer.from(bytes).toString('base64');
  }
  return cachedDocxBase64;
}

export function getSampleTxt() {
  return 'Plain text line one\nPlain text line two';
}

export async function getSampleRtf() {
  return exportToRtf(sampleContent, 'Sample');
}

export async function getSampleHtml() {
  return exportToHtml(sampleContent, 'Sample', { author: 'Tester' });
}

export function getSampleOfficewrite() {
  const envelope = createDocumentEnvelope(sampleContent, {
    metadata: {
      title: 'Sample Officewrite',
      author: 'Tester',
      created: '2026-01-15T12:00:00.000Z',
      modified: '2026-01-15T12:00:00.000Z',
    },
  });
  return JSON.stringify(
    wrapOfficewriteFile(envelope.content, envelope.metadata, {
      pageSetup: envelope.pageSetup,
      headerFooter: envelope.headerFooter,
      comments: envelope.comments,
      trackChangesEnabled: envelope.trackChangesEnabled,
      watermark: envelope.watermark,
      customStyles: envelope.customStyles,
      footnotes: envelope.footnotes,
    }),
    null,
    2,
  );
}

export function getHeadingFixtureJson() {
  return headingContent;
}

/** 1x1 PNG */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
