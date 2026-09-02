import type { Editor } from '@tiptap/react';
import type { RibbonTab } from '@officewrite/core';
import type { RibbonActions, RibbonFlags } from './types';
import type { RibbonState } from './useRibbonState';
import { clearWidths, distributeColumns, distributeRows } from '../utils/tableSizing';

/**
 * The command registry behind the header's search box (Alt+Q).
 *
 * Hand-written on purpose. `RibbonActions` is a TypeScript interface with no
 * runtime existence, and more than half the ribbon - bold, the alignments, the
 * lists, indent, line spacing, headings, table insert, page break - calls
 * `editor.chain()` straight from its tab file and never touches `RibbonActions`
 * at all. A registry derived from the actions object would therefore miss most
 * of the ribbon and label the rest with property names.
 *
 * The cost is explicit: a new ribbon button means a new line here. The vitest
 * beside this file catches the two ways that goes wrong.
 */
export interface CommandContext {
  editor: Editor | null;
  actions: RibbonActions;
  flags: RibbonFlags;
  state: RibbonState;
  goToTab: (tab: RibbonTab) => void;
}

export interface RibbonCommand {
  /** `tab.name`, unique across the registry. */
  id: string;
  label: string;
  /** Where the command lives, shown as a "Home > Font" breadcrumb. */
  tab: RibbonTab;
  group: string;
  /** Extra words that should match, for terms people reach for. */
  keywords?: string[];
  shortcut?: string;
  run: (ctx: CommandContext) => void;
  /** Commands that act on a selected object are unusable without one. */
  enabled?: (ctx: CommandContext) => boolean;
}

/** Every editor command focuses first, so it applies to the live selection. */
const chain = (ctx: CommandContext) => ctx.editor?.chain().focus();

/**
 * The groups each tab actually renders, so a command's breadcrumb cannot name
 * a group that does not exist.
 *
 * Five breadcrumbs rotted silently when the ribbon was restructured - Alt+Q
 * was still offering "Home > Undo" and "View > Window" after both groups were
 * deleted - because the test beside this file checked `tab` and never `group`.
 * It does now.
 *
 * Two entries are deliberately not RibbonGroups: undo/redo live in the Quick
 * Access toolbar and Restrict Editing on the tab strip's mode picker, exactly
 * as a word processor places them. They are listed so the breadcrumb still points at a
 * real place.
 */
export const RIBBON_GROUPS: Partial<Record<RibbonTab, readonly string[]>> = {
  file: ['File'],
  home: ['Clipboard', 'Font', 'Paragraph', 'Styles', 'Editing', 'Quick Access'],
  insert: [
    'Pages',
    'Tables',
    'Illustrations',
    'Links',
    'Comments',
    'Header & Footer',
    'Text',
    'Symbols',
  ],
  draw: ['Pens', 'Tools', 'Canvas'],
  pageLayout: ['Page Setup', 'Paragraph', 'Page Background', 'Arrange'],
  references: ['Table of Contents', 'Footnotes', 'Citations & Bibliography', 'Captions', 'Index'],
  mailings: [
    'Create',
    'Start Mail Merge',
    'Write & Insert Fields',
    'Preview Results',
    'Finish',
  ],
  review: [
    'Proofing',
    'Accessibility',
    'Language',
    'Comments',
    'Tracking',
    'Changes',
    'Compare',
  ],
  view: ['Views', 'Immersive', 'Show', 'Dark Mode', 'Zoom', 'Tools'],
  help: ['Help'],
  pictureFormat: ['Adjust', 'Picture Styles', 'Arrange', 'Size', 'Accessibility'],
  tableLayout: [
    'Table',
    'Rows & Columns',
    'Merge',
    'Cell Size',
    'Alignment',
    'Data',
    'Table Styles',
  ],
};

export function buildCommands(): RibbonCommand[] {
  return [
    // ---- File ----
    { id: 'file.new', label: 'New document', tab: 'file', group: 'File', shortcut: 'Ctrl+N', run: (c) => c.actions.onNew() },
    { id: 'file.open', label: 'Open', tab: 'file', group: 'File', shortcut: 'Ctrl+O', run: (c) => c.actions.onOpenBackstageOpen() },
    { id: 'file.save', label: 'Save', tab: 'file', group: 'File', shortcut: 'Ctrl+S', run: (c) => c.actions.onSave() },
    { id: 'file.saveAs', label: 'Save As', tab: 'file', group: 'File', shortcut: 'Ctrl+Shift+S', run: (c) => c.actions.onSaveAs() },
    { id: 'file.rename', label: 'Rename', tab: 'file', group: 'File', run: (c) => c.actions.onRenameFile() },
    { id: 'file.copy', label: 'Create a Copy', tab: 'file', group: 'File', keywords: ['duplicate'], run: (c) => c.actions.onCreateCopy() },
    { id: 'file.delete', label: 'Delete document', tab: 'file', group: 'File', keywords: ['remove', 'bin'], run: (c) => c.actions.onDeleteFile() },
    { id: 'file.export', label: 'Export', tab: 'file', group: 'File', run: (c) => c.actions.onOpenBackstage() },
    { id: 'file.exportPdf', label: 'Export as PDF', tab: 'file', group: 'File', keywords: ['pdf'], run: (c) => c.actions.onExportPdf() },
    { id: 'file.print', label: 'Print', tab: 'file', group: 'File', shortcut: 'Ctrl+P', run: (c) => c.actions.onPrint() },
    { id: 'file.history', label: 'Version History', tab: 'file', group: 'File', keywords: ['revisions'], run: (c) => c.actions.onOpenVersionHistory() },
    { id: 'file.info', label: 'Document properties', tab: 'file', group: 'File', keywords: ['info', 'author', 'title'], run: (c) => c.actions.onOpenInfo() },

    // ---- Home: Clipboard and Undo ----
    { id: 'home.paste', label: 'Paste', tab: 'home', group: 'Clipboard', shortcut: 'Ctrl+V', run: (c) => c.actions.onPaste('default') },
    { id: 'home.pasteText', label: 'Paste as plain text', tab: 'home', group: 'Clipboard', keywords: ['unformatted'], shortcut: 'Ctrl+Shift+V', run: (c) => c.actions.onPaste('text') },
    { id: 'home.formatPainter', label: 'Format Painter', tab: 'home', group: 'Clipboard', keywords: ['copy formatting'], run: (c) => (c.flags.formatPainterActive ? c.actions.onFormatPainterApply() : c.actions.onFormatPainterCopy()) },
    { id: 'home.undo', label: 'Undo', tab: 'home', group: 'Quick Access', shortcut: 'Ctrl+Z', run: (c) => chain(c)?.undo().run() },
    { id: 'home.redo', label: 'Redo', tab: 'home', group: 'Quick Access', shortcut: 'Ctrl+Y', run: (c) => chain(c)?.redo().run() },

    // ---- Home: Font ----
    { id: 'home.bold', label: 'Bold', tab: 'home', group: 'Font', keywords: ['strong'], shortcut: 'Ctrl+B', run: (c) => chain(c)?.toggleBold().run() },
    { id: 'home.italic', label: 'Italic', tab: 'home', group: 'Font', keywords: ['emphasis'], shortcut: 'Ctrl+I', run: (c) => chain(c)?.toggleItalic().run() },
    { id: 'home.underline', label: 'Underline', tab: 'home', group: 'Font', shortcut: 'Ctrl+U', run: (c) => chain(c)?.toggleUnderline().run() },
    { id: 'home.strike', label: 'Strikethrough', tab: 'home', group: 'Font', keywords: ['strike'], run: (c) => chain(c)?.toggleStrike().run() },
    { id: 'home.superscript', label: 'Superscript', tab: 'home', group: 'Font', run: (c) => chain(c)?.toggleSuperscript().run() },
    { id: 'home.subscript', label: 'Subscript', tab: 'home', group: 'Font', run: (c) => chain(c)?.toggleSubscript().run() },
    { id: 'home.smallCaps', label: 'Small caps', tab: 'home', group: 'Font', shortcut: 'Ctrl+Shift+K', run: (c) => chain(c)?.setCaps(c.state.smallCaps ? 'none' : 'small').run() },
    { id: 'home.allCaps', label: 'All caps', tab: 'home', group: 'Font', keywords: ['uppercase'], run: (c) => chain(c)?.setCaps(c.state.allCaps ? 'none' : 'all').run() },
    { id: 'home.growFont', label: 'Grow font', tab: 'home', group: 'Font', keywords: ['bigger', 'larger'], shortcut: 'Ctrl+]', run: (c) => chain(c)?.stepFontSize(1).run() },
    { id: 'home.shrinkFont', label: 'Shrink font', tab: 'home', group: 'Font', keywords: ['smaller'], shortcut: 'Ctrl+[', run: (c) => chain(c)?.stepFontSize(-1).run() },
    { id: 'home.clearFormatting', label: 'Clear all formatting', tab: 'home', group: 'Font', keywords: ['reset'], run: (c) => chain(c)?.unsetAllMarks().clearNodes().run() },
    { id: 'home.fontDialog', label: 'Font dialog', tab: 'home', group: 'Font', keywords: ['typeface', 'size'], run: (c) => c.actions.onOpenFontDialog() },

    // ---- Home: Paragraph ----
    { id: 'home.bullets', label: 'Bulleted list', tab: 'home', group: 'Paragraph', keywords: ['bullets', 'unordered'], run: (c) => chain(c)?.toggleBulletList().run() },
    { id: 'home.numbering', label: 'Numbered list', tab: 'home', group: 'Paragraph', keywords: ['numbering', 'ordered'], run: (c) => chain(c)?.toggleOrderedList().run() },
    { id: 'home.checklist', label: 'Checklist', tab: 'home', group: 'Paragraph', keywords: ['task list', 'todo', 'tick box'], run: (c) => chain(c)?.toggleTaskList().run() },
    { id: 'home.alignLeft', label: 'Align left', tab: 'home', group: 'Paragraph', shortcut: 'Ctrl+L', run: (c) => chain(c)?.setTextAlign('left').run() },
    { id: 'home.alignCenter', label: 'Centre', tab: 'home', group: 'Paragraph', keywords: ['center'], shortcut: 'Ctrl+E', run: (c) => chain(c)?.setTextAlign('center').run() },
    { id: 'home.alignRight', label: 'Align right', tab: 'home', group: 'Paragraph', shortcut: 'Ctrl+R', run: (c) => chain(c)?.setTextAlign('right').run() },
    { id: 'home.justify', label: 'Justify', tab: 'home', group: 'Paragraph', shortcut: 'Ctrl+J', run: (c) => chain(c)?.setTextAlign('justify').run() },
    { id: 'home.indent', label: 'Increase indent', tab: 'home', group: 'Paragraph', shortcut: 'Ctrl+M', run: (c) => chain(c)?.increaseParagraphIndent().run() },
    { id: 'home.outdent', label: 'Decrease indent', tab: 'home', group: 'Paragraph', shortcut: 'Ctrl+Shift+M', run: (c) => chain(c)?.decreaseParagraphIndent().run() },
    { id: 'home.ltr', label: 'Left-to-right text direction', tab: 'home', group: 'Paragraph', keywords: ['ltr', 'direction'], run: (c) => chain(c)?.setTextDirection('ltr').run() },
    { id: 'home.rtl', label: 'Right-to-left text direction', tab: 'home', group: 'Paragraph', keywords: ['rtl', 'arabic', 'hebrew', 'direction'], run: (c) => chain(c)?.setTextDirection('rtl').run() },
    { id: 'home.formattingMarks', label: 'Show formatting marks', tab: 'home', group: 'Paragraph', keywords: ['pilcrow', 'paragraph marks'], shortcut: 'Ctrl+Shift+8', run: (c) => c.actions.onToggleFormattingMarks() },
    { id: 'home.sortAsc', label: 'Sort paragraphs A to Z', tab: 'home', group: 'Paragraph', run: (c) => c.actions.onSortParagraphs('asc') },
    { id: 'home.sortDesc', label: 'Sort paragraphs Z to A', tab: 'home', group: 'Paragraph', run: (c) => c.actions.onSortParagraphs('desc') },
    { id: 'home.paragraphDialog', label: 'Paragraph dialog', tab: 'home', group: 'Paragraph', keywords: ['spacing', 'indentation'], run: (c) => c.actions.onOpenParagraphDialog() },
    { id: 'home.borders', label: 'Borders and shading', tab: 'home', group: 'Paragraph', run: (c) => c.actions.onOpenBordersDialog() },

    // ---- Home: Styles and Editing ----
    { id: 'home.styles', label: 'Manage styles', tab: 'home', group: 'Styles', keywords: ['style editor'], run: (c) => c.actions.onOpenStyleEditor() },
    { id: 'home.heading1', label: 'Heading 1', tab: 'home', group: 'Styles', run: (c) => chain(c)?.toggleHeading({ level: 1 }).run() },
    { id: 'home.heading2', label: 'Heading 2', tab: 'home', group: 'Styles', run: (c) => chain(c)?.toggleHeading({ level: 2 }).run() },
    { id: 'home.heading3', label: 'Heading 3', tab: 'home', group: 'Styles', run: (c) => chain(c)?.toggleHeading({ level: 3 }).run() },
    { id: 'home.find', label: 'Find', tab: 'home', group: 'Editing', shortcut: 'Ctrl+F', run: (c) => c.actions.onToggleFindReplace('find') },
    { id: 'home.replace', label: 'Replace', tab: 'home', group: 'Editing', shortcut: 'Ctrl+H', run: (c) => c.actions.onToggleFindReplace('replace') },
    { id: 'home.selectAll', label: 'Select all', tab: 'home', group: 'Editing', shortcut: 'Ctrl+A', run: (c) => chain(c)?.selectAll().run() },

    // ---- Insert ----
    { id: 'insert.picture', label: 'Picture', tab: 'insert', group: 'Illustrations', keywords: ['image', 'photo'], run: (c) => c.actions.onInsertImage() },
    { id: 'insert.drawing', label: 'Drawing', tab: 'insert', group: 'Illustrations', keywords: ['ink', 'canvas', 'sketch', 'pen'], run: (c) => c.actions.onInsertDrawingCanvas() },
    { id: 'insert.shapeRect', label: 'Rectangle shape', tab: 'insert', group: 'Illustrations', run: (c) => c.actions.onInsertShape('rect') },
    { id: 'insert.shapeCircle', label: 'Oval shape', tab: 'insert', group: 'Illustrations', run: (c) => c.actions.onInsertShape('circle') },
    { id: 'insert.shapeLine', label: 'Line shape', tab: 'insert', group: 'Illustrations', run: (c) => c.actions.onInsertShape('line') },
    { id: 'insert.shapeArrow', label: 'Arrow shape', tab: 'insert', group: 'Illustrations', run: (c) => c.actions.onInsertShape('arrow') },
    { id: 'insert.table', label: 'Insert table', tab: 'insert', group: 'Tables', keywords: ['grid', 'rows', 'columns'], run: (c) => chain(c)?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'insert.pageBreak', label: 'Page break', tab: 'insert', group: 'Pages', shortcut: 'Ctrl+Enter', run: (c) => chain(c)?.insertPageBreak().run() },
    { id: 'insert.blankPage', label: 'Blank page', tab: 'insert', group: 'Pages', run: (c) => c.actions.onInsertBlankPage() },
    { id: 'insert.link', label: 'Hyperlink', tab: 'insert', group: 'Links', keywords: ['url', 'link'], shortcut: 'Ctrl+K', run: (c) => { if (c.editor) void import('../utils/hyperlink').then((m) => m.promptForLink(c.editor as Editor)); } },
    { id: 'insert.bookmark', label: 'Bookmark', tab: 'insert', group: 'Links', run: (c) => c.actions.onInsertBookmark() },
    { id: 'insert.crossReference', label: 'Cross-reference', tab: 'insert', group: 'Links', run: (c) => c.actions.onOpenCrossReference() },
    { id: 'insert.toc', label: 'Table of contents', tab: 'references', group: 'Table of Contents', keywords: ['toc', 'contents'], run: (c) => c.actions.onInsertToc() },
    { id: 'insert.comment', label: 'New comment', tab: 'insert', group: 'Comments', shortcut: 'Ctrl+Alt+M', run: (c) => c.actions.onNewComment() },
    { id: 'insert.header', label: 'Header and footer', tab: 'insert', group: 'Header & Footer', run: (c) => c.actions.onOpenHeaderFooter() },
    { id: 'insert.pageNumbers', label: 'Page numbers', tab: 'insert', group: 'Header & Footer', run: (c) => c.actions.onInsertPageNumbers(true) },
    { id: 'insert.symbol', label: 'Symbol', tab: 'insert', group: 'Symbols', keywords: ['special character', 'unicode'], run: (c) => c.actions.onOpenSymbolPicker() },
    { id: 'insert.emoji', label: 'Emoji', tab: 'insert', group: 'Symbols', keywords: ['emoticon', 'smiley'], run: (c) => c.actions.onOpenEmojiPicker() },
    { id: 'insert.equation', label: 'Equation', tab: 'insert', group: 'Symbols', keywords: ['formula', 'maths'], run: (c) => chain(c)?.toggleEquationRun().run() },
    { id: 'insert.horizontalRule', label: 'Horizontal line', tab: 'insert', group: 'Symbols', run: (c) => chain(c)?.setHorizontalRule().run() },
    { id: 'insert.textBox', label: 'Text box', tab: 'insert', group: 'Text', run: (c) => c.actions.onInsertTextBox('simple') },
    { id: 'insert.dropCap', label: 'Drop cap', tab: 'insert', group: 'Text', run: (c) => chain(c)?.toggleDropCap().run() },

    // ---- Layout ----
    { id: 'layout.pageSetup', label: 'Page setup', tab: 'pageLayout', group: 'Page Setup', keywords: ['margins', 'paper'], run: (c) => c.actions.onOpenPageSetup() },
    { id: 'layout.portrait', label: 'Portrait orientation', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onSetOrientation('portrait') },
    { id: 'layout.landscape', label: 'Landscape orientation', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onSetOrientation('landscape') },
    { id: 'layout.a4', label: 'A4 page size', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onSetPageSize('a4') },
    { id: 'layout.letter', label: 'Letter page size', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onSetPageSize('letter') },
    { id: 'layout.columns', label: 'Columns', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onOpenColumnsDialog() },
    { id: 'layout.lineNumbers', label: 'Line numbers', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onSetLineNumbers('continuous') },
    { id: 'layout.hyphenation', label: 'Hyphenation', tab: 'pageLayout', group: 'Page Setup', run: (c) => c.actions.onToggleHyphenation() },
    { id: 'layout.watermark', label: 'Watermark', tab: 'pageLayout', group: 'Page Background', run: (c) => c.actions.onOpenWatermark() },
    { id: 'layout.pageBorders', label: 'Page borders', tab: 'pageLayout', group: 'Page Background', run: (c) => c.actions.onOpenPageBorders() },
    { id: 'layout.pageColor', label: 'Page colour', tab: 'pageLayout', group: 'Page Background', keywords: ['page color', 'background'], run: (c) => c.goToTab('pageLayout') },

    // ---- References ----
    { id: 'references.updateToc', label: 'Update table of contents', tab: 'references', group: 'Table of Contents', run: (c) => c.actions.onUpdateToc() },
    { id: 'references.footnote', label: 'Insert footnote', tab: 'references', group: 'Footnotes', shortcut: 'Ctrl+Alt+F', run: (c) => c.actions.onInsertFootnote() },
    { id: 'references.endnote', label: 'Insert endnote', tab: 'references', group: 'Footnotes', shortcut: 'Ctrl+Alt+D', run: (c) => c.actions.onInsertEndnote() },
    { id: 'references.showNotes', label: 'Show notes', tab: 'references', group: 'Footnotes', run: (c) => c.actions.onShowNotes() },
    { id: 'references.sources', label: 'Manage sources', tab: 'references', group: 'Citations & Bibliography', keywords: ['citation', 'reference'], run: (c) => c.actions.onManageSources() },
    { id: 'references.bibliography', label: 'Insert bibliography', tab: 'references', group: 'Citations & Bibliography', run: (c) => c.actions.onInsertBibliography() },
    { id: 'references.caption', label: 'Insert caption', tab: 'references', group: 'Captions', run: (c) => c.actions.onInsertCaption('Figure') },
    { id: 'references.indexEntry', label: 'Mark index entry', tab: 'references', group: 'Index', shortcut: 'Alt+Shift+X', enabled: (c) => c.state.hasSelection, run: (c) => c.actions.onMarkIndexEntry() },
    { id: 'references.index', label: 'Insert index', tab: 'references', group: 'Index', run: (c) => c.actions.onInsertIndex() },

    // ---- Mailings ----
    // Enabled-gated the same way the tab is, so Alt+Q cannot route around the
    // "attach a list first" rule the ribbon enforces.
    { id: 'mailings.envelopes', label: 'Envelopes', tab: 'mailings', group: 'Create', keywords: ['envelope', 'post', 'mail'], run: (c) => c.actions.onOpenEnvelopes() },
    { id: 'mailings.labels', label: 'Labels', tab: 'mailings', group: 'Create', keywords: ['avery', 'address labels', 'sticker'], run: (c) => c.actions.onOpenLabels() },
    { id: 'mailings.startMerge', label: 'Start mail merge', tab: 'mailings', group: 'Start Mail Merge', keywords: ['mail merge', 'bulk letters'], run: (c) => c.goToTab('mailings') },
    { id: 'mailings.wizard', label: 'Step-by-step mail merge wizard', tab: 'mailings', group: 'Start Mail Merge', keywords: ['mail merge wizard', 'guide'], run: (c) => c.actions.onOpenMergeWizard() },
    { id: 'mailings.selectRecipients', label: 'Select recipients', tab: 'mailings', group: 'Start Mail Merge', keywords: ['recipient list', 'csv', 'data source'], run: (c) => c.actions.onUseExistingRecipientList() },
    { id: 'mailings.newList', label: 'Type a new recipient list', tab: 'mailings', group: 'Start Mail Merge', keywords: ['address list'], run: (c) => c.actions.onNewRecipientList() },
    { id: 'mailings.editRecipients', label: 'Edit recipient list', tab: 'mailings', group: 'Start Mail Merge', enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onEditRecipientList() },
    { id: 'mailings.insertField', label: 'Insert merge field', tab: 'mailings', group: 'Write & Insert Fields', keywords: ['merge field'], enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onOpenInsertMergeField() },
    { id: 'mailings.addressBlock', label: 'Address block', tab: 'mailings', group: 'Write & Insert Fields', enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onOpenAddressBlock() },
    { id: 'mailings.greetingLine', label: 'Greeting line', tab: 'mailings', group: 'Write & Insert Fields', enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onOpenGreetingLine() },
    { id: 'mailings.matchFields', label: 'Match fields', tab: 'mailings', group: 'Write & Insert Fields', enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onOpenMatchFields() },
    { id: 'mailings.highlightFields', label: 'Highlight merge fields', tab: 'mailings', group: 'Write & Insert Fields', enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onToggleHighlightMergeFields() },
    { id: 'mailings.updateLabels', label: 'Update labels', tab: 'mailings', group: 'Write & Insert Fields', enabled: (c) => Boolean(c.flags.mailMerge.source), run: (c) => c.actions.onUpdateLabels() },
    { id: 'mailings.preview', label: 'Preview results', tab: 'mailings', group: 'Preview Results', keywords: ['preview merge'], enabled: (c) => c.flags.mailMerge.recordCount > 0, run: (c) => c.actions.onTogglePreviewResults() },
    { id: 'mailings.findRecipient', label: 'Find recipient', tab: 'mailings', group: 'Preview Results', enabled: (c) => c.flags.mailMerge.recordCount > 0, run: (c) => c.actions.onOpenFindRecipient() },
    { id: 'mailings.checkErrors', label: 'Check for errors', tab: 'mailings', group: 'Preview Results', keywords: ['merge errors', 'validate'], run: (c) => c.actions.onCheckMergeErrors() },
    { id: 'mailings.finish', label: 'Finish and merge', tab: 'mailings', group: 'Finish', keywords: ['merge to new document'], enabled: (c) => c.flags.mailMerge.recordCount > 0, run: (c) => c.actions.onFinishMerge('documents') },

    // ---- Review ----
    { id: 'review.spelling', label: 'Spelling & Grammar', tab: 'review', group: 'Proofing', keywords: ['spell check', 'proofing', 'editor'], shortcut: 'F7', run: (c) => c.actions.onOpenProofing() },
    { id: 'review.thesaurus', label: 'Thesaurus', tab: 'review', group: 'Proofing', keywords: ['synonyms'], shortcut: 'Shift+F7', run: (c) => c.actions.onOpenThesaurus() },
    { id: 'review.wordCount', label: 'Word count', tab: 'review', group: 'Proofing', keywords: ['statistics', 'readability'], run: (c) => c.actions.onOpenWordCount() },
    { id: 'review.accessibility', label: 'Check Accessibility', tab: 'review', group: 'Accessibility', keywords: ['a11y', 'alt text', 'contrast'], run: (c) => c.actions.onCheckAccessibility() },
    { id: 'review.newComment', label: 'New comment', tab: 'review', group: 'Comments', shortcut: 'Ctrl+Alt+M', run: (c) => c.actions.onNewComment() },
    { id: 'review.showComments', label: 'Show comments', tab: 'review', group: 'Comments', run: (c) => c.actions.onToggleComments() },
    { id: 'review.trackChanges', label: 'Track changes', tab: 'review', group: 'Tracking', keywords: ['revisions', 'markup'], shortcut: 'Ctrl+Shift+E', run: (c) => c.actions.onToggleTrackChanges() },
    { id: 'review.allMarkup', label: 'Show all markup', tab: 'review', group: 'Tracking', run: (c) => c.actions.onSetMarkupView('all') },
    { id: 'review.noMarkup', label: 'Show no markup', tab: 'review', group: 'Tracking', run: (c) => c.actions.onSetMarkupView('none') },
    { id: 'review.reviewingPane', label: 'Reviewing pane', tab: 'review', group: 'Tracking', run: (c) => c.actions.onToggleReviewingPane() },
    { id: 'review.compare', label: 'Compare documents', tab: 'review', group: 'Compare', keywords: ['diff'], run: (c) => c.actions.onCompareDocuments() },
    { id: 'review.restrict', label: 'Restrict editing', tab: 'review', group: 'Tracking', keywords: ['read only', 'lock', 'protect'], run: (c) => c.actions.onToggleRestrictEditing() },

    // ---- View ----
    { id: 'view.print', label: 'Print layout', tab: 'view', group: 'Views', keywords: ['separate pages'], run: (c) => c.actions.onSetViewMode('print') },
    { id: 'view.read', label: 'Reading view', tab: 'view', group: 'Views', keywords: ['read mode'], run: (c) => c.actions.onSetViewMode('read') },
    { id: 'view.web', label: 'Web layout', tab: 'view', group: 'Views', run: (c) => c.actions.onSetViewMode('web') },
    { id: 'view.outline', label: 'Outline view', tab: 'view', group: 'Views', run: (c) => c.actions.onSetViewMode('outline') },
    { id: 'view.draft', label: 'Draft view', tab: 'view', group: 'Views', run: (c) => c.actions.onSetViewMode('draft') },
    { id: 'view.immersive', label: 'Immersive Reader', tab: 'view', group: 'Immersive', keywords: ['focus mode', 'distraction free'], run: (c) => c.actions.onToggleFocusMode() },
    { id: 'view.ruler', label: 'Ruler', tab: 'view', group: 'Show', run: (c) => c.actions.onToggleRuler() },
    { id: 'view.gridlines', label: 'Gridlines', tab: 'view', group: 'Show', run: (c) => c.actions.onToggleGridlines() },
    { id: 'view.navigation', label: 'Navigation pane', tab: 'view', group: 'Show', keywords: ['headings', 'outline pane'], run: (c) => c.actions.onToggleNavigation() },
    { id: 'view.headerFooter', label: 'Show header and footer', tab: 'view', group: 'Show', run: (c) => c.actions.onToggleShowHeaderFooter() },
    { id: 'view.footnotes', label: 'Show footnotes', tab: 'view', group: 'Show', run: (c) => c.actions.onToggleShowFootnotes() },
    { id: 'view.endnotes', label: 'Show endnotes', tab: 'view', group: 'Show', run: (c) => c.actions.onToggleShowEndnotes() },
    { id: 'view.darkMode', label: 'Dark mode', tab: 'view', group: 'Dark Mode', keywords: ['theme', 'night'], run: (c) => c.actions.onToggleTheme() },
    { id: 'view.zoom', label: 'Zoom', tab: 'view', group: 'Zoom', run: (c) => c.actions.onOpenZoomDialog() },
    { id: 'view.zoom100', label: 'Zoom to 100%', tab: 'view', group: 'Zoom', run: (c) => c.actions.onSetZoom(100) },
    { id: 'view.pageWidth', label: 'Fit page width', tab: 'view', group: 'Zoom', run: (c) => c.actions.onZoomToFit('pageWidth') },
    { id: 'view.onePage', label: 'Fit one page', tab: 'view', group: 'Zoom', run: (c) => c.actions.onZoomToFit('onePage') },
    { id: 'view.ribbon', label: 'Collapse the ribbon', tab: 'view', group: 'Tools', shortcut: 'Ctrl+F1', run: (c) => c.actions.onToggleRibbonCollapsed() },

    // ---- Help ----
    { id: 'help.help', label: 'Help', tab: 'help', group: 'Help', keywords: ['github', 'documentation'], run: (c) => c.actions.onOpenHelp() },
    { id: 'help.support', label: 'Contact Support', tab: 'help', group: 'Help', keywords: ['issue', 'bug'], run: (c) => c.actions.onContactSupport() },
    { id: 'help.feedback', label: 'Feedback', tab: 'help', group: 'Help', run: (c) => c.actions.onSendFeedback() },
    { id: 'help.shortcuts', label: 'Keyboard Shortcuts', tab: 'help', group: 'Help', keywords: ['keys', 'bindings'], run: (c) => c.actions.onOpenShortcuts() },
    { id: 'help.whatsNew', label: "What's New", tab: 'help', group: 'Help', keywords: ['changelog', 'release notes'], run: (c) => c.actions.onOpenWhatsNew() },

    // ---- Picture, selection-gated ----
    { id: 'picture.altText', label: 'Alt text', tab: 'pictureFormat', group: 'Accessibility', enabled: (c) => c.state.imageActive, run: (c) => c.actions.onOpenAltText() },
    { id: 'picture.layout', label: 'Picture size and position', tab: 'pictureFormat', group: 'Size', enabled: (c) => c.state.imageActive, run: (c) => c.actions.onOpenPictureLayout() },
    { id: 'picture.reset', label: 'Reset picture', tab: 'pictureFormat', group: 'Adjust', enabled: (c) => c.state.imageActive, run: (c) => c.actions.onResetPicture() },
    { id: 'picture.bringForward', label: 'Bring forward', tab: 'pictureFormat', group: 'Arrange', keywords: ['z order', 'in front', 'stack'], enabled: (c) => c.state.imageActive, run: (c) => chain(c)?.updateAttributes('image', { z: Number(c.editor?.getAttributes('image').z ?? 0) + 1 }).run() },
    { id: 'picture.sendBackward', label: 'Send backward', tab: 'pictureFormat', group: 'Arrange', keywords: ['z order', 'behind', 'stack'], enabled: (c) => c.state.imageActive, run: (c) => chain(c)?.updateAttributes('image', { z: Number(c.editor?.getAttributes('image').z ?? 0) - 1 }).run() },
    { id: 'picture.resetSize', label: 'Reset picture size', tab: 'pictureFormat', group: 'Size', keywords: ['fit to column'], enabled: (c) => c.state.imageActive, run: (c) => chain(c)?.updateAttributes('image', { width: null, height: null }).run() },

    // ---- Table, selection-gated ----
    { id: 'table.properties', label: 'Table properties', tab: 'tableLayout', group: 'Table', enabled: (c) => c.state.inTable, run: (c) => c.actions.onOpenTableProperties() },
    { id: 'table.rowAbove', label: 'Insert row above', tab: 'tableLayout', group: 'Rows & Columns', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.addRowBefore().run() },
    { id: 'table.rowBelow', label: 'Insert row below', tab: 'tableLayout', group: 'Rows & Columns', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.addRowAfter().run() },
    { id: 'table.columnLeft', label: 'Insert column left', tab: 'tableLayout', group: 'Rows & Columns', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.addColumnBefore().run() },
    { id: 'table.columnRight', label: 'Insert column right', tab: 'tableLayout', group: 'Rows & Columns', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.addColumnAfter().run() },
    { id: 'table.deleteRow', label: 'Delete row', tab: 'tableLayout', group: 'Rows & Columns', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.deleteRow().run() },
    { id: 'table.deleteTable', label: 'Delete table', tab: 'tableLayout', group: 'Rows & Columns', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.deleteTable().run() },
    { id: 'table.mergeCells', label: 'Merge cells', tab: 'tableLayout', group: 'Merge', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.mergeCells().run() },
    { id: 'table.splitCell', label: 'Split cell', tab: 'tableLayout', group: 'Merge', enabled: (c) => c.state.inTable, run: (c) => chain(c)?.splitCell().run() },
    { id: 'table.rowHeight', label: 'Row height', tab: 'tableLayout', group: 'Cell Size', keywords: ['cell size', 'taller'], enabled: (c) => c.state.inTable, run: (c) => c.goToTab('tableLayout') },
    { id: 'table.columnWidth', label: 'Column width', tab: 'tableLayout', group: 'Cell Size', keywords: ['cell size', 'wider'], enabled: (c) => c.state.inTable, run: (c) => c.goToTab('tableLayout') },
    { id: 'table.distributeColumns', label: 'Distribute columns', tab: 'tableLayout', group: 'Cell Size', keywords: ['even', 'equal width'], enabled: (c) => c.state.inTable, run: (c) => distributeColumns(c.editor) },
    { id: 'table.distributeRows', label: 'Distribute rows', tab: 'tableLayout', group: 'Cell Size', keywords: ['even', 'equal height'], enabled: (c) => c.state.inTable, run: (c) => distributeRows(c.editor) },
    { id: 'table.autoFit', label: 'AutoFit contents', tab: 'tableLayout', group: 'Cell Size', keywords: ['autofit', 'shrink to fit'], enabled: (c) => c.state.inTable, run: (c) => { clearWidths(c.editor); chain(c)?.fixTables().run(); } },

    // ---- Draw, selection-gated ----
    { id: 'draw.pen', label: 'Pen', tab: 'draw', group: 'Tools', enabled: (c) => c.state.inkActive, run: (c) => c.actions.onSetInkTool('pen') },
    { id: 'draw.highlighter', label: 'Highlighter', tab: 'draw', group: 'Tools', enabled: (c) => c.state.inkActive, run: (c) => c.actions.onSetInkTool('highlighter') },
    { id: 'draw.eraser', label: 'Eraser', tab: 'draw', group: 'Tools', enabled: (c) => c.state.inkActive, run: (c) => c.actions.onSetInkTool('eraser') },
    { id: 'draw.select', label: 'Select tool', tab: 'draw', group: 'Tools', enabled: (c) => c.state.inkActive, run: (c) => c.actions.onSetInkTool('select') },
  ];
}

export interface ScoredCommand {
  command: RibbonCommand;
  score: number;
}

/**
 * Prefix beats word-start beats substring, over label then keywords then the
 * "Home > Font" breadcrumb. Deliberately not fuzzy: for a fixed list of ~140
 * known command names, exact substring ranking gives better first hits than
 * subsequence matching, and needs no dependency.
 */
export function searchCommands(commands: RibbonCommand[], query: string): ScoredCommand[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const scored: ScoredCommand[] = [];
  for (const command of commands) {
    const label = command.label.toLowerCase();
    let score = 0;

    if (label === needle) score = 100;
    else if (label.startsWith(needle)) score = 90;
    else if (new RegExp(`\\b${escapeRegExp(needle)}`).test(label)) score = 80;
    else if (label.includes(needle)) score = 60;
    else if (command.keywords?.some((word) => word.toLowerCase().startsWith(needle))) score = 50;
    else if (command.keywords?.some((word) => word.toLowerCase().includes(needle))) score = 40;
    else if (`${command.tab} ${command.group}`.toLowerCase().includes(needle)) score = 20;

    if (score) scored.push({ command, score });
  }

  return scored.sort(
    (a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
