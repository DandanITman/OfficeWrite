import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BringToFront,
  Columns3,
  Eye,
  Hash,
  LayoutTemplate,
  Minus,
  Palette,
  RectangleHorizontal,
  RectangleVertical,
  SendToBack,
  SeparatorHorizontal,
  Square,
  Stamp,
} from 'lucide-react';
import {
  MARGIN_PRESETS,
  MARGIN_PRESET_HINTS,
  PAGE_SIZE_LABELS,
  type PageSizePreset,
} from '@officewrite/core';
import { ColorPickerButton } from '../../components/ColorPickerButton';
import { SHADING_COLORS } from '../../constants/colorSwatches';
import {
  RibbonButton,
  RibbonGroup,
  RibbonLine,
  RibbonMenuButton,
  RibbonMenuHeader,
  RibbonMenuItem,
  RibbonMenuSeparator,
  RibbonSpin,
  RibbonStack,
} from '../RibbonKit';
import type { RibbonTabProps } from '../types';

/** Pixels per inch, so the spin boxes can show inches. */
const PPI = 96;
/** CSS px are 1/96in and points are 1/72in, so a point is 4/3 px. */
const pxToPt = (px: number) => Math.round((px * 72) / PPI * 10) / 10;
const ptToPx = (pt: number) => Math.round((pt * PPI) / 72);

/** The wraps a shape or text box supports, as they are conventionally worded. */
const OBJECT_WRAPS = [
  { id: 'inline', label: 'In Line with Text' },
  { id: 'square', label: 'Square' },
  { id: 'tight', label: 'Tight' },
  { id: 'topBottom', label: 'Top and Bottom' },
  { id: 'behind', label: 'Behind Text' },
  { id: 'front', label: 'In Front of Text' },
] as const;

export function LayoutTab({ editor, state, actions, flags }: RibbonTabProps) {
  const { pageSetup } = flags;

  /** Arrange drives whichever object type is selected. */
  const objectNode = () => (state.shapeActive ? 'docShape' : 'textBox');

  const setObjectAttrs = (attrs: Record<string, unknown>) => {
    if (!editor) return;
    editor.chain().focus().updateAttributes(objectNode(), attrs).run();
  };

  /** The Bring Forward / Send Backward, one step at a time. */
  const stepObjectZ = (delta: number) => {
    if (!editor) return;
    const current = Number(editor.getAttributes(objectNode()).z ?? 0);
    setObjectAttrs({ z: current + delta });
  };

  return (
    <>
      <RibbonGroup label="Page Setup" onLaunch={actions.onOpenPageSetup} launchTitle="Page Setup dialog">
        <RibbonLine>
          <RibbonMenuButton
            icon={<LayoutTemplate size={20} />}
            label="Margins"
            title="Margins"
            size="large"
            testId="layout-margins"
            menuWidth={240}
          >
            <RibbonMenuHeader label="Margins" />
            {Object.keys(MARGIN_PRESETS).map((preset) => (
              <RibbonMenuItem
                key={preset}
                label={preset}
                hint={MARGIN_PRESET_HINTS[preset]?.replace('\n', '  ')}
                onClick={() => actions.onApplyMarginPreset(preset)}
                testId={`layout-margin-${preset.toLowerCase()}`}
              />
            ))}
            <RibbonMenuSeparator />
            <RibbonMenuItem label="Custom Margins…" onClick={actions.onOpenPageSetup} />
          </RibbonMenuButton>
          <RibbonMenuButton
            icon={<RectangleVertical size={20} />}
            label="Orientation"
            title="Orientation"
            size="large"
            testId="layout-orientation"
          >
            <RibbonMenuItem
              icon={<RectangleVertical size={13} />}
              label="Portrait"
              checked={pageSetup.orientation === 'portrait'}
              onClick={() => actions.onSetOrientation('portrait')}
            />
            <RibbonMenuItem
              icon={<RectangleHorizontal size={13} />}
              label="Landscape"
              checked={pageSetup.orientation === 'landscape'}
              onClick={() => actions.onSetOrientation('landscape')}
            />
          </RibbonMenuButton>
          <RibbonMenuButton
            icon={<RectangleHorizontal size={20} />}
            label="Size"
            title="Page size"
            size="large"
            testId="layout-size"
            menuWidth={230}
          >
            <RibbonMenuHeader label="Page size" />
            {(Object.keys(PAGE_SIZE_LABELS) as PageSizePreset[]).map((size) => (
              <RibbonMenuItem
                key={size}
                label={PAGE_SIZE_LABELS[size]}
                checked={pageSetup.size === size}
                onClick={() => actions.onSetPageSize(size)}
                testId={`layout-size-${size}`}
              />
            ))}
            <RibbonMenuSeparator />
            <RibbonMenuItem label="More Paper Sizes…" onClick={actions.onOpenPageSetup} />
          </RibbonMenuButton>
          <RibbonMenuButton
            icon={<Columns3 size={20} />}
            label="Columns"
            title="Columns"
            size="large"
            testId="layout-columns"
          >
            <RibbonMenuItem label="One" checked={pageSetup.columns.count === 1} onClick={() => actions.onSetColumns(1)} />
            <RibbonMenuItem label="Two" checked={pageSetup.columns.count === 2} onClick={() => actions.onSetColumns(2)} />
            <RibbonMenuItem label="Three" checked={pageSetup.columns.count === 3} onClick={() => actions.onSetColumns(3)} />
            <RibbonMenuSeparator />
            <RibbonMenuItem label="More Columns…" onClick={actions.onOpenColumnsDialog} />
          </RibbonMenuButton>
        </RibbonLine>
        <RibbonStack>
          <RibbonMenuButton
            icon={<SeparatorHorizontal size={14} />}
            label="Breaks"
            title="Breaks"
            testId="layout-breaks"
          >
            <RibbonMenuHeader label="Page breaks" />
            <RibbonMenuItem
              label="Page"
              hint="Ctrl+Enter"
              onClick={() => editor?.chain().focus().insertPageBreak().run()}
            />
            <RibbonMenuItem
              label="Column"
              onClick={() => editor?.chain().focus().insertColumnBreak().run()}
            />
            <RibbonMenuSeparator />
            <RibbonMenuItem
              label="Text Wrapping"
              onClick={() => editor?.chain().focus().setHardBreak().run()}
            />
          </RibbonMenuButton>
          <RibbonMenuButton
            icon={<Hash size={14} />}
            label="Line Numbers"
            title="Line numbers"
            active={pageSetup.lineNumbers !== 'none'}
            testId="layout-line-numbers"
          >
            <RibbonMenuItem
              label="None"
              checked={pageSetup.lineNumbers === 'none'}
              onClick={() => actions.onSetLineNumbers('none')}
            />
            <RibbonMenuItem
              label="Continuous"
              checked={pageSetup.lineNumbers === 'continuous'}
              onClick={() => actions.onSetLineNumbers('continuous')}
            />
            <RibbonMenuItem
              label="Restart Each Page"
              checked={pageSetup.lineNumbers === 'restartEachPage'}
              onClick={() => actions.onSetLineNumbers('restartEachPage')}
            />
          </RibbonMenuButton>
          <RibbonButton
            icon={<Minus size={14} />}
            label="Hyphenation"
            title="Break words across lines to even out the right margin"
            active={pageSetup.hyphenation}
            onClick={actions.onToggleHyphenation}
            testId="layout-hyphenation"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup
        label="Paragraph"
        onLaunch={actions.onOpenParagraphDialog}
        launchTitle="Paragraph dialog"
      >
        <RibbonStack>
          <RibbonSpin
            label="Indent left"
            value={(state.indentLevel * 36) / PPI}
            step={0.25}
            suffix='"'
            testId="layout-indent-left"
            onChange={(value) => {
              const level = Math.max(0, Math.round((value * PPI) / 36));
              const delta = level - state.indentLevel;
              const chain = editor?.chain().focus();
              if (!chain) return;
              for (let step = 0; step < Math.abs(delta); step += 1) {
                if (delta > 0) chain.increaseParagraphIndent();
                else chain.decreaseParagraphIndent();
              }
              chain.run();
            }}
          />
          <RibbonSpin
            label="Indent right"
            value={state.indentRight / PPI}
            step={0.25}
            suffix='"'
            testId="layout-indent-right"
            onChange={(value) => editor?.chain().focus().setRightIndent(Math.round(value * PPI)).run()}
          />
        </RibbonStack>
        <RibbonStack>
          {/*
            Shown in points, as expected: px is a screen unit and means nothing
            on a printed page. The document model stays in px, so this converts
            at the edge and leaves stored documents and the DOCX writer alone.
          */}
          <RibbonSpin
            label="Space before"
            value={pxToPt(state.spaceBefore)}
            step={1}
            suffix="pt"
            testId="layout-space-before"
            onChange={(value) =>
              editor?.chain().focus().setParagraphSpacing(ptToPx(value), state.spaceAfter).run()
            }
          />
          <RibbonSpin
            label="Space after"
            value={pxToPt(state.spaceAfter)}
            step={1}
            suffix="pt"
            testId="layout-space-after"
            onChange={(value) =>
              editor?.chain().focus().setParagraphSpacing(state.spaceBefore, ptToPx(value)).run()
            }
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Page Background">
        <RibbonStack>
          <RibbonButton
            icon={<Stamp size={20} />}
            label="Watermark"
            title="Watermark"
            size="large"
            active={flags.watermarkEnabled}
            onClick={actions.onOpenWatermark}
            testId="layout-watermark"
          />
        </RibbonStack>
        <RibbonStack>
          <ColorPickerButton
            title="Page Color"
            colors={SHADING_COLORS}
            value={flags.pageSetup.pageColor}
            className="rb-btn rb-btn--small"
            onSelect={actions.onSetPageColor}
          >
            <Palette size={14} />
            <span className="rb-btn-label">Page Color</span>
          </ColorPickerButton>
          <RibbonButton
            icon={<Square size={14} />}
            label="Page Borders"
            title="Page borders"
            active={flags.pageSetup.border.style !== 'none'}
            onClick={actions.onOpenPageBorders}
            testId="layout-page-borders"
          />
        </RibbonStack>
      </RibbonGroup>

      {/* A word processor keeps Arrange on Layout for any selected object. A shape or text
          box could be inserted and then never wrapped or positioned, because
          only pictures had a contextual tab. */}
      {(state.shapeActive || state.textBoxActive) && (
        <RibbonGroup label="Arrange">
          <RibbonStack>
            <RibbonMenuButton
              icon={<Eye size={14} />}
              label="Wrap Text"
              title="Wrap text around the object"
              testId="object-wrap-text"
              menuWidth={230}
            >
              {OBJECT_WRAPS.map((wrap) => (
                <RibbonMenuItem
                  key={wrap.id}
                  label={wrap.label}
                  checked={state.objectWrap === wrap.id}
                  onClick={() => setObjectAttrs({ wrap: wrap.id })}
                  testId={`object-wrap-${wrap.id}`}
                />
              ))}
            </RibbonMenuButton>
            <RibbonLine>
              {(
                [
                  ['left', AlignLeft, 'Align Left'],
                  ['center', AlignCenter, 'Align Centre'],
                  ['right', AlignRight, 'Align Right'],
                ] as const
              ).map(([value, Icon, label]) => (
                <RibbonButton
                  key={value}
                  icon={<Icon size={15} />}
                  title={label}
                  size="icon"
                  active={state.objectAlign === value}
                  onClick={() => setObjectAttrs({ align: value })}
                  testId={`object-align-${value}`}
                />
              ))}
              <RibbonButton
                icon={<BringToFront size={15} />}
                title="Bring Forward"
                size="icon"
                onClick={() => stepObjectZ(1)}
                testId="object-bring-forward"
              />
              <RibbonButton
                icon={<SendToBack size={15} />}
                title="Send Backward"
                size="icon"
                onClick={() => stepObjectZ(-1)}
                testId="object-send-backward"
              />
            </RibbonLine>
          </RibbonStack>
        </RibbonGroup>
      )}
    </>
  );
}
