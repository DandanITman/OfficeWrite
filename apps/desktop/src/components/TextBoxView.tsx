import { useRef, type CSSProperties } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

/**
 * Insert > Text Box.
 *
 * The box carries the same alignment, wrap and offset attributes as a picture,
 * so Layout's Arrange group and the drag behaviour work on both.
 */
export function TextBoxView({ node, updateAttributes, selected }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {
    boxStyle = 'simple',
    width = 300,
    height = null,
    align = 'left',
    wrap = 'square',
    offsetX = 0,
    offsetY = 0,
    fill = '#ffffff',
    borderColor = '#8faadc',
    z = 0,
  } = node.attrs as {
    boxStyle?: string;
    width?: number;
    height?: number | null;
    align?: string;
    wrap?: string;
    offsetX?: number;
    offsetY?: number;
    fill?: string;
    borderColor?: string;
    z?: number;
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const box = wrapperRef.current;
    if (!box) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = box.offsetWidth;
    const startHeight = box.offsetHeight;

    const onMove = (moveEvent: MouseEvent) => {
      updateAttributes({
        width: Math.max(120, Math.round(startWidth + moveEvent.clientX - startX)),
        height: Math.max(60, Math.round(startHeight + moveEvent.clientY - startY)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startDrag = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = offsetX;
    const originY = offsetY;

    const onMove = (moveEvent: MouseEvent) => {
      updateAttributes({
        offsetX: Math.round(originX + moveEvent.clientX - startX),
        offsetY: Math.round(originY + moveEvent.clientY - startY),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const style: CSSProperties = {
    width,
    ...(height ? { minHeight: height } : {}),
    background: fill,
    borderColor,
    marginLeft: offsetX,
    marginTop: offsetY,
    // Arrange's Bring Forward / Send Backward writes this; without it here the
    // buttons were enabled and silently did nothing.
    ...(z ? { zIndex: z } : {}),
  };

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`doc-text-box style-${boxStyle} align-${align} wrap-${wrap}${selected ? ' is-selected' : ''}`}
      data-testid="text-box"
      style={style}
    >
      <span
        className="text-box-drag-handle"
        onMouseDown={startDrag}
        title="Drag to move the text box"
        aria-hidden
      >
        ⠿
      </span>
      <NodeViewContent className="text-box-content" />
      <span
        className="text-box-resize-handle"
        onMouseDown={startResize}
        title="Drag to resize the text box"
        aria-hidden
      />
    </NodeViewWrapper>
  );
}
