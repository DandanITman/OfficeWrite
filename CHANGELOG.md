# Changelog

All notable changes to Officewrite are recorded here. Help > What's New shows this
file inside the app.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
Officewrite uses [semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add a manual desktop update checker in About beside the installed version.
  Its two-arrow button spins while checking the latest published Windows release
  on GitHub and offers the release page when a newer version is available.
  Offline connections skip the request; unreachable services time out without
  interrupting editing. No automatic downloads, installation or background checks.

### Fixed

- Give About an opaque white card with readable grey text in both themes, using
  the shared dialog's close button and Escape handling.

### Documentation

- Explain the optional GitHub update request and remove outdated claims that the
  desktop app never contacts the network. Documents remain local.

### Testing

- Add nine native Electron update-check regressions covering both About themes,
  manual requests, numeric version comparison, trusted release links, cached
  results, offline and reconnect behavior, retries, timeouts, rate limits and
  invalid release information. Keep the existing About-close and bridge checks
  aligned with the new dialog.
- Confirm the built desktop app reaches GitHub and reports the current version;
  inspect About captures in light and dark themes and while offline.
- Pass type checking, desktop and browser builds, the site artifact check, and
  879 tests: 519 unit, 292 editor, 13 browser/site, 28 Windows Electron and
  27 visual checks. Nine optional marketing captures remain skipped.

## [0.6.3] - 2026-09-10

Security and reliability update for the Windows application and browser editor.

### Security

- Process punctuation and space runs in grammar, readability and link-accessibility
  checks without repeated regular-expression backtracking, keeping crafted long
  document text from stalling these checks. Preserve correction ranges and counts.
- Match repeated words at whole Unicode word boundaries so long mixed-script
  words cannot cause repeated suffix scans or false corrections inside a word.
  Filter overlapping grammar corrections using the last retained range instead
  of repeatedly scanning every earlier issue.
- Limit Dependabot to security-update pull requests and group fixes by package
  ecosystem to reduce repeated test runs. Routine version updates are disabled.
- Treat document formatting as values rather than CSS declarations in HTML
  export, editor rendering and clipboard output. Validate fonts, colours,
  alignment and dimensions, encode exported shape styles, and restrict exported
  links to safe protocols.
- Validate native page settings before they become print styles, and escape
  header/footer control characters while preserving page-number counters and
  older document defaults. Reject malformed or excessive layout settings.
- Bound DOCX table spans, column counts and the total logical table grid before
  allocation; reject inconsistent vertical merges. Ordinary merged cells and
  imported column widths retain their layout.
- Block external document pictures in native files, HTML import, paste, editor
  display and copied/exported HTML. Preserve an inert picture placeholder and
  its source; embedded pictures continue to display. Text-box and shape colours
  cannot load remote resources.
- Add production content-security and no-referrer policies to the website,
  browser editor and desktop renderer. Keep normal editing, embedded pictures,
  website tours and installer download links available.
- Update Electron to 44.3.0 to replace its vulnerable ZIP extraction dependency,
  require Node.js 22.12.0 or newer for development, and adapt PDF margins to the
  current API. Windows releases target 64-bit systems; file dialogs without an
  explicit location now start in Downloads.
- Update TipTap to 2.27.3 with its prototype-attribute fix, plus patched Sharp,
  Vitest, XML, YAML and URI dependencies. The TipTap advisory's published version
  range still flags the backported version despite regression coverage.
- Pin workflow actions to immutable commits, limit checkout credentials and
  deployment permissions, and add CodeQL analysis for pull requests and main.

### Testing

- Cover long nonmatching text runs and ordinary punctuation, whitespace and link
  labels in the text-processing regressions.
- Add regression coverage for document CSS and URL handling, blocked resources,
  table allocation limits, native page settings and production security policies.
  Serve the built site without development-script injection in browser tests.

### Documentation

- Document private vulnerability reporting in SECURITY.md.
- Record the successful 0.6.2 Linux and Windows release gates and final test
  counts in the end-to-end review.

### Release

- Synchronize all workspace versions, lockfile and website metadata at 0.6.3.
- The Windows installer remains unsigned. Physical printing and installer
  installation/uninstallation were not exercised by the automated app tests.

## [0.6.2] - 2026-09-09

Includes the template, table and document-safety update. The 0.6.0 and 0.6.1 tags
did not publish installers because release checks found narrow-window ribbon
overlap and clipped table controls with Linux fallback fonts.

### Added

- Add Project Brief, Decision Log, Project Handover, Standard Operating Procedure,
  Creative Brief, Portfolio Case Study, Editorial Calendar and Story Outline.
  The catalogue now has 39 designed templates plus a blank page.
- Add a Templates tab to the website tour with an actual gallery screenshot,
  accessible tab/panel relationships, keyboard navigation and narrow-screen
  coverage.
- Add keyboard operation, explicit row/column counts and a header-row choice to
  the table picker, plus clearer table selection and editing guidance.

### Changed

- Refresh all 31 existing document templates with typography, section rules,
  spacing, callouts, shaded tables and useful column widths. Improve report and
  letter content, provide a two-page greeting card, and correct card/flyer
  descriptions to match their layouts.
- Move the gallery's blank-document action into its header so templates appear
  sooner. Add Creative filtering, result counts, category labels and clear
  filters. Previews reflect document formatting and include all explicit pages;
  the preview dialog traps keyboard focus and returns it when closed.
- Refresh the website headline and introduction to emphasize a modern, free
  word processor; broaden the About section to include office workers and
  creatives and explain the interface's positioning against older alternatives.
- Remove the hero screenshot caption and release-status line, along with their
  unused styles and script updates. Keep direct installer links and release-page
  fallbacks on the download buttons.

### Fixed

- Keep ribbon tabs separate from Comments, editing mode and layout controls in
  narrow windows and with wider fallback fonts. Overflowing tabs remain reachable
  without overlapping the actions.
- Wrap complete Table Layout control groups onto another row when needed,
  keeping table styles and cell shading inside the visible panel with wider fonts.
- Render the selected table style in the resizable editor view. Apply shading
  across mixed header/body cell selections and preserve table formatting in
  document export and import. Keep automatic style colors separate from manual
  cell shading so switching styles still works after reopening a DOCX, and retain
  pasted RGB colors on export.
- Correct row and column sizing for merged cells, row spans and zoom. Fit tables
  to the available page width, reset explicit dimensions through Properties, and
  select actual cells instead of their paragraphs.
- Sort whole table rows by the selected column while retaining the header and
  surrounding document. Disable operations that cannot apply to the selection.
- Preserve explicit zero page margins, paragraph spacing and paragraph border
  sides when reopening DOCX.
- Keep same-named browser imports and unrelated Save As destinations separate;
  retain the correct disk handle for subsequent saves. Surface picker and storage
  failures instead of treating them as cancellation.
- Reject invalid browser rename names, preserve files when rename removal fails,
  and show only supported document files in the browser's document list.
- Write native documents, PDFs, settings and recent-file lists through a flushed
  temporary file before replacing the saved copy. Avoid overwriting a concurrent
  native copy, and validate nested native document nodes and marks before opening
  so malformed content cannot silently become a blank document.
- Recheck unsaved edits after slow document reads and ignore obsolete open
  requests. Serialize each file's complete save pipeline so overlapping saves
  and Save-and-close leave the newest document on disk.
- Show errors from default-folder lookup, rename, copy and PDF export instead
  of leaving failed operations without feedback.
- Print documents in normal page flow so PDF export excludes the editor canvas,
  scrollbars and selection handles and continues long content onto later pages.
  Preserve table proportions and explicit page breaks in multicolumn layouts.

### Build and testing

- Synchronize the application, workspace manifests, lockfile and website version
  for the Windows 0.6.2 release; retain the failed 0.6.0 and 0.6.1 tags unchanged.
- Extend regression coverage for table operations, template creation and DOCX
  round-trips, file-write failures, browser file identity and website navigation.
  Allow the native suite to target a packaged executable with isolated user data.
- Refresh the website's app screenshots and the reviewed gallery visual baseline.

### Documentation

- Require self-contained commit and pull-request descriptions covering material
  changes, their purpose, validation, and limitations, without copying prompts
  or conversation text into the published record.
- Update the feature catalogue and end-to-end review with the new behavior and
  validation evidence.

### Known limitations

- The existing TipTap dependency advisory GHSA-cp6q-959q-f8rh remains; its upstream
  fix requires a major-version migration. This release does not claim to resolve
  it. See docs/REVIEW.md for scope and compatibility limits.

## [0.5.0] - 2026-09-09

First public Windows installer release from the restarted repository.

### Fixed

- Preserve unsaved work when creating or opening another document, keep the
  document dirty after failed saves, and report saving and printing errors.
- Keep edits made during a pending save marked unsaved, and prevent a completed
  save or history request from changing a different document opened meanwhile.
- Preserve live editor content and undo history across first Save, Save As, and
  rename; show import/read errors without replacing the open document.
- Retain the open document after failed deletion and stop creating a copy if
  its prerequisite save fails.
- Preserve all native document metadata, including endnotes, sources,
  citation styles, style sets, and editing restrictions.
- Keep saved preferences across startup; find text across formatting changes,
  replace the selected match as literal text, and refresh live search counts.
- Isolate version history by complete document path and give rapid saves unique
  revision IDs. Ambiguous legacy history remains on disk but is not displayed.
- Translate print page ranges to the native engine's page indexes and wait for
  its completion callback, preserving cancellation and error results.
- Reject malformed DOCX containers; preserve Unicode, hard breaks, code pages,
  and Unicode fallback lengths in RTF; clean temporary legacy import files.
- Prevent browser rename/copy failures from deleting or inventing files, retain
  recoverable browser copies on disk-write failure, and wait for shared storage
  initialization. Report version-history storage quota failures.
- Send browser PDF export directly to its print destination dialog without
  first creating an empty file through the disk picker.
- Handle missing releases and API failures on the website, fix nested error-page
  assets, and support consistent keyboard navigation through the feature tour.
- Move landing-page download controls into a shared row below the introduction
  and screenshot, reducing empty space beneath the image and before the tour.
- Link both website download buttons to the latest release before its API loads,
  and keep release lookup messages short.

### Build and development

- Start the repository with a fresh source history and consolidated project
  configuration, instructions, and regression/release skills.
- Make Windows releases and website deployment explicit; remove automatic
  version-bump commits and publication on source pushes.
- Run release checks and packaging against one immutable tag from main history,
  enforce version consistency, and publish canonical changelog notes with the
  installer. Fail releases that omit the installer.
- Require Node.js 22 or newer and pin Electron to the same 39.8.10 version used
  by development and packaging.
- Add production browser storage tests to local regression and CI, extend native
  and renderer failure coverage, verify complete website build assets, correct
  visual artifact collection, and fail when native QA cannot run.
- Require explicit opt-in before browser tests reuse an existing local server.
- Build Windows installers without implicit publication from the packaging tool;
  the release workflow owns uploading the installer and changelog.

### Documentation

- Correct browser/desktop capability differences, first-release download
  guidance, testing coverage, and development/publishing instructions.
- Record end-to-end review results, outstanding compatibility limits, and the
  existing editor dependency advisory in docs/REVIEW.md.
- Point the README to the Windows installer and live browser app.

### Known limitations

- Existing TipTap dependencies are affected by GHSA-cp6q-959q-f8rh. The upstream
  fix requires a major-version migration; application-specific exploitability
  has not been established. See docs/REVIEW.md for the dependency review.
- Physical printer output, Windows installer installation/uninstallation, and
  external LibreOffice conversion have not been exercised in the release review.

### Added

- A word processor that runs in the browser or offline on Windows, with no
  account and no subscription.
- Opens and saves `.docx`, and reads `.doc`, `.rtf`, `.odt`, `.txt`, `.md` and
  HTML.
- Writing: fonts, colours and text effects, bullets, numbering, checklists and
  multilevel lists, tables, pictures with seven wrap modes, shapes, text boxes
  and freehand ink.
- Structure: a styles gallery, style sets, a table of contents that keeps
  itself current, footnotes and endnotes, captions, cross-references, an index,
  and citations in APA, MLA, Chicago or IEEE.
- Review: spelling and grammar, a built-in offline thesaurus, word count and
  readability, tracked changes, threaded comments, document compare and an
  accessibility checker.
- Mailings: a complete mail merge, envelopes and labels.
- Layout: page setup, margins, columns, line numbers, headers and footers,
  watermarks and print preview.
