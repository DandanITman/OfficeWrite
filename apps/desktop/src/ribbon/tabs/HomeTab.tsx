import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  Bold,
  CaseSensitive,
  ClipboardPaste,
  Copy,
  Eraser,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Paintbrush,
  Pilcrow,
  PilcrowLeft,
  PilcrowRight,
  Scissors,
  Search,
  Sparkles,
  Strikethrough,
  Subscript,
  Superscript,
  Type,
  Underline,
} from 'lucide-react';
import { BUILTIN_STYLES, STYLE_SETS } from '@officewrite/core';
import { ColorPickerButton } from '../../components/ColorPickerButton';
import {
  BORDER_COLORS,
  FONT_COLORS,
  HIGHLIGHT_COLORS,
  SHADING_COLORS,
} from '../../constants/colorSwatches';
import { availableFonts } from '../../constants/fonts';
import { applyDocumentStyle } from '../../utils/applyStyle';
import { copySelection, cutSelection } from '../../utils/clipboard';
import { FONT_SIZES, TEXT_EFFECTS, UNDERLINE_STYLES } from '../../extensions/CharacterFormatting';
import { BULLET_STYLES, MULTILEVEL_SCHEMES, NUMBER_STYLES } from '../../extensions/ListFormatting';
import {
  RibbonButton,
  RibbonCombo,
  RibbonGroup,
  RibbonLine,
  RibbonMenuButton,
  RibbonMenuHeader,
  RibbonMenuItem,
  RibbonMenuSeparator,
  RibbonSeparator,
  RibbonSplitButton,
  RibbonStack,
} from '../RibbonKit';
import type { RibbonTabProps } from '../types';

const LINE_SPACINGS = [
  { id: '1', label: '1.0' },
  { id: '1.15', label: '1.15' },
  { id: '1.5', label: '1.5' },
  { id: '2', label: '2.0' },
  { id: '2.5', label: '2.5' },
  { id: '3', label: '3.0' },
];

export function HomeTab({ editor, state, actions, flags }: RibbonTabProps) {
  const styleGallery = flags.customStyles.length ? flags.customStyles : BUILTIN_STYLES;
  // The desktop Styles group is a gallery with the active style lit, not a
  // separate "current style" box - the highlighted tile is the readout.
  const quickStyles = styleGallery.filter((style) => style.kind !== 'character').slice(0, 4);

  const changeCase = (mode: 'sentence' | 'lower' | 'upper' | 'capitalise' | 'toggle') => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, ' ');
    const next =
      mode === 'lower'
        ? text.toLowerCase()
        : mode === 'upper'
          ? text.toUpperCase()
          : mode === 'sentence'
            ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
            : mode === 'capitalise'
              ? text.replace(/\p{L}[\p{L}'’]*/gu, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
              : text.replace(/\p{L}/gu, (char) =>
                  char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase(),
                );
    editor.chain().focus().insertContentAt({ from, to }, next).run();
  };

  return (
    <>
      <RibbonGroup label="Clipboard">
        <RibbonSplitButton
          icon={<ClipboardPaste size={22} className="icon-paste" />}
          label="Paste"
          title="Paste (Ctrl+V)"
          onClick={() => actions.onPaste('default')}
          testId="ribbon-paste"
          menuLabel="Paste Options"
        >
          <RibbonMenuHeader label="Paste Options" />
          <RibbonMenuItem label="Keep Source Formatting" onClick={() => actions.onPaste('default')} />
          <RibbonMenuItem label="Merge Formatting" onClick={() => actions.onPaste('match')} />
          <RibbonMenuItem
            label="Keep Text Only"
            hint="Ctrl+Shift+V"
            onClick={() => actions.onPaste('text')}
            testId="paste-text-only"
          />
        </RibbonSplitButton>
        <RibbonStack>
          <RibbonButton
            icon={<Scissors size={14} className="icon-cut" />}
            label="Cut"
            title="Cut (Ctrl+X)"
            onClick={() => editor && void cutSelection(editor)}
            testId="ribbon-cut"
          />
          <RibbonButton
            icon={<Copy size={14} className="icon-copy" />}
            label="Copy"
            title="Copy (Ctrl+C)"
            onClick={() => editor && void copySelection(editor)}
            testId="ribbon-copy"
          />
          <RibbonButton
            icon={<Paintbrush size={14} className="icon-painter" />}
            label="Format Painter"
            title="Format Painter (Ctrl+Shift+C, then Ctrl+Shift+V)"
            active={flags.formatPainterActive}
            onClick={() =>
              flags.formatPainterActive ? actions.onFormatPainterApply() : actions.onFormatPainterCopy()
            }
            testId="ribbon-format-painter"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Font" onLaunch={actions.onOpenFontDialog} launchTitle="Font dialog">
        <RibbonStack>
          <RibbonLine>
            <RibbonCombo
              value={state.fontFamily}
              options={availableFonts()}
              listId="home-font-family"
              title="Font"
              width={132}
              previewFont
              testId="ribbon-font-family"
              onCommit={(value) => editor?.chain().focus().setFontFamily(value).run()}
            />
            <RibbonCombo
              value={state.fontSize}
              options={FONT_SIZES}
              listId="home-font-size"
              title="Font Size"
              width={54}
              testId="ribbon-font-size"
              onCommit={(value) => {
                const size = Number(value);
                if (Number.isFinite(size) && size > 0) {
                  editor?.chain().focus().setFontSize(`${size}pt`).run();
                }
              }}
            />
            <RibbonButton
              icon={<span className="rb-glyph">A▴</span>}
              title="Grow Font (Ctrl+>)"
              size="icon"
              onClick={() => editor?.chain().focus().stepFontSize(1).run()}
              testId="ribbon-grow-font"
            />
            <RibbonButton
              icon={<span className="rb-glyph rb-glyph-sm">A▾</span>}
              title="Shrink Font (Ctrl+<)"
              size="icon"
              onClick={() => editor?.chain().focus().stepFontSize(-1).run()}
              testId="ribbon-shrink-font"
            />
            <RibbonMenuButton
              icon={<CaseSensitive size={15} />}
              title="Change Case"
              size="icon"
              testId="ribbon-change-case"
            >
              <RibbonMenuItem label="Sentence case." onClick={() => changeCase('sentence')} />
              <RibbonMenuItem label="lowercase" onClick={() => changeCase('lower')} />
              <RibbonMenuItem label="UPPERCASE" onClick={() => changeCase('upper')} />
              <RibbonMenuItem label="Capitalise Each Word" onClick={() => changeCase('capitalise')} />
              <RibbonMenuItem label="tOGGLE cASE" onClick={() => changeCase('toggle')} />
            </RibbonMenuButton>
            <RibbonButton
              icon={<Eraser size={15} />}
              title="Clear All Formatting"
              size="icon"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .clearNodes()
                  .unsetAllMarks()
                  .clearParagraphFormatting()
                  .run()
              }
              testId="ribbon-clear-formatting"
            />
          </RibbonLine>
          <RibbonLine>
            <RibbonButton
              icon={<Bold size={14} className="icon-bold" />}
              title="Bold (Ctrl+B)"
              size="icon"
              active={state.bold}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              testId="ribbon-bold"
            />
            <RibbonButton
              icon={<Italic size={14} className="icon-italic" />}
              title="Italic (Ctrl+I)"
              size="icon"
              active={state.italic}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              testId="ribbon-italic"
            />
            {/* A split button, as a word processor has it: clicking the U toggles the
                underline, and only the chevron opens the style list. As a plain
                menu button there was no way to underline in one click. */}
            <RibbonSplitButton
              icon={<Underline size={14} className="icon-underline" />}
              label=""
              title="Underline (Ctrl+U)"
              size="small"
              active={state.underline}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              testId="ribbon-underline"
              menuLabel="Underline style"
            >
              <RibbonMenuHeader label="Underline style" />
              {UNDERLINE_STYLES.map((style) => (
                <RibbonMenuItem
                  key={style.id}
                  label={style.label}
                  checked={state.underline && state.underlineStyle === style.id}
                  onClick={() => editor?.chain().focus().setUnderlineStyle(style.id).run()}
                />
              ))}
              <RibbonMenuSeparator />
              <RibbonMenuItem
                label="No Underline"
                onClick={() => editor?.chain().focus().unsetUnderline().run()}
              />
            </RibbonSplitButton>
            <RibbonButton
              icon={<Strikethrough size={14} />}
              title="Strikethrough"
              size="icon"
              active={state.strike}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              testId="ribbon-strike"
            />
            <RibbonButton
              icon={<Subscript size={14} />}
              title="Subscript (Ctrl+=)"
              size="icon"
              active={state.subscript}
              onClick={() => editor?.chain().focus().toggleSubscript().run()}
              testId="ribbon-subscript"
            />
            <RibbonButton
              icon={<Superscript size={14} />}
              title="Superscript (Ctrl+Shift++)"
              size="icon"
              active={state.superscript}
              onClick={() => editor?.chain().focus().toggleSuperscript().run()}
              testId="ribbon-superscript"
            />
            <RibbonMenuButton
              icon={<Sparkles size={14} />}
              title="Text Effects and Typography"
              size="icon"
              active={Boolean(state.textEffect)}
              testId="ribbon-text-effects"
            >
              <RibbonMenuHeader label="Text effects" />
              {TEXT_EFFECTS.map((effect) => (
                <RibbonMenuItem
                  key={effect.id}
                  label={effect.label}
                  checked={state.textEffect === effect.id}
                  onClick={() => editor?.chain().focus().setTextEffect(effect.id).run()}
                />
              ))}
              <RibbonMenuSeparator />
              <RibbonMenuItem
                label="Small Caps"
                checked={state.smallCaps}
                onClick={() => editor?.chain().focus().setCaps(state.smallCaps ? 'none' : 'small').run()}
              />
              <RibbonMenuItem
                label="All Caps"
                checked={state.allCaps}
                onClick={() => editor?.chain().focus().setCaps(state.allCaps ? 'none' : 'all').run()}
              />
            </RibbonMenuButton>
            <ColorPickerButton
              title="Text Highlight Color"
              colors={HIGHLIGHT_COLORS}
              value={state.highlight}
              className={`rb-btn rb-btn--icon${state.highlight ? ' is-active' : ''}`}
              onSelect={(color) => {
                if (!editor) return;
                if (!color) editor.chain().focus().unsetHighlight().run();
                else editor.chain().focus().setHighlight({ color }).run();
              }}
            >
              <Highlighter size={15} className="icon-highlight" />
            </ColorPickerButton>
            <ColorPickerButton
              title="Font Color"
              colors={FONT_COLORS}
              value={state.color}
              className="rb-btn rb-btn--icon"
              onSelect={(color) => {
                if (!editor) return;
                if (!color) editor.chain().focus().unsetColor().run();
                else editor.chain().focus().setColor(color).run();
              }}
            >
              <Type size={15} className="icon-color" />
            </ColorPickerButton>
          </RibbonLine>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup
        label="Paragraph"
        onLaunch={actions.onOpenParagraphDialog}
        launchTitle="Paragraph dialog"
      >
        <RibbonStack>
          <RibbonLine>
            <RibbonSplitButton
              size="small"
              icon={<List size={14} />}
              label=""
              title="Bullets"
              active={state.bulletList}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              testId="ribbon-bullet-list"
              menuLabel="Bullet Library"
            >
              <RibbonMenuHeader label="Bullet library" />
              <div className="rb-bullet-grid">
                {BULLET_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    className={`rb-bullet-swatch${state.listStyle === style.id ? ' is-active' : ''}`}
                    title={style.id}
                    onClick={() => editor?.chain().focus().applyBulletStyle(style.id).run()}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              <RibbonMenuSeparator />
              <RibbonMenuItem
                label="None"
                onClick={() => editor?.chain().focus().liftListItem('listItem').run()}
              />
            </RibbonSplitButton>
            <RibbonSplitButton
              size="small"
              icon={<ListOrdered size={14} />}
              label=""
              title="Numbering"
              active={state.orderedList}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              testId="ribbon-ordered-list"
              menuLabel="Numbering Library"
            >
              <RibbonMenuHeader label="Numbering library" />
              {NUMBER_STYLES.map((style) => (
                <RibbonMenuItem
                  key={style.id}
                  label={style.label}
                  checked={state.orderedList && state.listStyle === style.id}
                  onClick={() => editor?.chain().focus().applyNumberStyle(style.id).run()}
                />
              ))}
            </RibbonSplitButton>
            <RibbonButton
              icon={<ListChecks size={14} />}
              title="Checklist"
              size="icon"
              active={editor?.isActive('taskList') ?? false}
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
              testId="ribbon-checklist"
            />
            <RibbonMenuButton
              icon={<ListTree size={14} />}
              title="Multilevel List"
              size="icon"
              testId="ribbon-multilevel-list"
            >
              <RibbonMenuHeader label="List library" />
              {MULTILEVEL_SCHEMES.map((scheme) => (
                <RibbonMenuItem
                  key={scheme.id}
                  label={scheme.label}
                  onClick={() => editor?.chain().focus().applyMultilevelScheme(scheme.id).run()}
                />
              ))}
              <RibbonMenuSeparator />
              <RibbonMenuItem
                label="Increase List Level"
                hint="Tab"
                onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}
              />
              <RibbonMenuItem
                label="Decrease List Level"
                hint="Shift+Tab"
                onClick={() => editor?.chain().focus().liftListItem('listItem').run()}
              />
            </RibbonMenuButton>
            <RibbonSeparator />
            <RibbonButton
              icon={<span className="rb-glyph">⇤</span>}
              title="Decrease Indent (Ctrl+Shift+M)"
              size="icon"
              onClick={() => editor?.chain().focus().decreaseParagraphIndent().run()}
              testId="ribbon-decrease-indent"
            />
            <RibbonButton
              icon={<span className="rb-glyph">⇥</span>}
              title="Increase Indent (Ctrl+M)"
              size="icon"
              onClick={() => editor?.chain().focus().increaseParagraphIndent().run()}
              testId="ribbon-increase-indent"
            />
            <RibbonMenuButton
              icon={<ArrowDownAZ size={14} />}
              title="Sort"
              size="icon"
              testId="ribbon-sort"
            >
              <RibbonMenuItem label="Sort Ascending (A to Z)" onClick={() => actions.onSortParagraphs('asc')} />
              <RibbonMenuItem label="Sort Descending (Z to A)" onClick={() => actions.onSortParagraphs('desc')} />
            </RibbonMenuButton>
            <RibbonButton
              icon={<PilcrowLeft size={14} />}
              title="Left-to-Right Text Direction"
              size="icon"
              active={state.textDirection !== 'rtl'}
              onClick={() => editor?.chain().focus().setTextDirection('ltr').run()}
              testId="ribbon-direction-ltr"
            />
            <RibbonButton
              icon={<PilcrowRight size={14} />}
              title="Right-to-Left Text Direction"
              size="icon"
              active={state.textDirection === 'rtl'}
              onClick={() => editor?.chain().focus().setTextDirection('rtl').run()}
              testId="ribbon-direction-rtl"
            />
            <RibbonButton
              icon={<Pilcrow size={14} />}
              title="Show/Hide Formatting Marks (Ctrl+*)"
              size="icon"
              active={flags.showFormattingMarks}
              onClick={actions.onToggleFormattingMarks}
              testId="ribbon-formatting-marks"
            />
          </RibbonLine>
          <RibbonLine>
            {(
              [
                ['left', AlignLeft, 'Align Left (Ctrl+L)', 'ribbon-align-left'],
                ['center', AlignCenter, 'Center (Ctrl+E)', 'ribbon-align-center'],
                ['right', AlignRight, 'Align Right (Ctrl+R)', 'ribbon-align-right'],
                ['justify', AlignJustify, 'Justify (Ctrl+J)', 'ribbon-align-justify'],
              ] as const
            ).map(([value, Icon, label, testId]) => (
              <RibbonButton
                key={value}
                icon={<Icon size={15} />}
                title={label}
                size="icon"
                active={state.align === value}
                onClick={() => editor?.chain().focus().setTextAlign(value).run()}
                testId={testId}
              />
            ))}
            <RibbonMenuButton
              icon={<span className="rb-glyph">⇕</span>}
              title="Line and Paragraph Spacing"
              size="icon"
              testId="ribbon-line-spacing"
            >
              <RibbonMenuHeader label="Line spacing" />
              {LINE_SPACINGS.map((option) => (
                <RibbonMenuItem
                  key={option.id}
                  label={option.label}
                  checked={state.lineHeight === option.id}
                  onClick={() => editor?.chain().focus().setLineSpacing(option.id).run()}
                />
              ))}
              <RibbonMenuSeparator />
              <RibbonMenuItem
                label={state.spaceBefore > 0 ? 'Remove Space Before Paragraph' : 'Add Space Before Paragraph'}
                onClick={() => editor?.chain().focus().toggleSpaceBefore().run()}
              />
              <RibbonMenuItem
                label={state.spaceAfter > 0 ? 'Remove Space After Paragraph' : 'Add Space After Paragraph'}
                onClick={() => editor?.chain().focus().toggleSpaceAfter().run()}
              />
              <RibbonMenuSeparator />
              <RibbonMenuItem label="Line Spacing Options…" onClick={actions.onOpenParagraphDialog} />
            </RibbonMenuButton>
            <ColorPickerButton
              title="Shading"
              colors={SHADING_COLORS}
              value={state.shading}
              className="rb-btn rb-btn--icon"
              onSelect={(color) => editor?.chain().focus().setParagraphShading(color).run()}
            >
              <span className="rb-glyph">▨</span>
            </ColorPickerButton>
            <RibbonMenuButton
              icon={<span className="rb-glyph">▣</span>}
              title="Borders"
              size="icon"
              testId="ribbon-borders"
            >
              <RibbonMenuHeader label="Borders" />
              {(
                [
                  ['left', 'Left Border'],
                  ['top', 'Top Border'],
                  ['bottom', 'Bottom Border'],
                  ['all', 'All Borders'],
                ] as const
              ).map(([side, label]) => (
                <RibbonMenuItem
                  key={side}
                  label={label}
                  onClick={() =>
                    editor?.chain().focus().setParagraphBorder(state.borderColor ?? '#64748b', side).run()
                  }
                />
              ))}
              <RibbonMenuItem
                label="No Border"
                onClick={() => editor?.chain().focus().setParagraphBorder(null).run()}
              />
              <RibbonMenuSeparator />
              <RibbonMenuItem label="Borders and Shading…" onClick={actions.onOpenBordersDialog} />
            </RibbonMenuButton>
            <ColorPickerButton
              title="Border Color"
              colors={BORDER_COLORS}
              value={state.borderColor}
              className="rb-btn rb-btn--icon"
              onSelect={(color) => editor?.chain().focus().setParagraphBorder(color).run()}
            >
              <span className="rb-glyph">▭</span>
            </ColorPickerButton>
          </RibbonLine>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Styles" onLaunch={actions.onOpenStyleEditor} launchTitle="Styles pane">
        <div className="rb-style-gallery">
          {/* A word processor leads Styles with a live tile gallery, so applying Heading 1
              is one click. The caret's current style stays as the first tile,
              and the full list is still behind More. */}
          {quickStyles.map((style) => (
            <button
              key={`tile-${style.id}`}
              type="button"
              className={`rb-style-tile${state.styleId === style.id ? ' is-active' : ''}`}
              title={style.name}
              data-testid={`style-tile-${style.id}`}
              onClick={() => editor && applyDocumentStyle(editor, style)}
            >
              <span
                className="rb-style-preview"
                style={{
                  fontFamily: style.fontFamily,
                  fontWeight: style.bold ? 700 : 400,
                  fontStyle: style.italic ? 'italic' : 'normal',
                  color: style.color,
                }}
              >
                Aa
              </span>
              <span className="rb-style-name">{style.name}</span>
            </button>
          ))}
          {/* Labelled, because at compact density the tiles fold away and this
              becomes the whole group - an unlabelled "T" is what the gallery
              replaced in the first place. */}
          <RibbonMenuButton
            icon={<Type size={14} />}
            label="Styles"
            title="Styles"
            testId="ribbon-more-styles"
            menuWidth={260}
          >
            <RibbonMenuHeader label="Styles" />
            {quickStyles.map((style) => (
              <RibbonMenuItem
                key={`quick-${style.id}`}
                label={style.name}
                checked={state.styleId === style.id}
                onClick={() => editor && applyDocumentStyle(editor, style)}
                testId={`edit-style-${style.id}`}
              />
            ))}
            <RibbonMenuSeparator />
            <RibbonMenuHeader label="All styles" />
            {styleGallery.map((style) => (
              <RibbonMenuItem
                key={style.id}
                label={style.name}
                hint={style.kind === 'character' ? 'Character style' : undefined}
                checked={state.styleId === style.id}
                onClick={() => editor && applyDocumentStyle(editor, style)}
                testId={`style-menu-${style.id}`}
              />
            ))}
            <RibbonMenuSeparator />
            <RibbonMenuItem label="Manage Styles…" onClick={actions.onOpenStyleEditor} />
            <RibbonMenuSeparator />
            {/* Rescued from the removed Design tab: the only control that
                restyles the paragraphs already in the document, not just the
                gallery. */}
            <RibbonMenuHeader label="Style set" />
            {STYLE_SETS.map((set) => (
              <RibbonMenuItem
                key={set.id}
                label={set.name}
                checked={flags.styleSetId === set.id}
                onClick={() => actions.onApplyStyleSet(set.id)}
                testId={`style-set-${set.id}`}
              />
            ))}
          </RibbonMenuButton>
        </div>
      </RibbonGroup>

      <RibbonGroup label="Editing">
        <RibbonStack>
          {/* The Find is a split button whose menu carries Go To. */}
          <RibbonSplitButton
            icon={<Search size={14} />}
            label="Find"
            title="Find (Ctrl+F)"
            size="small"
            onClick={() => actions.onToggleFindReplace('find')}
            testId="ribbon-find"
          >
            <RibbonMenuItem
              label="Find…"
              hint="Ctrl+F"
              onClick={() => actions.onToggleFindReplace('find')}
            />
            <RibbonMenuItem
              label="Go To…"
              hint="Ctrl+G"
              onClick={actions.onOpenGoTo}
              testId="ribbon-go-to"
            />
          </RibbonSplitButton>
          <RibbonButton
            icon={<span className="rb-glyph">⇄</span>}
            label="Replace"
            title="Replace (Ctrl+H)"
            onClick={() => actions.onToggleFindReplace('replace')}
            testId="ribbon-replace"
          />
          <RibbonMenuButton icon={<span className="rb-glyph">▤</span>} label="Select" title="Select">
            <RibbonMenuItem
              label="Select All"
              hint="Ctrl+A"
              onClick={() => editor?.chain().focus().selectAll().run()}
              testId="ribbon-select-all"
            />
            <RibbonMenuItem
              label="Select Paragraph"
              onClick={() => editor?.chain().focus().selectParentNode().run()}
            />
          </RibbonMenuButton>
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
