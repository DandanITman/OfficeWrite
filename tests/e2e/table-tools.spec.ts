import { test, expect, type Page } from '@playwright/test';
import {
  resetTestState,
  openBlankDocument,
  switchRibbonTab,
  acceptAppDialogs,
  insertDefaultTable,
} from '../helpers/playwright';

const editor = (page: Page) => page.getByTestId('word-editor');

/** Insert the default 3x3 table and put the caret in its first body cell. */
async function insertTable(page: Page) {
  await insertDefaultTable(page);
  await editor(page).locator('table').waitFor({ state: 'visible' });
  await editor(page).locator('td').first().click();
}

/**
 * Click a table tool on the contextual Table Layout tab.
 *
 * The table commands live on a contextual tab that appears only while the
 * caret is inside a table, and Delete Row/Column/Table sit in a menu there.
 */
async function tableTool(page: Page, testId: string) {
  await switchRibbonTab(page, 'tableLayout');
  const inDeleteMenu = ['table-delete-row', 'table-delete-col', 'table-delete'].includes(testId);
  if (inDeleteMenu) await page.getByTestId('table-delete-menu').click();
  await page.getByTestId(testId).click();
}

/**
 * The table tools had no coverage at all.
 *
 * Before this feature existed the app could insert a 3x3 table and never touch
 * it again - there was no way to add or remove a row or column, merge cells,
 * toggle a header row, or delete the table except with undo.
 */
test.describe('Table tools', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  test('TC-TBL-001: the table tools appear only when the caret is in a table', async ({ page }) => {
    await switchRibbonTab(page, 'insert');
    await expect(page.getByTestId('ribbon-tab-tableLayout')).toHaveCount(0);

    await insertTable(page);
    // The contextual tab activates on entering the table.
    await expect(page.getByTestId('ribbon-tab-tableLayout')).toBeVisible();
    await switchRibbonTab(page, 'tableLayout');
    await expect(page.getByTestId('table-add-row-after')).toBeVisible();
  });

  test('TC-TBL-002: inserts a row above and below', async ({ page }) => {
    await insertTable(page);
    // 3x3 with a header row: 1 header row + 2 body rows.
    await expect(editor(page).locator('tr')).toHaveCount(3);

    await tableTool(page, 'table-add-row-before');
    await expect(editor(page).locator('tr')).toHaveCount(4);

    await editor(page).locator('td').first().click();
    await tableTool(page, 'table-add-row-after');
    await expect(editor(page).locator('tr')).toHaveCount(5);
  });

  test('TC-TBL-003: deletes a row', async ({ page }) => {
    await insertTable(page);
    await expect(editor(page).locator('tr')).toHaveCount(3);

    await tableTool(page, 'table-delete-row');
    await expect(editor(page).locator('tr')).toHaveCount(2);
  });

  test('TC-TBL-004: inserts a column left and right', async ({ page }) => {
    await insertTable(page);
    await expect(editor(page).locator('tr').first().locator('th, td')).toHaveCount(3);

    await tableTool(page, 'table-add-col-before');
    await expect(editor(page).locator('tr').first().locator('th, td')).toHaveCount(4);

    await editor(page).locator('td').first().click();
    await tableTool(page, 'table-add-col-after');
    await expect(editor(page).locator('tr').first().locator('th, td')).toHaveCount(5);
  });

  test('TC-TBL-005: deletes a column', async ({ page }) => {
    await insertTable(page);
    await expect(editor(page).locator('tr').first().locator('th, td')).toHaveCount(3);

    await tableTool(page, 'table-delete-col');
    await expect(editor(page).locator('tr').first().locator('th, td')).toHaveCount(2);
  });

  test('TC-TBL-006: merges cells across a selection', async ({ page }) => {
    await insertTable(page);

    // Select the first two cells of the first body row.
    const cells = editor(page).locator('td');
    await cells.nth(0).click();
    await cells.nth(1).click({ modifiers: ['Shift'] });

    await tableTool(page, 'table-merge-cells');

    await expect(editor(page).locator('td[colspan="2"]')).toHaveCount(1);
  });

  test('TC-TBL-007: splits a merged cell again', async ({ page }) => {
    await insertTable(page);

    const cells = editor(page).locator('td');
    await cells.nth(0).click();
    await cells.nth(1).click({ modifiers: ['Shift'] });
    await tableTool(page, 'table-merge-cells');
    await expect(editor(page).locator('td[colspan="2"]')).toHaveCount(1);

    await editor(page).locator('td[colspan="2"]').click();
    await tableTool(page, 'table-split-cell');
    await expect(editor(page).locator('td[colspan="2"]')).toHaveCount(0);
  });

  test('TC-TBL-008: toggles the header row', async ({ page }) => {
    await insertTable(page);
    await expect(editor(page).locator('th')).toHaveCount(3);

    // Toggling from the first body cell converts that row into headers.
    await tableTool(page, 'table-toggle-header');
    await expect(editor(page).locator('th')).not.toHaveCount(3);
  });

  test('TC-TBL-009: deletes the whole table', async ({ page }) => {
    await insertTable(page);
    await expect(editor(page).locator('table')).toHaveCount(1);

    await tableTool(page, 'table-delete');
    await expect(editor(page).locator('table')).toHaveCount(0);
  });

  /**
   * "Select Table" used to run selectAll(), so it selected the whole document.
   * Typing straight after it destroyed everything outside the table.
   */
  test('TC-TBL-011: Select Table selects the table, not the document', async ({ page }) => {
    await page.getByTestId('word-editor').click();
    await page.keyboard.type('Keep this paragraph');
    await page.keyboard.press('Enter');
    await insertTable(page);

    await switchRibbonTab(page, 'tableLayout');
    await page.getByTestId('table-select').click();
    await page.getByRole('menuitem', { name: 'Select Table' }).click();
    await page.keyboard.type('x');

    // The paragraph outside the table must survive.
    await expect(editor(page)).toContainText('Keep this paragraph');
  });

  /**
   * the Cell Size group. There was no way to give a column a specific
   * width at all - the only width control reset them.
   */
  test('TC-TBL-012: column width and row height can be set explicitly', async ({ page }) => {
    await insertTable(page);
    await switchRibbonTab(page, 'tableLayout');

    const before = await editor(page).locator('td').first().evaluate((el) => el.getBoundingClientRect().width);

    await page.getByTestId('table-column-width').fill('3');
    await page.getByTestId('table-column-width').blur();

    await expect
      .poll(async () =>
        editor(page).locator('td').first().evaluate((el) => Math.round(el.getBoundingClientRect().width)),
      )
      .not.toBe(Math.round(before));
  });

  test('TC-TBL-013: distribute columns evens the widths', async ({ page }) => {
    await insertTable(page);
    await switchRibbonTab(page, 'tableLayout');
    await page.getByTestId('table-column-width').fill('1');
    await page.getByTestId('table-column-width').blur();

    await page.getByTestId('table-distribute-columns').click();

    const widths = await editor(page)
      .locator('tr')
      .first()
      .locator('td, th')
      .evaluateAll((cells) => cells.map((c) => Math.round(c.getBoundingClientRect().width)));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(2);
  });

  /**
   * Distribute measured the FIRST table in the document, not the caret's, so
   * in a two-table document it sized the second from the first one's width and
   * wrote widths the table could not hold - persisted through save.
   */
  test('TC-TBL-014: distribute sizes the caret table, not the first one', async ({ page }) => {
    await insertTable(page);
    // A second, narrower table below the first.
    await page.getByTestId('word-editor').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await insertDefaultTable(page);

    const tables = page.getByTestId('word-editor').locator('table');
    await expect(tables).toHaveCount(2);

    // Narrow the first table's columns so the two tables differ in width.
    await tables.first().locator('td').first().click();
    await switchRibbonTab(page, 'tableLayout');
    await page.getByTestId('table-column-width').fill('1');
    await page.getByTestId('table-column-width').blur();

    // Distribute the SECOND table; it must not inherit the first's width.
    await tables.nth(1).locator('td').first().click();
    await switchRibbonTab(page, 'tableLayout');
    await page.getByTestId('table-distribute-columns').click();

    const secondWidth = await tables.nth(1).evaluate((el) => el.getBoundingClientRect().width);
    const cells = await tables
      .nth(1)
      .locator('tr')
      .first()
      .locator('td, th')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
    const summed = cells.reduce((total, width) => total + width, 0);
    // The columns should still add up to their own table, not a narrower one.
    expect(Math.abs(summed - secondWidth)).toBeLessThanOrEqual(8);
  });

  /**
   * The Cell Size group measures the caret's cell on every render, and
   * prosemirror-tables' selectedRect THROWS outside a table rather than
   * returning null. The Table Layout panel renders for a frame after the caret
   * leaves, so clicking out of a table took the entire app to a blank screen.
   */
  test('TC-TBL-015: clicking out of a table does not crash the app', async ({ page }) => {
    await page.getByTestId('word-editor').click();
    await page.keyboard.type('above the table');
    await page.keyboard.press('Enter');
    await insertTable(page);
    await switchRibbonTab(page, 'tableLayout');

    await page.getByTestId('word-editor').locator('> p').first().click();

    // The app must still be there.
    await expect(page.getByTestId('ribbon')).toBeVisible();
    await expect(page.getByTestId('word-editor')).toBeVisible();
  });

  test('TC-TBL-010: typed cell content survives a structural edit', async ({ page }) => {
    await insertTable(page);
    await page.keyboard.type('kept text');
    // AutoCorrect capitalises the sentence's first word.
    await expect(editor(page).locator('td').first()).toContainText('Kept text');

    await editor(page).locator('td').first().click();
    await tableTool(page, 'table-add-row-after');

    await expect(editor(page).locator('td').first()).toContainText('Kept text');
  });
});
