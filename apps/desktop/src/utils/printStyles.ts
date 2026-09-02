import type { HeaderFooter, PageSetup } from '@officewrite/core';
import { PAGE_DIMENSIONS, footerZonesOf, headerZonesOf } from '@officewrite/core';

const STYLE_ID = 'officewrite-print-styles';

function escapeCss(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Inject the `@page` rules that drive print and PDF export.
 *
 * Two things were wrong before:
 *
 * 1. Margins applied twice. `.doc-page` carries the page margins as inline
 *    padding for on-screen layout, and `@page` set the same margins again, so
 *    printed output had double margins. The screen padding is now zeroed for
 *    print and `@page` owns the margin box.
 * 2. Headers and footers rendered once, at the top and bottom of one long page.
 *    They are emitted as `@page` margin-box content now, so they repeat, with
 *    the page number as a CSS counter.
 */
export function applyPrintPageSetup(pageSetup: PageSetup, headerFooter?: HeaderFooter) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }

  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const pageWidthIn = (pageSetup.orientation === 'portrait' ? dims.width : dims.height) / 96;
  const pageHeightIn = (pageSetup.orientation === 'portrait' ? dims.height : dims.width) / 96;
  const m = pageSetup.margins;

  // Named CSS page sizes where one exists, explicit dimensions otherwise, so
  // A5, Executive and Tabloid print at their real size rather than as Letter.
  const NAMED_SIZES: Partial<Record<PageSetup['size'], string>> = {
    letter: 'letter',
    legal: 'legal',
    a4: 'A4',
    a5: 'A5',
  };
  const sizeRule = NAMED_SIZES[pageSetup.size] ?? `${pageWidthIn}in ${pageHeightIn}in`;
  const orientation = pageSetup.orientation === 'landscape' ? ' landscape' : '';

  const headerZones = headerZonesOf(headerFooter);
  const footerZones = footerZonesOf(headerFooter);
  const showPageNumbers = !!headerFooter?.showPageNumbers;

  /**
   * `%p` and `%P` are the page-number fields written into the file; CSS counters are the
   * only way to get a real page number into a printed margin box, so the
   * tokens are expanded here rather than being rendered as literal text.
   */
  const zoneContent = (text: string, withPageNumbers = false) => {
    const trimmed = text.trim();
    const parts: string[] = [];
    if (trimmed) {
      const pieces = trimmed.split(/(%p|%P)/g).filter(Boolean);
      for (const piece of pieces) {
        if (piece === '%p') parts.push('counter(page)');
        else if (piece === '%P') parts.push('counter(pages)');
        else parts.push(`"${escapeCss(piece)}"`);
      }
    }
    if (withPageNumbers) {
      if (parts.length) parts.push('"  "');
      parts.push('"Page " counter(page) " of " counter(pages)');
    }
    return parts.join(' ');
  };

  const box = (position: string, content: string) =>
    content ? `${position} { content: ${content}; font-size: 9pt; color: #444; }` : '';

  const headerBox = [
    box('@top-left', zoneContent(headerZones.left)),
    box('@top-center', zoneContent(headerZones.center)),
    box('@top-right', zoneContent(headerZones.right)),
  ]
    .filter(Boolean)
    .join('\n      ');

  const footerBox = [
    box('@bottom-left', zoneContent(footerZones.left)),
    // Page numbers ride in the centre footer, which is where they were before.
    box('@bottom-center', zoneContent(footerZones.center, showPageNumbers)),
    box('@bottom-right', zoneContent(footerZones.right)),
  ]
    .filter(Boolean)
    .join('\n      ');

  // Different First Page suppresses both margin boxes on page one.
  const firstPageRule = headerFooter?.differentFirstPage
    ? `@page :first {
      @top-left { content: none; }
      @top-center { content: none; }
      @top-right { content: none; }
      @bottom-left { content: none; }
      @bottom-center { content: none; }
      @bottom-right { content: none; }
    }`
    : '';

  el.textContent = `
    @page {
      size: ${sizeRule}${orientation};
      margin: ${m.top / 96}in ${m.right / 96}in ${m.bottom / 96}in ${m.left / 96}in;
      ${headerBox}
      ${footerBox}
    }
    ${firstPageRule}
    @media print {
      /* The zoom transform must not scale printed output. */
      .editor-scroll {
        transform: none !important;
      }
      /* @page owns the margin box now. Keeping the on-screen padding as well
         is what doubled every margin in print and PDF. */
      .doc-page {
        padding: 0 !important;
        width: auto !important;
        min-height: 0 !important;
      }
      .doc-body {
        column-count: ${pageSetup.columns.count} !important;
        column-gap: ${pageSetup.columns.gap}px !important;
        min-height: 0 !important;
      }
      .doc-body h1, .doc-body h2 {
        column-span: all;
      }
      ${
        pageSetup.columns.line
          ? '.doc-body { column-rule: 1px solid #999 !important; }'
          : ''
      }
      ${
        pageSetup.hyphenation ? '.doc-body { hyphens: auto !important; }' : ''
      }
      ${
        pageSetup.pageColor
          ? `.doc-page { background: ${pageSetup.pageColor} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`
          : ''
      }
      ${
        pageSetup.border.style !== 'none'
          ? `.doc-page { outline: ${pageSetup.border.width}px ${pageSetup.border.style} ${pageSetup.border.color} !important; outline-offset: -12px; }`
          : ''
      }
      /* Editing chrome never prints. */
      .image-resize-handle,
      .image-rotate-handle,
      .image-size-badge,
      .image-guides,
      .mini-toolbar,
      .editor-context-menu,
      .doc-line-numbers,
      .text-box-drag-handle,
      .text-box-resize-handle,
      .ink-resize-handle,
      .fmt-mark {
        display: none !important;
      }
      /* Repeated per page by the @page boxes above; the in-flow copies would
         otherwise print a second time at the very top and bottom. */
      .doc-header,
      .doc-footer,
      .doc-footer-pages {
        display: none !important;
      }
    }
  `;

  document.documentElement.style.setProperty('--print-page-width-in', String(pageWidthIn));
  document.documentElement.style.setProperty('--print-page-height-in', String(pageHeightIn));
}
