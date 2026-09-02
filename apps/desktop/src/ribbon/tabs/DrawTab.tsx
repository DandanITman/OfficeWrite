import { Eraser, Highlighter, MousePointer2, PenTool, Trash2 } from 'lucide-react';
import { INK_COLORS, INK_WIDTHS, type InkTool } from '../../extensions/InkDrawing';
import { RibbonButton, RibbonGroup, RibbonLine, RibbonStack } from '../RibbonKit';
import type { RibbonTabProps } from '../types';

const TOOLS: Array<{ id: InkTool; label: string; icon: typeof PenTool; title: string }> = [
  { id: 'select', label: 'Select', icon: MousePointer2, title: 'Select objects instead of drawing' },
  { id: 'pen', label: 'Pen', icon: PenTool, title: 'Draw with the pen' },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter, title: 'Draw with the highlighter' },
  { id: 'eraser', label: 'Eraser', icon: Eraser, title: 'Erase whole strokes' },
];

export function DrawTab({ editor, state, actions, flags }: RibbonTabProps) {
  const { tool, color, width } = flags.ink;

  return (
    <>
      <RibbonGroup label="Tools">
        <RibbonLine>
          {TOOLS.map((entry) => (
            <RibbonButton
              key={entry.id}
              icon={<entry.icon size={20} />}
              label={entry.label}
              title={entry.title}
              size="large"
              active={tool === entry.id}
              onClick={() => actions.onSetInkTool(entry.id)}
              testId={`draw-tool-${entry.id}`}
            />
          ))}
        </RibbonLine>
      </RibbonGroup>

      <RibbonGroup label="Pens">
        <RibbonStack>
          <RibbonLine>
            {INK_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`rb-ink-swatch${color === swatch ? ' is-active' : ''}`}
                style={{ background: swatch }}
                title={`Pen colour ${swatch}`}
                aria-label={`Pen colour ${swatch}`}
                onClick={() => actions.onSetInkColor(swatch)}
                data-testid={`draw-color-${swatch}`}
              />
            ))}
          </RibbonLine>
          <RibbonLine>
            {INK_WIDTHS.map((size) => (
              <button
                key={size}
                type="button"
                className={`rb-ink-width${width === size ? ' is-active' : ''}`}
                title={`${size} pt pen`}
                aria-label={`${size} point pen`}
                onClick={() => actions.onSetInkWidth(size)}
                data-testid={`draw-width-${size}`}
              >
                <span style={{ height: Math.min(10, size), width: 22, background: 'currentColor', borderRadius: 999 }} />
              </button>
            ))}
          </RibbonLine>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Canvas">
        <RibbonStack>
          <RibbonButton
            icon={<Trash2 size={14} />}
            label="Delete Drawing"
            title="Delete the selected drawing canvas"
            disabled={!state.inkActive}
            onClick={() => editor?.chain().focus().deleteSelection().run()}
            testId="draw-delete-canvas"
          />
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
