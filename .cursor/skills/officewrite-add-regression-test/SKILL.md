---
name: officewrite-add-regression-test
description: >-
  Add regression tests for Officewrite editor features. Use when implementing new
  word processor features, fixing formatting/persistence bugs, or extending the
  Playwright/Vitest test suite.
---

# Add Officewrite regression tests, fix editor bugs, or extend test coverage.

## Project context

- **Stack:** npm workspaces, Electron + React + TipTap, Vitest (unit), Playwright (e2e + visual)
- **Harness:** Browser tests use `apps/desktop/test.html` with mock `window.officewrite` - not real Electron IPC
- **Catalog:** Every scenario has an ID in `tests/catalog/test-catalog.json`
- **Daniel preference:** Do not run tests, browser QA, visual checks, screenshots, builds, or other automated verification unless Daniel explicitly asks for it in the current turn.

## When adding a feature

1. Add catalog entries (ID, area, priority, type: unit|e2e|visual|electron-manual)
2. Implement automated tests where the harness supports it
3. Mark electron-only flows as `electron-manual` in catalog
4. Add `data-testid` only where selectors would otherwise be fragile
5. Include the `TC-*` catalog ID in the test source so `npm run test:catalog` can verify coverage links
6. Tell Daniel which commands to run; only run them yourself if he explicitly asks in the current turn

## Test file locations

| Type | Path |
|------|------|
| Unit (core) | `packages/core/src/*.test.ts` |
| Unit (openxml) | `packages/openxml/src/*.test.ts` |
| Unit (editor) | `apps/desktop/src/editor/*.test.ts` |
| E2E | `tests/e2e/*.spec.ts` |
| Visual | `tests/visual/*.spec.ts` |
| Fixtures | `tests/fixtures/` |
| Helpers | `tests/helpers/playwright.ts`, `tests/helpers/mock-officewrite.ts` |

## E2E template

```typescript
import { test, expect } from '@playwright/test';
import { resetTestState, openBlankDocument } from '../helpers/playwright';

test.describe('feature area', () => {
  test.beforeEach(async ({ page }) => {
    await resetTestState(page);
  });

  test('TC-XXX: description', async ({ page }) => {
    await openBlankDocument(page);
    // ...
  });
});
```

## Catalog entry template

```json
{
  "id": "TC-EDIT-001",
  "title": "Apply strikethrough from ribbon",
  "area": "edit",
  "priority": "medium",
  "type": "e2e",
  "status": "pending",
  "automated": false
}
```

## Rules

- Do not remove or weaken existing tests
- Do not skip tests without documenting reason in catalog
- Do not run tests locally unless Daniel explicitly asks in the current turn
- Include automated catalog IDs in spec/unit test source, not only in docs or catalog JSON
- Use deterministic fixtures - no real user data or paid services
- Mask dynamic UI in visual tests via `visualMaskLocators()`
- Update `docs/testing.md` coverage section when adding major flows

## Commands

Suggest these for Daniel as needed:

```bash
npm run test:catalog
npm test
npm run test:e2e
npm run test:visual
npm run test:visual:update
npm run regression
```
