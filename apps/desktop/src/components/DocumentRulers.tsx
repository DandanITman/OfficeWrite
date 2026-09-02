import { useRef, type ReactNode, type CSSProperties } from 'react';
import type { PageMargins, PageSetup } from '@officewrite/core';
import { PAGE_DIMENSIONS } from '@officewrite/core';

interface DocumentRulersProps {
  pageSetup: PageSetup;
  children: ReactNode;
  /** View > Ruler. */
  visible?: boolean;
  /** Dragging a margin marker changes the page margins, as a ruler should. */
  onMarginsChange?: (margins: PageMargins) => void;
}

const PPI = 96;

function RulerHorizontal({
  pageSetup,
  onMarginsChange,
}: {
  pageSetup: PageSetup;
  onMarginsChange?: (margins: PageMargins) => void;
}) {
  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const width = pageSetup.orientation === 'portrait' ? dims.width : dims.height;
  const { left: marginLeft, right: marginRight } = pageSetup.margins;
  const inches = Math.ceil(width / PPI);
  const trackRef = useRef<HTMLDivElement>(null);

  const startDrag = (side: 'left' | 'right') => (event: React.MouseEvent) => {
    if (!onMarginsChange) return;
    event.preventDefault();
    const startX = event.clientX;
    const startValue = side === 'left' ? marginLeft : marginRight;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const raw = side === 'left' ? startValue + delta : startValue - delta;
      // Snap to eighth-inch stops, which is what the ruler's ticks represent.
      const snapped = Math.round(raw / (PPI / 8)) * (PPI / 8);
      const bounded = Math.max(0, Math.min(width / 2 - 24, snapped));
      onMarginsChange({ ...pageSetup.margins, [side]: bounded } as PageMargins);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="ruler-h" style={{ width }} data-testid="ruler-horizontal">
      <div className="ruler-h-track" ref={trackRef}>
        {Array.from({ length: inches * 4 + 1 }, (_, i) => {
          const isInch = i % 4 === 0;
          return (
            <span
              key={i}
              className={`ruler-h-tick${isInch ? ' is-inch' : ''}`}
              style={{ left: (i * PPI) / 4 }}
            >
              {isInch && i > 0 ? i / 4 : ''}
            </span>
          );
        })}
        <div className="ruler-h-margin-left" style={{ width: marginLeft }} />
        <div className="ruler-h-margin-right" style={{ width: marginRight }} />
        <button
          type="button"
          className="ruler-marker ruler-marker-left"
          style={{ left: marginLeft }}
          onMouseDown={startDrag('left')}
          title="Drag to change the left margin"
          aria-label="Left margin"
          data-testid="ruler-margin-left"
        />
        <button
          type="button"
          className="ruler-marker ruler-marker-right"
          style={{ right: marginRight }}
          onMouseDown={startDrag('right')}
          title="Drag to change the right margin"
          aria-label="Right margin"
          data-testid="ruler-margin-right"
        />
      </div>
    </div>
  );
}

function RulerVertical({ pageSetup }: { pageSetup: PageSetup }) {
  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const height = pageSetup.orientation === 'portrait' ? dims.height : dims.width;
  const inches = Math.ceil(height / PPI);

  return (
    <div className="ruler-v" style={{ minHeight: height }}>
      {Array.from({ length: inches + 1 }, (_, i) => (
        <span key={i} className="ruler-v-mark" style={{ top: i * PPI }}>
          {i}
        </span>
      ))}
    </div>
  );
}

export function DocumentRulers({
  pageSetup,
  children,
  visible = true,
  onMarginsChange,
}: DocumentRulersProps) {
  const dims = PAGE_DIMENSIONS[pageSetup.size];
  const width = pageSetup.orientation === 'portrait' ? dims.width : dims.height;

  if (!visible) {
    return <div className="doc-rulers-grid rulers-hidden">{children}</div>;
  }

  return (
    <div
      className="doc-rulers-grid"
      style={{ '--page-width': `${width}px` } as CSSProperties}
    >
      <div className="doc-rulers-corner" />
      <RulerHorizontal pageSetup={pageSetup} onMarginsChange={onMarginsChange} />
      <RulerVertical pageSetup={pageSetup} />
      <div className="doc-rulers-content">{children}</div>
    </div>
  );
}

/** @deprecated use DocumentRulers */
export function Ruler({ pageSetup }: { pageSetup: PageSetup }) {
  return <RulerHorizontal pageSetup={pageSetup} />;
}
