# Officewrite testing guide

Officewrite uses a layered regression suite:

1. **Typecheck + build**: compile the Electron/React app and shared packages
2. **Unit/component tests**: Vitest for document logic, OpenXML, and TipTap editor behavior
3. **End-to-end tests**: Playwright click-through flows against a browser test harness
4. **Visual regression**: Playwright screenshot baselines for key UI states

Run everything locally with one command:

```bash
npm run regression
```

## Quick commands

| Command | Purpose |
|---------|---------|
| `npm run regression` | Full suite (typecheck, build, unit, e2e, visual) |
| `npm test` | Unit/component tests only |
| `npm run test:unit` | Same as `npm test` |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run test:e2e:headed` | E2e tests with visible browser |
| `npm run test:electron` | Tests against a real launched Electron app |
| `npm run test:visual` | Playwright visual snapshot tests |
| `npm run test:visual:update` | Refresh visual baselines after intentional UI changes |

Equivalent commands work with npm workspaces from a fresh clone after `npm install`.

## First-time setup

```bash
npm install
npx playwright install chromium
```

Playwright browser install is required once per machine/CI image. The regression script assumes dependencies are already installed.

**Note:** Playwright is a local project dependency, not a global command. Use `npm run test:e2e` or `npx playwright test`; running `playwright test` directly in PowerShell will fail with "not recognized".

## Why tests may not drive the editor directly

The suite used to expose `runEditorCommand`, which called TipTap commands
straight from a test. Ten tests used it, including one named "applies heading
style from ribbon" that never touched the ribbon, so the wiring between the
controls and the editor shipped almost entirely untested, and the ribbon's
state went stale on every caret move without a single test noticing.

That escape hatch is gone. Tests click real controls. If a control is hard to
reach from a test, that is a signal about the control, not a reason to reach
past it.

The same applied to dialogs: `uiPrompt` had a test-mode branch that fell back
to `window.prompt`, so tests drove native dialogs while users only ever saw the
in-app one. Use `answerPrompt` and `dismissAlert` instead.

## How the browser harness works

Electron IPC is not available in CI, so Playwright tests load `apps/desktop/test.html`, which:

- installs an in-memory `window.officewrite` mock (`tests/helpers/mock-officewrite.ts`)
- persists mock files in `localStorage` for save/reload scenarios
- disables animations via `[data-test-mode]`
- exposes `window.__OFFICEWRITE_TEST__` helpers for deterministic file dialogs and editor content injection
- stubs `window.prompt` / `window.alert` where tests need them (the packaged Electron app uses in-app dialogs instead, because native browser prompts freeze in Electron)

This keeps tests local, deterministic, and free of production services.

## Updating visual snapshots

When you intentionally change UI layout, theme, or ribbon styling:

```bash
npm run test:visual:update
```

Review the changed PNGs under:

- `tests/visual/screens.spec.ts-snapshots/`
- `tests/visual/narrow.spec.ts-snapshots/`

Commit updated baselines together with the UI change.

## Reading screenshot diffs

When a visual test fails, Playwright writes:

- `*-expected.png`: committed baseline
- `*-actual.png`: current render
- `*-diff.png`: highlighted differences

Local HTML report:

```bash
npx playwright show-report
```

In GitHub Actions, download the `visual-snapshot-diffs` artifact from a failed run.

## Adding a new regression test

Tests must exercise the feature through the UI a user actually touches. A test that drives the editor directly proves TipTap works, not that Officewrite's controls are wired to it.

### Unit/component

1. Add a `*.test.ts` file next to the logic under test, or in `packages/core` / `packages/openxml`.
2. Reuse fixtures from `tests/fixtures/regressionDocument.ts` when document content matters.
3. Run `npm test`.

Desktop editor behavior tests live in `apps/desktop/src/editor/editorBehavior.test.ts` and use a TipTap test editor helper.

### End-to-end

1. Add a spec under `tests/e2e/`.
2. Prefer `data-testid` selectors already on ribbon/editor/home elements.
3. Use helpers in `tests/helpers/playwright.ts`.
4. Seed files through `window.__OFFICEWRITE_TEST__` rather than real disk paths.

### Visual

1. Add a screenshot assertion under `tests/visual/`.
2. Mask dynamic regions (status bar counts, filename dirty marker, avatars) via `visualMaskLocators()`.
3. Generate baselines with `npm run test:visual:update`.

Visual snapshots catch differences from the committed baseline. If a bad layout is accepted into the baseline, snapshots will keep passing. Add e2e layout assertions for clipping, offscreen controls, broken picker/dropdown interaction, and other UI problems that need semantic detection.

## Current coverage

### Covered

- Blank document creation from home screen
- Typing and basic editor rendering
- Bold / italic / underline toolbar actions
- Font size and alignment controls
- Bullet and numbered lists
- Undo / redo
- Save to mock filesystem and reload/open restore
- New document + return to home
- Save backstage panel open
- Visual baselines: home, empty editor, formatted document, ribbon, canvas, backstage, narrow viewport, dark theme home
- Layout guard for primary app controls being visible and unclipped
- Document envelope create/serialize/parse
- OpenXML export + `.officewrite` round-trip (existing package tests)

### Known coverage gaps

- Text highlight color
- Page margins and landscape orientation in page setup
- Ribbon Cut/Copy/Paste buttons (keyboard clipboard is covered)
- Decrease paragraph indent (increase is covered)
- Accept/reject single track change (accept/reject all is covered)
- Multi-page print pagination layout

### Out of scope (not built, no tests planned)

- Password protection, equations, section breaks, document compare, thesaurus, macros, cloud sync, AI assistant

### Electron-only (optional manual)

- Native OS file open/save dialogs

## CI layout

GitHub Actions runs two jobs:

- **regression** (Ubuntu): typecheck (app, Electron main and tests), build, unit tests, e2e tests
- **visual** (Windows): screenshot regression tests against committed baselines

Visual snapshots are generated on Windows. Run `npm run test:visual:update` on Windows before committing baseline changes.

## Safety rules

- Tests use mock/local fixtures only. No production services or real user data.
- Existing package tests were kept; the old in-app “Visual QA Auto-Pilot” was removed in favor of this Playwright-based suite.
- Do not skip failing tests without documenting why in this file.

## Electron tests

`npm run test:electron` builds the app and launches the real main process with
Playwright's `_electron` API, against a throwaway `userData` directory.

This layer previously had no coverage at all: everything ran against the
browser harness, so `main.ts`, `preload.ts`, `spell.ts` and `docImport.ts` were
never executed, and the file that claimed to cover them contained three skipped
`expect(true).toBe(true)` bodies behind a `testIgnore`.

The Electron suite covers the full host bridge surface, Hunspell against the
dictionaries the installer actually ships, the persisted user dictionary, real
file reads and writes, the revision store, real PDF output, settings surviving
a restart, the unsaved-changes guard, and opening a document passed on the
command line.

On Linux it needs a display: `xvfb-run -a npm run test:electron`.

If your machine has a pre-provisioned browser at a revision that does not match
the pinned Playwright, point the browser suite at it with
`OFFICEWRITE_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.
