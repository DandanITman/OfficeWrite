import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import type { Extensions } from '@tiptap/core';
import { ResizableImage } from '../extensions/ResizableImage';
import { TrackInsert } from '../extensions/TrackInsert';
import { TrackDelete } from '../extensions/TrackDelete';
import { PageBreak } from '../extensions/PageBreak';
import { ColumnBreak } from '../extensions/ColumnBreak';
import { TableOfContents } from '../extensions/TableOfContents';
import { CommentAnchor } from '../extensions/CommentAnchor';
import { DocShape } from '../extensions/DocShape';
import { FootnoteRef } from '../extensions/FootnoteRef';
import { ProofingCheck, type DocumentProofingIssue } from '../extensions/ProofingCheck';
import { AutoCorrect } from '../extensions/AutoCorrect';
import { SuperscriptMark, SubscriptMark } from '../extensions/TextMarks';
import { ParagraphFormatting } from '../extensions/ParagraphFormatting';
import { CharacterFormatting } from '../extensions/CharacterFormatting';
import { ListFormatting } from '../extensions/ListFormatting';
import { TableFormatting } from '../extensions/TableFormatting';
import { FormattingMarks } from '../extensions/FormattingMarks';
import { ParkedSelection } from '../extensions/ParkedSelection';
import { TableRowResizing } from '../extensions/TableRowResizing';
import { TextBox } from '../extensions/TextBox';
import { InkDrawing } from '../extensions/InkDrawing';
import { Bibliography, Bookmark, DocumentIndex, IndexEntry, TableOfFigures } from '../extensions/DocFields';
import { MergeField } from '../extensions/MergeField';

export interface EditorExtensionOptions {
  spellCheckEnabled?: boolean;
  grammarCheckEnabled?: boolean;
  autoCorrectEnabled?: boolean;
  showFormattingMarks?: boolean;
  language?: string;
  ignoredWords?: string[];
  checkWords?: (words: string[], language: string) => Promise<boolean[]>;
  onProofingIssues?: (issues: DocumentProofingIssue[]) => void;
  placeholder?: string;
}

/**
 * The document schema, in one place.
 *
 * Unit tests must build editors from this same list. A separate, much smaller
 * test schema is what allowed the FootnoteRef content-hole bug (footnote
 * markers rendering as "11") to ship unnoticed: the extension simply was not
 * registered in the editor the tests used.
 */
export function createExtensions(options: EditorExtensionOptions = {}): Extensions {
  const {
    spellCheckEnabled = true,
    grammarCheckEnabled = true,
    autoCorrectEnabled = true,
    showFormattingMarks = false,
    language = 'en-US',
    ignoredWords = [],
    checkWords = async (words: string[]) => words.map(() => true),
    onProofingIssues,
    placeholder = 'Start typing your document…',
  } = options;

  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextStyle,
    CharacterFormatting,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    SuperscriptMark,
    SubscriptMark,
    ParagraphFormatting,
    ListFormatting,
    ParkedSelection,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    ResizableImage,
    TextBox,
    InkDrawing,
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: true }),
    TableRowResizing,
    TableHeader,
    TaskList,
    // nested so a checklist can have sub-items, as multilevel lists do.
    TaskItem.configure({ nested: true }),
    TableCell,
    TableFormatting,
    TrackInsert,
    TrackDelete,
    PageBreak,
    ColumnBreak,
    TableOfContents,
    CommentAnchor,
    DocShape,
    FootnoteRef,
    Bookmark,
    IndexEntry,
    MergeField,
    Bibliography,
    DocumentIndex,
    TableOfFigures,
    FormattingMarks.configure({ enabled: showFormattingMarks }),
    AutoCorrect.configure({ enabled: autoCorrectEnabled }),
    ProofingCheck.configure({
      enabled: spellCheckEnabled,
      grammarEnabled: grammarCheckEnabled,
      language,
      ignoredWords,
      checkWords,
      onIssues: onProofingIssues,
    }),
  ];
}
