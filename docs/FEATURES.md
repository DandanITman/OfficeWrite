# Officewrite features

What the app does today. Anything not listed here is not built. This file is
maintained by hand against the actual code, and nothing generates a coverage
percentage from it.

The ribbon has nine tabs: **File, Home, Insert, Layout, References, Mailings,
Review, View, Help**, plus three contextual tabs (**Draw**, **Picture Format**
and **Table Layout**) that appear when a drawing, a picture or a table is
selected.
Selecting a picture or a drawing switches to its tab and leaves it again for
wherever you were; putting the caret in a table reveals Table Layout but leaves
the tab alone, since you are usually typing.
Groups are labelled and open their dialogs from a corner launcher.
File is a dropdown menu rather than a panel.

Undo and redo live in the Quick Access toolbar in the header rather than in a
ribbon group.

The header carries the document name, which opens Rename when clicked, and a
search box (Alt+Q) that finds and runs any ribbon command. The right-hand end of
the tab strip holds Comments, an Editing / Reviewing / Viewing mode picker, and
the ribbon layout menu.

## File

- New document from a blank page or any of the 32 templates, from the start
  screen, its searchable gallery, or the backstage New pane. Every card shows a
  miniature of the template's own first page, meaning its real headings, text,
  lists and tables. A corner button opens that page at readable size, with a
  Create button beside it.
- Open `.officewrite`, `.docx`, `.doc`, `.rtf`, `.html`, `.txt`
- Save and Save As; the format follows the file extension
- Rename the open document, and Create a Copy alongside it
- Delete, which sends the file to the recycle bin rather than erasing it
- Export a copy as DOCX, `.officewrite`, RTF, HTML, PDF or TXT without changing
  which document is open
- Print with a preview of the paginated document, copies and a page range,
  then the system dialog
- Recent files with pinning, and remove-from-recent; the backstage Open pane
  lists them too
- Auto-save on an interval once the document has a path
- Version history: up to 20 snapshots per document, for every save format
- Windows file associations: double-clicking a `.docx` or `.officewrite` opens it
- Prompts to save when closing with unsaved changes
- Document properties: title, author, subject, keywords, company

## Home

- **Clipboard**: Paste as a split button with Keep Source Formatting, Merge
  Formatting and Keep Text Only; Cut, Copy, Format Painter
- **Font**: family and size combo boxes, Grow/Shrink Font, Change Case
  (five modes), Clear All Formatting, bold, italic, underline with six underline
  styles, strikethrough, sub- and superscript, text effects (shadow, outline,
  glow, reflection), small caps and all caps, highlight colour, font colour, and
  a Font dialog with a live preview
- **Paragraph**: bullet library, numbering library, checklists, multilevel list
  schemes, increase and decrease indent (which demote and promote list items),
  left-to-right and right-to-left text direction, Sort, Show/Hide formatting
  marks, the four alignments, line and paragraph spacing, shading, borders on
  any side, border colour, and a Paragraph dialog
- **Styles**: a live gallery of preview tiles with the caret's style lit, and
  behind More the full set (Normal, No Spacing, the headings, Title,
  Subtitle, Quote, Intense Quote, List Paragraph and the character styles
  Emphasis, Strong, Subtle/Intense Emphasis, references and Book Title), a style
  editor for custom styles, and the eight style sets, which restyle the
  paragraphs already in the document rather than only the gallery
- **Editing**: Find (a split button whose menu holds Go To), Replace and
  Select

Everything above tracks the caret: the ribbon shows the formatting at the
cursor, not the formatting from the last edit. A mini toolbar appears above the
selection, and right-clicking opens a context menu with the clipboard commands,
the dialogs, comments and synonyms.

## Insert

- **Pages**: four cover pages, Blank Page, Page Break
- **Tables**: the hover-to-size grid picker, a quick 3 × 3, and Delete Table.
  The contextual Table Layout tab adds rows and columns, merges and splits
  cells, selects a cell/row/column/table, sets row height and column width in
  inches, distributes rows or columns evenly, and offers AutoFit
- **Illustrations**: Pictures, Shapes (rectangle, oval, triangle, line, arrow)
  and Drawing, which inserts an ink canvas and opens the Draw tab
- **Links**: hyperlinks, bookmarks and cross-references
- **Comments**: New Comment
- **Header & Footer**: header and footer with left, centre and right zones,
  `%p` and `%P` page-number fields, page numbers and Different First Page
- **Text**: text boxes (simple, sidebar, pull quote), Drop Cap, Date & Time in
  three formats
- **Symbols**: inline equation runs, a symbol gallery with a full picker of
  eight Unicode subsets, horizontal lines, and the emoji picker: around six
  hundred emoji in seven groups, searchable by name, with a recently-used row
  that survives a restart

## Draw (contextual)

Appears while a drawing canvas is selected, and closes when it is not.

- Pen, highlighter and stroke eraser, with eight pen colours and five widths
- Ink is stored as vectors, so it scales with zoom and survives a save; drawings
  export to HTML and print as SVG

## Layout

- **Page Setup**: margins gallery (Normal, Narrow, Moderate, Wide, Mirrored),
  orientation, six page sizes (Letter, A4, Legal, A5, Executive, Tabloid),
  columns with an optional line between, page and column breaks, line numbers
  (continuous or restarting each page), automatic hyphenation
- **Paragraph**: left and right indent, space before and after
- **Page Background**: watermark, page colour, page borders
- **Arrange**: appears while a shape or text box is selected: Wrap Text (in
  line, square, tight, top and bottom, behind text, in front of text),
  left/centre/right alignment, and Bring Forward / Send Backward
- Draggable margin markers on the ruler

## References

- **Table of Contents**: an automatic table that refreshes as headings change,
  Add Text to set a heading level, Update Table
- **Footnotes**: footnotes and endnotes, each with its own editable notes area,
  and Show Notes
- **Citations & Bibliography**: a source manager for books, articles, web
  sites, reports and conference papers; in-text citations and a bibliography in
  APA, MLA, Chicago or IEEE
- **Captions**: numbered Figure, Table and Equation captions, tables of figures
- **Index**: Mark Entry and a generated, alphabetised index

## Mailings

A complete mail merge, arranged in the conventional order. Everything from Edit
Recipient List rightwards is disabled until a list is attached, so the tab itself
says which step comes next.

- **Create**: **Envelopes** and **Labels**, either from one typed address or
  merged from the recipient list. Seven envelope sizes and eight label stocks
  (Avery 5160, 5161, 5162, 5163, 5164, 5167, 5395, L7160). These two work with no
  recipient list at all.
- **Start Mail Merge**: document type (Letters, E-mail Messages, Envelopes,
  Labels, Directory, Normal), a six-step **Step-by-Step Mail Merge Wizard** in a
  task pane, and **Select Recipients**:
  - **Use an Existing List** reads `.csv`, `.tsv` and delimited `.txt`. The reader
    handles quoted cells, separators inside quotes, doubled quotes, a UTF-8 byte
    order mark, short rows and duplicate headers, and sniffs comma, tab,
    semicolon or pipe from the header line.
  - **Type a New List** builds a source by hand, with columns you can add.
  - **Edit Recipient List** ticks rows in or out of the merge, edits cells in
    place, adds and removes entries, and sorts or filters by any column.
- **Write & Insert Fields**
  - **Insert Merge Field** for any column, as a «FieldName» field
  - **Address Block** and **Greeting Line**, both with a live preview of the
    first recipient. Address Block collapses missing parts rather than leaving
    blank lines, and follows the usual "never / always / only when different from"
    country rule. Greeting Line falls back to "Dear Sir or Madam," for a row with
    no name.
  - **Match Fields** points sixteen standard address fields at your columns.
    Attaching a list guesses the mapping, matching `fname`, `LAST_NAME`,
    `postcode` and the like, and never lets one column answer for two fields.
  - **Rules**: Ask, Fill-in, If…Then…Else, Merge Record #, Merge Sequence #,
    Next Record, Next Record If, Skip Record If, Set Bookmark. Comparisons are
    numeric when both sides are numbers, so "greater than 100" does not compare
    `10` against `9` as text.
  - **Highlight Merge Fields** shades every field so they are easy to find
  - **Update Labels** copies the first label across the sheet, giving each later
    cell a Next Record rule. Pressing it twice does not double the rules.
- **Preview Results**: swap the fields for one recipient's real values, step
  through records with first/previous/next/last or by typing a number, **Find
  Recipient** to search and jump, and **Check for Errors**, which reports fields
  with no column behind them, an unmatched Address Block, no ticked rows, and
  rows that would merge to a blank document. A field that resolves to empty stays
  visible while previewing, so a forgotten column does not look like a field you
  never inserted.
- **Finish & Merge**: **Edit Individual Documents** merges into a new document
  and leaves the main document's fields intact, **Print Documents** merges and
  prints, and **Send E-mail Messages** writes one `.docx` per recipient for you
  to attach. Either all recipients or a record range, and any Ask or Fill-in rule
  is answered once before the merge runs.

Merge fields are stored as document fields, so they survive a save and reopen. In
`.docx`, `.rtf` and HTML they export as their «FieldName» text, which is legible
rather than corrupt anywhere else.

Officewrite makes no network requests, so the e-mail merge writes files rather
than sending mail.

## Review

- **Proofing**: Hunspell spell check in English, German, Spanish and French; a
  grammar checker covering repeated words, article agreement, spacing,
  sentence capitalisation and common wrong phrases; the F7 Spelling & Grammar
  pane with Change, Change All, Ignore Once, Ignore All and Add to Dictionary;
  an offline thesaurus (Shift+F7); word count with readability
- AutoCorrect as you type: the replacement table, TWo INitial CApitals, a lone
  "i", sentence capitals, curly quotes, and the `--`, `...`, `(c)` shortcuts
- **Accessibility**: Check Accessibility reports pictures and drawings with no
  text alternative, tables with no header row or with merged cells, skipped
  heading levels, link text that names no destination, and text whose contrast
  falls below the WCAG AA ratio. Clicking an issue takes the caret to it.
- **Language**: proofing language per document, and switches for
  check-as-you-type spelling and grammar
- **Comments**: new, delete (one, all resolved, or all), previous, next, and the
  comments pane; comments anchor to a selection and can be resolved
- **Tracking**: track changes recording insertions **and** deletions, Display
  for Review (Simple, All, No Markup, Original), Show Markup filters, and a
  reviewing pane listing every revision with its author
- **Changes**: accept and reject one, all, or accept-and-move-to-next, with
  Previous and Next, and a live count of what is pending
- **Compare**: compare against another document; the differences arrive as
  tracked changes

Restrict Editing has no Protect group of its own: the tab strip's Editing /
Reviewing / Viewing picker sets the same flag, and Viewing is where people look
for it.

## View

- Five views: Read Mode, Print Layout, Web Layout, Outline and Draft
- **Immersive Reader**: reading without the editing chrome, with three column
  widths, three text spacings, a white, sepia or grey page, and line focus
- **Show**: ruler, gridlines, navigation pane, header and footer, footnotes and
  endnotes. The navigation pane has a search box and Headings / Results tabs
- **Dark Mode**: the light and dark theme switch, also on the home screen
- Zoom from 10% to 500%, with 100%, One Page, Multiple Pages, Page Width and
  a Zoom dialog
- Ribbon layout: Classic or Single Line, and Always show ribbon, Show tabs only
  or Adjust automatically. The choice is remembered.
- Status bar: the caret's page, word count, proofing language, a spelling
  indicator that opens the Spelling & Grammar pane, tracked-change state,
  read-only state, the five view buttons, the zoom slider and Fit

## Help

- Help, Contact Support and Feedback open this project on GitHub in your own
  browser
- Keyboard Shortcuts lists every binding
- What's New shows the changelog that ships with the app

## Keyboard

Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+P, Ctrl+Z/Y, Ctrl+B/I/U,
Ctrl+L/E/R/J, Ctrl+1/2/5 (line spacing), Ctrl+0 (space before), Ctrl+M and
Ctrl+Shift+M (indent), Ctrl+[ and Ctrl+] (font size), Ctrl+G (go to), Ctrl+Shift+D (double
underline), Ctrl+Shift+K (small caps), Ctrl+K (hyperlink), Ctrl+F, Ctrl+H,
Ctrl+Enter (page break), Ctrl+Shift+8 (formatting marks), Ctrl+F1 (collapse the
ribbon), Ctrl+Shift+E (track changes), Ctrl+Alt+M (comment), Ctrl+Alt+F
(footnote), Ctrl+Alt+D (endnote), Alt+Shift+X (index entry), Alt+Q (search for a
command), F7 (spelling), Shift+F7 (thesaurus).

The same list is in `apps/desktop/src/constants/shortcuts.ts`, which is what
Help > Keyboard Shortcuts renders.

The ribbon itself is keyboard-operable: Left and Right move along the tabs
(Home and End jump to the ends), and a single tab stop puts you on the active
tab rather than walking all eight. Opening a menu moves focus into it, the
arrow keys walk its items, Tab stays inside it, and Escape closes it and puts
focus back on the button. Alt KeyTips are not built.

## Pictures

- Eight resize handles; the corners keep the aspect ratio, and Shift releases it
- A rotation handle, with Shift constraining to 15° steps
- Dragging an inline picture moves it through the text; dragging a floating one
  positions it freely, snapping to the left margin, the page centre, the right
  margin and the baseline grid, with alignment guides
- Arrow keys nudge a floating picture
- Seven wrap modes: In Line, Square, Tight, Through, Top and Bottom, Behind Text
  and In Front of Text
- Picture styles (frames, rounded, oval, shadow), border colour, brightness,
  contrast and saturation, Reset Picture, Bring Forward and Send Backward, a
  size and position dialog, and Alt Text
- Height and width are in inches

## Document formats

DOCX import and export cover paragraphs, headings, character formatting
(bold, italic, underline, strike, colour, font, size, highlight, super- and
subscript), tables including header rows and cell shading, hyperlinks,
bulleted and numbered lists with nesting, images at their real dimensions,
page and column breaks, footnotes, page setup, headers and footers, review comments,
tracked insertions and deletions, and shapes.

RTF import reads character and paragraph formatting; RTF export covers marks,
paragraphs, headings, lists and page breaks. HTML import and export cover
marks, links, tables, lists and images.

### Known limitations

- The editor scrolls continuously; pagination is applied to print and PDF
  output rather than being reflowed live on screen
- `.doc` (the pre-2007 binary format) is imported by shelling out to
  LibreOffice when it is installed, with a plain-text fallback when it is not
- Ink drawings, text boxes, endnotes, bookmarks, index entries, checklists and
  the generated bibliography/index blocks round-trip through `.officewrite` and
  HTML, but DOCX export writes them as ordinary paragraphs
- Compare works at paragraph level, not word level
- The thesaurus is a built-in offline word list, not a licensed data set
- Equations are typed as inline runs in a linear format rather than being
  laid out as a formula
- The accessibility checker reads the document, not the rendered page: it cannot
  judge whether alt text is *useful*, only whether it is there
- Section breaks, macros and password protection are not built. Page setup is
  one record for the whole document, so a `.docx` with sections is flattened
  on import and its sections are lost on save
- Header and footer text is plain, not rich: no per-zone formatting
- There is no picture crop
- The ribbon steps down to a compact density below 1250px rather than
  collapsing whole groups. The Styles tiles fold back into
  their menu there, and the Review tab, the densest at eight groups, still
  overflows below about 1050px. Every other tab holds to 1100px
- Shapes and text boxes are arranged from Layout > Arrange rather than a
  contextual tab of their own

## Not in scope

Officewrite is local-first. It has no accounts, no cloud sync, no collaboration, no
AI features and no telemetry, and it makes no network requests of its own. The
Help tab hands a GitHub URL to your browser, and the main process refuses any
address outside this project's repository.
