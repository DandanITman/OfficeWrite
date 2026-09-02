import {
  BookMarked,
  BookOpen,
  Bookmark,
  FileText,
  Library,
  ListTree,
  Quote,
  RefreshCw,
  Superscript,
  Tag,
} from 'lucide-react';
import { CAPTION_LABELS, CITATION_STYLE_LABELS, type CitationStyle } from '@officewrite/core';
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenuButton,
  RibbonMenuHeader,
  RibbonMenuItem,
  RibbonMenuSeparator,
  RibbonStack,
} from '../RibbonKit';
import type { RibbonTabProps } from '../types';

export function ReferencesTab({ editor, state, actions, flags }: RibbonTabProps) {
  return (
    <>
      <RibbonGroup label="Table of Contents">
        <RibbonStack>
          <RibbonMenuButton
            icon={<BookOpen size={20} className="icon-toc" />}
            label="Table of Contents"
            title="Table of Contents"
            size="large"
            testId="ribbon-toc"
          >
            <RibbonMenuHeader label="Built-in" />
            <RibbonMenuItem
              label="Automatic Table"
              hint="Built from the document's headings"
              onClick={actions.onInsertToc}
              testId="ribbon-insert-toc"
            />
            <RibbonMenuSeparator />
            <RibbonMenuItem label="Update Table" onClick={actions.onUpdateToc} />
          </RibbonMenuButton>
        </RibbonStack>
        <RibbonStack>
          <RibbonMenuButton
            icon={<ListTree size={14} />}
            label="Add Text"
            title="Include the current paragraph in the table of contents"
            testId="references-add-text"
          >
            <RibbonMenuItem
              label="Level 1"
              checked={state.headingLevel === 1}
              onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()}
            />
            <RibbonMenuItem
              label="Level 2"
              checked={state.headingLevel === 2}
              onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()}
            />
            <RibbonMenuItem
              label="Level 3"
              checked={state.headingLevel === 3}
              onClick={() => editor?.chain().focus().setHeading({ level: 3 }).run()}
            />
            <RibbonMenuSeparator />
            <RibbonMenuItem
              label="Do Not Show in Table of Contents"
              onClick={() => editor?.chain().focus().setParagraph().run()}
            />
          </RibbonMenuButton>
          <RibbonButton
            icon={<RefreshCw size={14} />}
            label="Update Table"
            title="Refresh the table of contents"
            onClick={actions.onUpdateToc}
            testId="references-update-toc"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Footnotes">
        <RibbonStack>
          <RibbonButton
            icon={<Superscript size={20} className="icon-footnote" />}
            label="Insert Footnote"
            title="Insert Footnote (Ctrl+Alt+F)"
            size="large"
            onClick={actions.onInsertFootnote}
            testId="ribbon-footnote"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<FileText size={14} />}
            label="Insert Endnote"
            title="Insert Endnote (Ctrl+Alt+D)"
            onClick={actions.onInsertEndnote}
            testId="ribbon-endnote"
          />
          <RibbonButton
            icon={<BookMarked size={14} />}
            label="Show Notes"
            title="Jump to the notes area"
            onClick={actions.onShowNotes}
            testId="references-show-notes"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Citations &amp; Bibliography">
        <RibbonStack>
          <RibbonMenuButton
            icon={<Quote size={14} />}
            label="Insert Citation"
            title="Insert a citation for a source"
            testId="references-insert-citation"
            menuWidth={280}
          >
            {flags.sources.length === 0 ? (
              <RibbonMenuItem label="No sources yet, add one…" onClick={actions.onManageSources} />
            ) : (
              <>
                <RibbonMenuHeader label="Sources in this document" />
                {flags.sources.map((source) => (
                  <RibbonMenuItem
                    key={source.id}
                    label={`${source.author || 'Unknown'}: ${source.title}`}
                    hint={source.year}
                    onClick={() => actions.onInsertCitation(source.id)}
                  />
                ))}
              </>
            )}
            <RibbonMenuSeparator />
            <RibbonMenuItem label="Add New Source…" onClick={actions.onManageSources} />
          </RibbonMenuButton>
          <RibbonButton
            icon={<Library size={14} />}
            label="Manage Sources"
            title="Manage the source list"
            onClick={actions.onManageSources}
            testId="references-manage-sources"
          />
        </RibbonStack>
        <RibbonStack>
          <label className="rb-inline-field" title="Citation style">
            <span>Style</span>
            <select
              className="rb-select"
              value={flags.citationStyle}
              data-testid="references-citation-style"
              onChange={(event) => actions.onSetCitationStyle(event.target.value as CitationStyle)}
            >
              {(Object.keys(CITATION_STYLE_LABELS) as CitationStyle[]).map((style) => (
                <option key={style} value={style}>
                  {CITATION_STYLE_LABELS[style]}
                </option>
              ))}
            </select>
          </label>
          <RibbonMenuButton
            icon={<BookOpen size={14} />}
            label="Bibliography"
            title="Bibliography"
            testId="references-bibliography"
          >
            <RibbonMenuItem label="Insert Bibliography" onClick={actions.onInsertBibliography} />
            <RibbonMenuItem label="Update Bibliography" onClick={actions.onInsertBibliography} />
          </RibbonMenuButton>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Captions">
        <RibbonStack>
          <RibbonMenuButton
            icon={<Tag size={14} />}
            label="Insert Caption"
            title="Add a numbered caption"
            testId="references-insert-caption"
          >
            {CAPTION_LABELS.map((label) => (
              <RibbonMenuItem
                key={label}
                label={label}
                onClick={() => actions.onInsertCaption(label)}
                testId={`references-caption-${label.toLowerCase()}`}
              />
            ))}
          </RibbonMenuButton>
          <RibbonMenuButton
            icon={<BookOpen size={14} />}
            label="Table of Figures"
            title="Insert a table of figures"
            testId="references-table-of-figures"
          >
            {CAPTION_LABELS.map((label) => (
              <RibbonMenuItem
                key={label}
                label={`Table of ${label}s`}
                onClick={() => actions.onInsertTableOfFigures(label)}
              />
            ))}
          </RibbonMenuButton>
          <RibbonButton
            icon={<Bookmark size={14} />}
            label="Cross-reference"
            title="Refer to a heading, bookmark, figure or footnote"
            onClick={actions.onOpenCrossReference}
            testId="references-cross-reference"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Index">
        <RibbonStack>
          <RibbonButton
            icon={<Tag size={14} />}
            label="Mark Entry"
            title="Mark the selection as an index entry (Alt+Shift+X)"
            disabled={!state.hasSelection}
            onClick={actions.onMarkIndexEntry}
            testId="references-mark-entry"
          />
          <RibbonButton
            icon={<Library size={14} />}
            label="Insert Index"
            title="Insert or update the index"
            onClick={actions.onInsertIndex}
            testId="references-insert-index"
          />
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
