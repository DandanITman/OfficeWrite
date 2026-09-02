import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { ImageFrame, ImageWrap } from '../extensions/ResizableImage';

type Align = 'left' | 'center' | 'right';

/** How far from a guide the pointer snaps to it, in pixels. */
const SNAP_DISTANCE = 8;
/** The baseline grid floating pictures snap to vertically. */
const LINE_GRID = 24;
const MIN_SIZE = 32;

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CORNER_HANDLES = new Set<HandleId>(['nw', 'ne', 'se', 'sw']);

const FLOATING_WRAPS = new Set<ImageWrap>(['square', 'tight', 'through', 'behind', 'front']);

interface Guide {
  /** Viewport x for a vertical guide. */
  x?: number;
  /** Viewport y for a horizontal guide. */
  y?: number;
  top: number;
  left: number;
  width: number;
  height: number;
  label: string;
}

/**
 * The picture node view: the selection frame, handles and drag behaviour.
 *
 * Two things here matter for the picture to feel right:
 *
 *  - Dragging an *inline* picture moves it through the text, because that is
 *    what inline means; only a *floating* picture (Square, Tight, Through,
 *    Behind or In Front of Text) is dragged to a free position. The old view
 *    dragged everything by nudging margins, so an inline picture drifted away
 *    from its paragraph and could never be put back.
 *  - A floating drag snaps to the left margin, the page centre and the right
 *    margin, and to the baseline grid, drawing alignment guides as it goes. Without them, "centred" was a pixel-hunt that never quite landed.
 */
export function ImageBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const aspectRef = useRef<number | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [dragging, setDragging] = useState(false);

  const {
    src,
    alt,
    title,
    width,
    height,
    align = 'left' as Align,
    wrap = 'square' as ImageWrap,
    offsetX = 0,
    offsetY = 0,
    rotation = 0,
    brightness = 100,
    contrast = 100,
    saturation = 100,
    frame = 'none' as ImageFrame,
    borderColor = null,
    lockAspect = true,
    z = 0,
  } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number | null;
    height?: number | null;
    align?: Align;
    wrap?: ImageWrap;
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    frame?: ImageFrame;
    borderColor?: string | null;
    lockAspect?: boolean;
    z?: number;
  };

  const floating = FLOATING_WRAPS.has(wrap);

  const select = useCallback(() => {
    const pos = getPos();
    if (typeof pos === 'number') editor.chain().focus().setNodeSelection(pos).run();
  }, [editor, getPos]);

  // Delete and arrow-key nudging of a selected picture.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        editor.chain().focus().deleteSelection().run();
        return;
      }
      if (!event.key.startsWith('Arrow')) return;
      if (!floating) return;
      event.preventDefault();
      const step = event.ctrlKey ? 1 : event.shiftKey ? 10 : 4;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      editor.chain().focus().nudgeImage(dx, dy).run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, selected, floating]);

  /** Page geometry, so drags can snap to the same edges the ruler shows. */
  const pageMetrics = () => {
    const page = wrapperRef.current?.closest('.doc-page') as HTMLElement | null;
    if (!page) return null;
    const rect = page.getBoundingClientRect();
    const styles = window.getComputedStyle(page);
    const padLeft = parseFloat(styles.paddingLeft) || 0;
    const padRight = parseFloat(styles.paddingRight) || 0;
    return {
      rect,
      contentLeft: rect.left + padLeft,
      contentRight: rect.right - padRight,
      contentCenter: rect.left + padLeft + (rect.width - padLeft - padRight) / 2,
    };
  };

  const clearGuides = () => setGuides([]);

  const startResize = (event: React.MouseEvent, handle: HandleId) => {
    event.preventDefault();
    event.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    select();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = img.offsetWidth;
    const startHeight = img.offsetHeight;
    const ratio = aspectRef.current ?? startWidth / Math.max(1, startHeight);

    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
      const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;

      let nextWidth = startWidth + horizontal * dx;
      let nextHeight = startHeight + vertical * dy;

      // Shift inverts the aspect lock while dragging.
      const keepAspect = CORNER_HANDLES.has(handle) && lockAspect !== moveEvent.shiftKey;
      if (keepAspect) {
        // Follow whichever axis the pointer moved further along, so the corner
        // tracks the cursor instead of jumping between the two.
        if (Math.abs(dx) >= Math.abs(dy)) nextHeight = nextWidth / ratio;
        else nextWidth = nextHeight * ratio;
      } else if (horizontal === 0) {
        nextWidth = startWidth;
      } else if (vertical === 0) {
        nextHeight = startHeight;
      }

      updateAttributes({
        width: Math.max(MIN_SIZE, Math.round(nextWidth)),
        height: Math.max(MIN_SIZE, Math.round(nextHeight)),
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startRotate = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    select();
    const rect = img.getBoundingClientRect();
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;

    const onMove = (moveEvent: MouseEvent) => {
      const radians = Math.atan2(moveEvent.clientY - centreY, moveEvent.clientX - centreX);
      // The handle sits above the picture, so 0° is straight up.
      const degrees = (radians * 180) / Math.PI + 90;
      // Shift constrains to 15° steps.
      const snapped = moveEvent.shiftKey ? Math.round(degrees / 15) * 15 : Math.round(degrees);
      updateAttributes({ rotation: ((snapped % 360) + 360) % 360 });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  /** Free drag, for floating pictures only. */
  const startDrag = (event: React.MouseEvent) => {
    if (!floating) return;
    event.preventDefault();
    event.stopPropagation();
    select();
    setDragging(true);

    const startX = event.clientX;
    const startY = event.clientY;
    const startOffsetX = offsetX;
    const startOffsetY = offsetY;
    const metrics = pageMetrics();
    const startRect = wrapperRef.current?.getBoundingClientRect();

    const onMove = (moveEvent: MouseEvent) => {
      let nextX = startOffsetX + (moveEvent.clientX - startX);
      let nextY = startOffsetY + (moveEvent.clientY - startY);
      const active: Guide[] = [];

      if (metrics && startRect && !moveEvent.altKey) {
        const boxWidth = startRect.width;
        const movedLeft = startRect.left + (nextX - startOffsetX);
        const movedCentre = movedLeft + boxWidth / 2;
        const movedRight = movedLeft + boxWidth;
        const guideBox = {
          top: metrics.rect.top,
          left: metrics.rect.left,
          width: metrics.rect.width,
          height: metrics.rect.height,
        };

        const snapTo = (current: number, target: number) => {
          if (Math.abs(current - target) > SNAP_DISTANCE) return null;
          return nextX + (target - current);
        };

        const leftSnap = snapTo(movedLeft, metrics.contentLeft);
        const centreSnap = snapTo(movedCentre, metrics.contentCenter);
        const rightSnap = snapTo(movedRight, metrics.contentRight);

        if (centreSnap !== null) {
          nextX = centreSnap;
          active.push({ x: metrics.contentCenter, label: 'Centre', ...guideBox });
        } else if (leftSnap !== null) {
          nextX = leftSnap;
          active.push({ x: metrics.contentLeft, label: 'Left margin', ...guideBox });
        } else if (rightSnap !== null) {
          nextX = rightSnap;
          active.push({ x: metrics.contentRight, label: 'Right margin', ...guideBox });
        }

        // Vertical: snap to the baseline grid so a picture lines up with text.
        const gridRemainder = nextY % LINE_GRID;
        if (Math.abs(gridRemainder) <= SNAP_DISTANCE) {
          nextY -= gridRemainder;
          active.push({
            y: startRect.top + (nextY - startOffsetY),
            label: 'Baseline',
            ...guideBox,
          });
        }
      }

      setGuides(active);
      updateAttributes({ offsetX: Math.round(nextX), offsetY: Math.round(nextY) });
    };

    const onUp = () => {
      setDragging(false);
      clearGuides();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const filters = useMemo(() => {
    const parts: string[] = [];
    if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
    if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
    if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
    return parts.join(' ');
  }, [brightness, contrast, saturation]);

  const wrapperStyle: CSSProperties = {
    ...(floating
      ? wrap === 'behind' || wrap === 'front'
        ? { transform: `translate(${offsetX}px, ${offsetY}px)` }
        : { marginLeft: offsetX, marginTop: offsetY }
      : { marginTop: offsetY || undefined }),
    // Stacking order, so two overlapping floats can be reordered.
    ...(z ? { zIndex: z } : {}),
  };

  const imageStyle: CSSProperties = {
    ...(width ? { width: `${width}px` } : { maxWidth: '100%' }),
    ...(height ? { height: `${height}px` } : {}),
    ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
    ...(filters ? { filter: filters } : {}),
    ...(borderColor ? { borderColor } : {}),
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`image-block align-${align} wrap-${wrap} frame-${frame}${selected ? ' is-selected' : ''}${
        dragging ? ' is-dragging' : ''
      }`}
      data-align={align}
      data-wrap={wrap}
      data-testid="image-block"
      style={wrapperStyle}
      onMouseDown={(event: React.MouseEvent) => {
        // A floating picture is dragged by its body. An inline one
        // leaves the event alone so ProseMirror's own drag moves it through the
        // text instead.
        if (floating && (event.target as HTMLElement).tagName === 'IMG') startDrag(event);
      }}
      onClick={select}
    >
      <div className="image-block-inner">
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ''}
          title={title ?? undefined}
          draggable={!floating}
          data-drag-handle={floating ? undefined : ''}
          style={imageStyle}
          onLoad={() => {
            const image = imgRef.current;
            if (!image) return;
            aspectRef.current = image.naturalWidth / Math.max(1, image.naturalHeight);
            if (!width && image.naturalWidth > 480) {
              const scaled = 480;
              updateAttributes({
                width: scaled,
                height: Math.round(scaled / (aspectRef.current || 1)),
              });
            }
          }}
        />
        {selected && (
          <>
            <button
              type="button"
              className="image-rotate-handle"
              onMouseDown={startRotate}
              title="Drag to rotate. Hold Shift for 15° steps."
              aria-label="Rotate picture"
            />
            {HANDLES.map((handle) => (
              <span
                key={handle}
                className={`image-resize-handle ${handle}`}
                onMouseDown={(event) => startResize(event, handle)}
                title={
                  CORNER_HANDLES.has(handle)
                    ? 'Drag to resize. Hold Shift to release the aspect ratio.'
                    : 'Drag to resize'
                }
              />
            ))}
            <span className="image-size-badge" aria-hidden>
              {Math.round(width ?? imgRef.current?.offsetWidth ?? 0)} ×{' '}
              {Math.round(height ?? imgRef.current?.offsetHeight ?? 0)}
            </span>
          </>
        )}
      </div>

      {guides.length > 0 &&
        createPortal(
          <div className="image-guides" aria-hidden>
            {guides.map((guide, index) => (
              <span
                key={index}
                className={guide.x !== undefined ? 'image-guide-v' : 'image-guide-h'}
                style={
                  guide.x !== undefined
                    ? { left: guide.x, top: guide.top, height: guide.height }
                    : { top: guide.y, left: guide.left, width: guide.width }
                }
                data-label={guide.label}
              />
            ))}
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  );
}
