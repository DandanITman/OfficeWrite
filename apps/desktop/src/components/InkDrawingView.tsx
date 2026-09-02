import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { InkStroke, InkTool } from '../extensions/InkDrawing';

/** How close a click must be to a stroke for the eraser to take it. */
const ERASE_RADIUS = 10;

function pathFor(stroke: InkStroke): string {
  let path = '';
  for (let index = 0; index < stroke.points.length; index += 2) {
    path += `${index === 0 ? 'M' : 'L'}${stroke.points[index]} ${stroke.points[index + 1]} `;
  }
  return path.trim();
}

function distanceToStroke(stroke: InkStroke, x: number, y: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < stroke.points.length; index += 2) {
    const dx = stroke.points[index] - x;
    const dy = stroke.points[index + 1] - y;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

/**
 * Draw > Drawing Canvas.
 *
 * The active tool, colour and width come from the Draw tab through the ink
 * settings on the window, rather than through node attributes: the pens are a
 * property of the tool, not of each drawing, so switching pen colour must not
 * rewrite every canvas in the document.
 */
export function InkDrawingView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [liveStroke, setLiveStroke] = useState<InkStroke | null>(null);
  const { width = 560, height = 240, strokes = [] } = node.attrs as {
    width?: number;
    height?: number;
    strokes?: InkStroke[];
  };

  const settings = () => window.__OFFICEWRITE_INK__ ?? { tool: 'pen' as InkTool, color: '#000000', width: 2 };

  const pointFromEvent = (event: PointerEvent | React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * height),
    };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    const { tool, color, width: penWidth } = settings();
    if (tool === 'select') {
      // Select the canvas explicitly so the contextual Draw tab reopens. Only
      // on the select tool - doing it for pen or eraser would fight the stroke
      // handler below for the pointer.
      const pos = typeof getPos === 'function' ? getPos() : null;
      if (pos != null) editor.commands.setNodeSelection(pos);
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const point = pointFromEvent(event);

    if (tool === 'eraser') {
      const remaining = strokes.filter((stroke) => distanceToStroke(stroke, point.x, point.y) > ERASE_RADIUS);
      if (remaining.length !== strokes.length) updateAttributes({ strokes: remaining });
      return;
    }

    const stroke: InkStroke = {
      points: [point.x, point.y],
      color,
      width: tool === 'highlighter' ? Math.max(10, penWidth * 4) : penWidth,
      tool,
    };
    setLiveStroke(stroke);

    const onMove = (moveEvent: PointerEvent) => {
      const next = pointFromEvent(moveEvent);
      setLiveStroke((current) =>
        current ? { ...current, points: [...current.points, next.x, next.y] } : current,
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setLiveStroke((current) => {
        if (current && current.points.length > 2) {
          updateAttributes({ strokes: [...strokes, current] });
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = width;
    const startHeight = height;
    const onMove = (moveEvent: MouseEvent) => {
      updateAttributes({
        width: Math.max(160, Math.round(startWidth + moveEvent.clientX - startX)),
        height: Math.max(100, Math.round(startHeight + moveEvent.clientY - startY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Repaint when the Draw tab changes tools so the cursor hint stays accurate.
  const [, forceRender] = useState(0);
  useEffect(() => {
    const onSettings = () => forceRender((value) => value + 1);
    window.addEventListener('officewrite:ink-settings', onSettings);
    return () => window.removeEventListener('officewrite:ink-settings', onSettings);
  }, []);

  const tool = settings().tool;
  const visible = liveStroke ? [...strokes, liveStroke] : strokes;

  return (
    <NodeViewWrapper
      className={`doc-ink tool-${tool}${selected ? ' is-selected' : ''}`}
      data-testid="ink-drawing"
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={onPointerDown}
        role="img"
        aria-label={`Drawing with ${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}`}
      >
        {visible.map((stroke, index) => (
          <path
            key={index}
            d={pathFor(stroke)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={stroke.tool === 'highlighter' ? 0.35 : 1}
          />
        ))}
      </svg>
      {selected && (
        <span className="ink-resize-handle" onMouseDown={startResize} title="Drag to resize the canvas" />
      )}
    </NodeViewWrapper>
  );
}
