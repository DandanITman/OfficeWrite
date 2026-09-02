import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

const SHAPES = ['rect', 'circle', 'triangle', 'line', 'arrow'] as const;

export function ShapeBlockView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const {
    shapeType,
    width,
    height,
    fill,
    stroke,
    strokeWidth,
    align = 'left',
    wrap = 'inline',
    z = 0,
  } = node.attrs as {
    shapeType: (typeof SHAPES)[number];
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    align?: string;
    wrap?: string;
    z?: number;
  };

  const renderSvg = () => {
    const sw = strokeWidth;
    switch (shapeType) {
      case 'circle':
        return (
          <ellipse cx={width / 2} cy={height / 2} rx={width / 2 - sw} ry={height / 2 - sw} fill={fill} stroke={stroke} strokeWidth={sw} />
        );
      case 'triangle':
        return (
          <polygon
            points={`${width / 2},${sw} ${width - sw},${height - sw} ${sw},${height - sw}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      case 'line':
        return <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={stroke} strokeWidth={sw + 1} />;
      case 'arrow':
        return (
          <>
            <line x1={8} y1={height / 2} x2={width - 16} y2={height / 2} stroke={stroke} strokeWidth={sw + 1} />
            <polygon
              points={`${width - 16},${height / 2 - 10} ${width},${height / 2} ${width - 16},${height / 2 + 10}`}
              fill={stroke}
            />
          </>
        );
      default:
        return (
          <rect x={sw / 2} y={sw / 2} width={width - sw} height={height - sw} fill={fill} stroke={stroke} strokeWidth={sw} rx={4} />
        );
    }
  };

  return (
    <NodeViewWrapper
      className={`shape-block align-${align} wrap-${wrap}${selected ? ' is-selected' : ''}`}
      style={z ? { zIndex: z } : undefined}
      onClick={() => {
        const pos = getPos();
        if (typeof pos === 'number') editor.chain().focus().setNodeSelection(pos).run();
      }}
    >
      <div className="shape-block-inner" style={{ width, height }}>
        <svg width={width} height={height} aria-hidden>
          {renderSvg()}
        </svg>
        {selected && (
          <div className="shape-toolbar">
            {SHAPES.map((s) => (
              <button
                key={s}
                type="button"
                className={shapeType === s ? 'active' : ''}
                onClick={() => updateAttributes({ shapeType: s })}
              >
                {s[0].toUpperCase()}
              </button>
            ))}
            <input type="color" value={fill} onChange={(e) => updateAttributes({ fill: e.target.value })} title="Fill" />
            <input type="color" value={stroke} onChange={(e) => updateAttributes({ stroke: e.target.value })} title="Stroke" />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
