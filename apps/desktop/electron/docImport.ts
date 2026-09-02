import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { existsSync } from 'node:fs';
import WordExtractor from 'word-extractor';

const extractor = new WordExtractor();

const SOFFICE_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  'soffice',
];

export type DocImportResult =
  | { format: 'docx'; data: ArrayBuffer; source: 'libreoffice' }
  | { format: 'text'; data: string; source: 'extractor'; warning: string };

function runLibreOfficeConvert(soffice: string, inputPath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--norestore',
      '--convert-to',
      'docx',
      '--outdir',
      outDir,
      inputPath,
    ];
    const proc = spawn(soffice, args, { windowsHide: true });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`LibreOffice exited with code ${code}`));
    });
  });
}

async function tryLibreOfficeDocx(filePath: string): Promise<ArrayBuffer | null> {
  for (const soffice of SOFFICE_CANDIDATES) {
    if (soffice.includes('\\') && !existsSync(soffice)) continue;
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'officewrite-doc-'));
    try {
      await runLibreOfficeConvert(soffice, filePath, outDir);
      const base = path.basename(filePath, path.extname(filePath));
      const docxPath = path.join(outDir, `${base}.docx`);
      const buf = await fs.readFile(docxPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    } catch {
      continue;
    }
  }
  return null;
}

export async function importDocFile(filePath: string): Promise<DocImportResult> {
  const docx = await tryLibreOfficeDocx(filePath);
  if (docx) {
    return { format: 'docx', data: docx, source: 'libreoffice' };
  }

  const doc = await extractor.extract(filePath);
  const body = await doc.getBody();
  return {
    format: 'text',
    data: body,
    source: 'extractor',
    warning:
      'Legacy .doc opened with basic text extraction. Install LibreOffice for full formatting, or save as .docx in Word.',
  };
}

/** @deprecated use importDocFile */
export async function extractDocText(filePath: string): Promise<string> {
  const doc = await extractor.extract(filePath);
  return doc.getBody();
}
