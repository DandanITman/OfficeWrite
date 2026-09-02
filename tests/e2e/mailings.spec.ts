import { test, expect } from '@playwright/test';
import {
  MERGE_CSV,
  MERGE_CSV_PATH,
  acceptAppDialogs,
  attachRecipientList,
  dismissAlert,
  focusEditor,
  insertMergeFieldFor,
  openBlankDocument,
  resetTestState,
  runCommand,
  switchRibbonTab,
  typeInEditor,
} from '../helpers/playwright';

/**
 * The Mailings tab, driven the way a user drives it.
 *
 * Every test here goes through the ribbon and the dialogs - no poking at app
 * state - because the wiring between them is precisely what a mail merge can
 * get wrong: a mapping that never reaches Address Block, a preview that shows
 * one record while Finish & Merge writes another, an Update Labels that doubles
 * its Next Record rules the second time you press it.
 */

const EDITOR = '[data-testid="word-editor"]';

test.describe('Mailings tab', () => {
  test.beforeEach(async ({ page }) => {
    acceptAppDialogs(page);
    await resetTestState(page);
    await openBlankDocument(page);
  });

  /* ---------------------------------------------------------------- *
   * The tab itself
   * ---------------------------------------------------------------- */

  test('TC-MAIL-001: the tab is on the strip with its five groups', async ({ page }) => {
    await switchRibbonTab(page, 'mailings');
    const panel = page.locator('.ribbon-panel');
    for (const group of [
      'Create',
      'Start Mail Merge',
      'Write & Insert Fields',
      'Preview Results',
      'Finish',
    ]) {
      await expect(panel.locator('.rb-group-label', { hasText: group })).toBeVisible();
    }
  });

  test('TC-MAIL-002: field commands are disabled until a list is attached', async ({ page }) => {
    await switchRibbonTab(page, 'mailings');
    // Envelopes and Labels work without a list - one typed address is enough.
    await expect(page.getByTestId('mailings-envelopes')).toBeEnabled();
    await expect(page.getByTestId('mailings-labels')).toBeEnabled();
    // Everything that reads the list does not.
    for (const id of [
      'mailings-edit-recipients',
      'mailings-address-block',
      'mailings-greeting-line',
      'mailings-insert-merge-field',
      'mailings-match-fields',
      'mailings-rules',
      'mailings-highlight-fields',
      'mailings-preview-results',
      'mailings-find-recipient',
      'mailings-finish-merge',
    ]) {
      await expect(page.getByTestId(id), id).toBeDisabled();
    }
  });

  test('TC-MAIL-003: attaching a list enables the rest of the tab', async ({ page }) => {
    await attachRecipientList(page);
    for (const id of [
      'mailings-address-block',
      'mailings-greeting-line',
      'mailings-insert-merge-field',
      'mailings-match-fields',
      'mailings-preview-results',
      'mailings-finish-merge',
    ]) {
      await expect(page.getByTestId(id), id).toBeEnabled();
    }
  });

  test('TC-MAIL-004: a malformed list is refused with an explanation', async ({ page }) => {
    await page.evaluate(() => {
      window.__OFFICEWRITE_TEST__?.seedFile('C:\\OfficewriteTest\\empty.csv', '   ');
      window.__OFFICEWRITE_TEST__?.setOpenDataFileResult('C:\\OfficewriteTest\\empty.csv');
    });
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-select-recipients').click();
    await page.getByTestId('mailings-existing-list').click();
    await dismissAlert(page, /header line/);
    await expect(page.getByTestId('mailings-edit-recipients')).toBeDisabled();
  });

  /* ---------------------------------------------------------------- *
   * Recipients
   * ---------------------------------------------------------------- */

  test('TC-MAIL-005: the recipient list shows every row from the file', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-edit-recipients').click();

    const table = page.getByTestId('recipient-table');
    await expect(table.locator('tbody tr')).toHaveCount(3);
    // The quoted cell kept its comma rather than splitting into two columns.
    await expect(page.getByTestId('recipient-cell-2-Address 1')).toHaveValue(
      '1 Navy Yard, Building 3',
    );
  });

  test('TC-MAIL-006: unticking a row removes it from the merge count', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-edit-recipients').click();
    await page.getByTestId('recipient-include-2').uncheck();
    await page.getByTestId('recipient-list-apply').click();

    await page.getByTestId('mailings-preview-results').click();
    await expect(page.getByTestId('mailings-record-number')).toHaveAttribute('max', '2');
  });

  test('TC-MAIL-007: an edit in the recipient list reaches the merged output', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-edit-recipients').click();
    await page.getByTestId('recipient-cell-1-First Name').fill('Augusta');
    await page.getByTestId('recipient-list-apply').click();

    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();
    await expect(page.locator(EDITOR)).toContainText('Augusta');
  });

  test('TC-MAIL-008: the list can be filtered and sorted without losing rows', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-edit-recipients').click();

    await page.getByTestId('recipient-filter-field').selectOption('Country');
    await page.getByTestId('recipient-filter-text').fill('United Kingdom');
    await expect(page.getByTestId('recipient-table').locator('tbody tr')).toHaveCount(2);

    // Clearing the filter brings the third row back: filtering is a view, not a
    // deletion.
    await page.getByTestId('recipient-filter-text').fill('');
    await expect(page.getByTestId('recipient-table').locator('tbody tr')).toHaveCount(3);

    await page.getByTestId('recipient-sort-field').selectOption('Last Name');
    const first = page.getByTestId('recipient-table').locator('tbody tr').first();
    await expect(first.locator('input[type="text"], input:not([type])').first()).toHaveValue('Grace');
  });

  test('TC-MAIL-009: a typed list can be built without a file', async ({ page }) => {
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-select-recipients').click();
    await page.getByTestId('mailings-new-list').click();

    await page.getByTestId('new-list-cell-0-First Name').fill('Katherine');
    await page.getByTestId('new-list-cell-0-Last Name').fill('Johnson');
    await page.getByTestId('new-list-create').click();

    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();
    await expect(page.locator(EDITOR)).toContainText('Katherine');
  });

  /* ---------------------------------------------------------------- *
   * Inserting fields
   * ---------------------------------------------------------------- */

  test('TC-MAIL-010: a merge field shows as «Field» until previewed', async ({ page }) => {
    await attachRecipientList(page);
    await typeInEditor(page, 'Hello ');
    await insertMergeFieldFor(page, 'First Name');

    const field = page.locator(`${EDITOR} .doc-merge-field`);
    await expect(field).toHaveText('«First Name»');
    await expect(page.locator(EDITOR)).toContainText('Hello «First Name»');
  });

  test('TC-MAIL-011: Insert Merge Field dialog inserts repeatedly without closing', async ({
    page,
  }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-insert-merge-field').click();
    await page.getByTestId('insert-field-list').selectOption('City');
    await page.getByTestId('insert-field-confirm').click();
    await page.getByTestId('insert-field-confirm').click();
    // Still open, so several fields go in one visit.
    await expect(page.getByTestId('insert-merge-field-dialog')).toBeVisible();
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveCount(2);
  });

  test('TC-MAIL-012: Address Block previews the first recipient before inserting', async ({
    page,
  }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-address-block').click();

    const preview = page.getByTestId('address-block-preview');
    await expect(preview).toContainText('Ada Lovelace');
    await expect(preview).toContainText('Analytical Engines');
    await expect(preview).toContainText('Cambridge, Cambs  CB1 2AB');

    // Turning the company off updates the preview immediately.
    await page.getByTestId('address-include-company').uncheck();
    await expect(preview).not.toContainText('Analytical Engines');

    await page.getByTestId('address-block-insert').click();
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveText('«AddressBlock»');
  });

  test('TC-MAIL-013: the country rule suppresses only the home country', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-address-block').click();
    const preview = page.getByTestId('address-block-preview');

    await page.getByTestId('address-home-country').fill('United Kingdom');
    await expect(preview).not.toContainText('United Kingdom');

    await page.getByTestId('address-country-mode').selectOption('always');
    await expect(preview).toContainText('United Kingdom');
  });

  test('TC-MAIL-014: Greeting Line previews and honours its options', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-greeting-line').click();

    const preview = page.getByTestId('greeting-line-preview');
    await expect(preview).toHaveText('Dear Lovelace,');

    await page.getByTestId('greeting-name-format').selectOption('first-last');
    await page.getByTestId('greeting-salutation').selectOption('Hi');
    await page.getByTestId('greeting-punctuation').selectOption('!');
    await expect(preview).toHaveText('Hi Ada Lovelace!');

    await page.getByTestId('greeting-line-insert').click();
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveText('«GreetingLine»');
  });

  test('TC-MAIL-015: Match Fields repoints a standard field at another column', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-match-fields').click();

    // Auto-matching put First Name on the column of the same name.
    await expect(page.getByTestId('match-first-name')).toHaveValue('First Name');
    await page.getByTestId('match-first-name').selectOption('Company');
    await page.getByTestId('match-fields-apply').click();

    await page.getByTestId('mailings-greeting-line').click();
    await page.getByTestId('greeting-name-format').selectOption('first');
    await expect(page.getByTestId('greeting-line-preview')).toHaveText('Dear Analytical Engines,');
  });

  test('TC-MAIL-016: Highlight Merge Fields shades the fields and toggles off', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'City');

    const field = page.locator(`${EDITOR} .doc-merge-field`);
    await expect(field).not.toHaveClass(/is-highlighted/);

    await page.getByTestId('mailings-highlight-fields').click();
    await expect(field).toHaveClass(/is-highlighted/);

    await page.getByTestId('mailings-highlight-fields').click();
    await expect(field).not.toHaveClass(/is-highlighted/);
  });

  /* ---------------------------------------------------------------- *
   * Preview Results
   * ---------------------------------------------------------------- */

  test('TC-MAIL-017: Preview Results swaps fields for real values and back', async ({ page }) => {
    await attachRecipientList(page);
    await typeInEditor(page, 'Hello ');
    await insertMergeFieldFor(page, 'First Name');

    await page.getByTestId('mailings-preview-results').click();
    await expect(page.locator(EDITOR)).toContainText('Hello Ada');
    await expect(page.locator(EDITOR)).not.toContainText('«First Name»');

    await page.getByTestId('mailings-preview-results').click();
    await expect(page.locator(EDITOR)).toContainText('«First Name»');
  });

  test('TC-MAIL-018: the record navigator walks the list and clamps at the ends', async ({
    page,
  }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();

    const editor = page.locator(EDITOR);
    await expect(editor).toContainText('Ada');
    // At the first record, both back buttons are dead.
    await expect(page.getByTestId('mailings-record-first')).toBeDisabled();
    await expect(page.getByTestId('mailings-record-previous')).toBeDisabled();

    await page.getByTestId('mailings-record-next').click();
    await expect(editor).toContainText('Grace');
    await expect(page.getByTestId('mailings-record-number')).toHaveValue('2');

    await page.getByTestId('mailings-record-last').click();
    await expect(editor).toContainText('Alan');
    await expect(page.getByTestId('mailings-record-next')).toBeDisabled();

    await page.getByTestId('mailings-record-first').click();
    await expect(editor).toContainText('Ada');
  });

  test('TC-MAIL-019: typing a record number jumps straight to it', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();

    await page.getByTestId('mailings-record-number').fill('3');
    await expect(page.locator(EDITOR)).toContainText('Alan');
  });

  test('TC-MAIL-020: a field with no column behind it stays visible while previewing', async ({
    page,
  }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'Company');
    await page.getByTestId('mailings-preview-results').click();

    // Grace has no company: the field must read as blank-but-present, not vanish.
    await page.getByTestId('mailings-record-next').click();
    const field = page.locator(`${EDITOR} .doc-merge-field`);
    await expect(field).toHaveClass(/is-empty/);
    await expect(field).toHaveText('(blank)');
  });

  test('TC-MAIL-021: Find Recipient jumps the preview to the matching row', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');
    await page.getByTestId('mailings-preview-results').click();

    await page.getByTestId('mailings-find-recipient').click();
    await page.getByTestId('find-recipient-query').fill('Turing');
    await page.getByTestId('find-recipient-hit-3').click();

    await expect(page.getByTestId('mailings-record-number')).toHaveValue('3');
    await expect(page.locator(EDITOR)).toContainText('Alan');
  });

  /* ---------------------------------------------------------------- *
   * Check for Errors
   * ---------------------------------------------------------------- */

  test('TC-MAIL-022: Check for Errors reports a missing list', async ({ page }) => {
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-check-errors').click();
    await expect(page.getByTestId('merge-errors-list')).toContainText('No recipient list');
  });

  test('TC-MAIL-023: Check for Errors passes a document whose fields all exist', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'City');
    await page.getByTestId('mailings-check-errors').click();
    await expect(page.getByTestId('merge-errors-clean')).toBeVisible();
  });

  test('TC-MAIL-024: Check for Errors warns when there are no fields at all', async ({ page }) => {
    await attachRecipientList(page);
    await page.getByTestId('mailings-check-errors').click();
    await expect(page.getByTestId('merge-errors-list')).toContainText('no merge fields');
  });

  /* ---------------------------------------------------------------- *
   * Rules
   * ---------------------------------------------------------------- */

  test('TC-MAIL-025: an If…Then…Else rule picks its branch per record', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-rules').click();
    await page.getByTestId('mailings-rule-ifThenElse').click();

    await page.getByTestId('rule-compare-field').selectOption('Balance');
    await page.getByTestId('rule-comparison').selectOption('greaterThan');
    await page.getByTestId('rule-compare-to').fill('100');
    await page.getByTestId('rule-true-text').fill('Payment overdue.');
    await page.getByTestId('rule-false-text').fill('Thank you.');
    await page.getByTestId('merge-rule-insert').click();

    await page.getByTestId('mailings-preview-results').click();
    // Ada owes 240.
    await expect(page.locator(EDITOR)).toContainText('Payment overdue.');
    // Grace owes nothing.
    await page.getByTestId('mailings-record-next').click();
    await expect(page.locator(EDITOR)).toContainText('Thank you.');
  });

  test('TC-MAIL-026: Merge Record # inserts without a dialog', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-rules').click();
    await page.getByTestId('mailings-rule-mergeRecord').click();

    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveText('«Merge Record #»');
    await page.getByTestId('mailings-preview-results').click();
    await page.getByTestId('mailings-record-next').click();
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveText('2');
  });

  test('TC-MAIL-027: the Compare to box is disabled for a blank test', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-rules').click();
    await page.getByTestId('mailings-rule-skipRecordIf').click();

    await expect(page.getByTestId('rule-compare-to')).toBeEnabled();
    await page.getByTestId('rule-comparison').selectOption('isBlank');
    await expect(page.getByTestId('rule-compare-to')).toBeDisabled();
  });

  /* ---------------------------------------------------------------- *
   * Finish & Merge
   * ---------------------------------------------------------------- */

  test('TC-MAIL-028: Finish & Merge writes one copy per recipient', async ({ page }) => {
    await attachRecipientList(page);
    await typeInEditor(page, 'Hello ');
    await insertMergeFieldFor(page, 'First Name');

    await page.getByTestId('mailings-finish-merge').click();
    await page.getByTestId('mailings-finish-documents').click();
    await page.getByTestId('finish-merge-confirm').click();
    await dismissAlert(page, /Merged 3 record/);

    const editor = page.locator(EDITOR);
    await expect(editor).toContainText('Hello Ada');
    await expect(editor).toContainText('Hello Grace');
    await expect(editor).toContainText('Hello Alan');
    // The merged copy has no fields left in it.
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveCount(0);
  });

  test('TC-MAIL-029: a record range merges only those recipients', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');

    await page.getByTestId('mailings-finish-merge').click();
    await page.getByTestId('mailings-finish-documents').click();
    await page.getByTestId('merge-range-some').check();
    await page.getByTestId('merge-range-from').fill('2');
    await page.getByTestId('merge-range-to').fill('3');
    await page.getByTestId('finish-merge-confirm').click();
    await dismissAlert(page, /Merged 2 record/);

    const editor = page.locator(EDITOR);
    await expect(editor).toContainText('Grace');
    await expect(editor).toContainText('Alan');
    await expect(editor).not.toContainText('Ada');
  });

  test('TC-MAIL-030: Skip Record If drops a record from the output', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');

    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-rules').click();
    await page.getByTestId('mailings-rule-skipRecordIf').click();
    await page.getByTestId('rule-compare-field').selectOption('Country');
    await page.getByTestId('rule-comparison').selectOption('equal');
    await page.getByTestId('rule-compare-to').fill('United States');
    await page.getByTestId('merge-rule-insert').click();

    await page.getByTestId('mailings-finish-merge').click();
    await page.getByTestId('mailings-finish-documents').click();
    await page.getByTestId('finish-merge-confirm').click();
    await dismissAlert(page, /Merged 2 record/);

    await expect(page.locator(EDITOR)).not.toContainText('Grace');
  });

  test('TC-MAIL-031: a Fill-in rule is answered once at merge time', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-rules').click();
    await page.getByTestId('mailings-rule-fillIn').click();
    await page.getByTestId('rule-prompt').fill('Signed by?');
    await page.getByTestId('rule-default').fill('Ada Lovelace');
    await page.getByTestId('merge-rule-insert').click();

    await page.getByTestId('mailings-finish-merge').click();
    await page.getByTestId('mailings-finish-documents').click();
    // The dialog asks for the answer, pre-filled with the rule's default.
    const answer = page.getByTestId('merge-answer-Signed by?');
    await expect(answer).toHaveValue('Ada Lovelace');
    await answer.fill('Grace Hopper');
    await page.getByTestId('finish-merge-confirm').click();
    await dismissAlert(page, /Merged 3 record/);

    await expect(page.locator(EDITOR)).toContainText('Grace Hopper');
  });

  test('TC-MAIL-032: Merge to Printer prints the merged document', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');

    const before = await page.evaluate(() => window.__OFFICEWRITE_TEST__?.getPrintCallCount() ?? 0);
    await page.getByTestId('mailings-finish-merge').click();
    await page.getByTestId('mailings-finish-print').click();
    await page.getByTestId('finish-merge-confirm').click();

    await expect
      .poll(() => page.evaluate(() => window.__OFFICEWRITE_TEST__?.getPrintCallCount() ?? 0))
      .toBe(before + 1);
  });

  test('TC-MAIL-033: Send E-mail Messages writes one file per recipient', async ({ page }) => {
    await attachRecipientList(page);
    await insertMergeFieldFor(page, 'First Name');

    await page.getByTestId('mailings-finish-merge').click();
    await page.getByTestId('mailings-finish-email').click();
    await page.getByTestId('finish-merge-confirm').click();
    await dismissAlert(page, /one per recipient/);

    const written = await page.evaluate(
      () => window.__OFFICEWRITE_TEST__?.listStoredFiles() ?? [],
    );
    const merged = written.filter((path) => path.includes('example.com'));
    expect(merged).toHaveLength(3);
  });

  /* ---------------------------------------------------------------- *
   * Envelopes and labels
   * ---------------------------------------------------------------- */

  test('TC-MAIL-034: Envelopes adds a typed address above the letter', async ({ page }) => {
    await typeInEditor(page, 'Letter body');
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-envelopes').click();
    await page.getByTestId('envelope-delivery').fill('Ada Lovelace\n12 Mill Lane');
    await page.getByTestId('envelope-return').fill('Officewrite');
    await page.getByTestId('envelope-add').click();

    const editor = page.locator(EDITOR);
    await expect(editor).toContainText('Ada Lovelace');
    await expect(editor).toContainText('Letter body');
  });

  test('TC-MAIL-035: an envelope can take its address from the recipient list', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-envelopes').click();
    await page.getByTestId('envelope-from-recipients').check();
    // The typed box is no longer the source, so it is disabled.
    await expect(page.getByTestId('envelope-delivery')).toBeDisabled();
    await page.getByTestId('envelope-add').click();

    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveText('«AddressBlock»');
  });

  test('TC-MAIL-036: Labels builds a merge-ready sheet of the chosen stock', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-labels').click();
    await page.getByTestId('labels-tab').click();
    await page.getByTestId('label-stock').selectOption('avery-5160');
    await expect(page.getByTestId('label-summary')).toContainText('30 per sheet');
    await page.getByTestId('envelope-from-recipients').check();
    await page.getByTestId('label-add').click();

    // Thirty cells: one address block each, and a Next Record in all but the first.
    await expect(page.locator(`${EDITOR} table td`)).toHaveCount(30);
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveCount(59);
  });

  test('TC-MAIL-037: Update Labels is enabled only for a label merge', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await expect(page.getByTestId('mailings-update-labels')).toBeDisabled();

    await page.getByTestId('mailings-start-merge').click();
    await page.getByTestId('mailings-merge-type-labels').click();
    // Choosing Labels opens the stock picker; dismiss it and check the button.
    await page.getByTestId('envelopes-labels-dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mailings-update-labels')).toBeEnabled();
  });

  test('TC-MAIL-038: Update Labels copies the first label and stays idempotent', async ({
    page,
  }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-labels').click();
    await page.getByTestId('labels-tab').click();
    await page.getByTestId('label-stock').selectOption('avery-5164');
    await page.getByTestId('envelope-from-recipients').check();
    await page.getByTestId('label-add').click();

    // Six cells on this stock: 2 across by 3 down.
    await expect(page.locator(`${EDITOR} table td`)).toHaveCount(6);

    // Type a prefix into the first label, then propagate it.
    await page.locator(`${EDITOR} table td`).first().locator('p').first().click();
    await page.keyboard.press('Home');
    await page.keyboard.type('ATTN: ');
    await page.getByTestId('mailings-update-labels').click();
    await expect(page.locator(`${EDITOR} table td`, { hasText: 'ATTN:' })).toHaveCount(6);

    const rulesAfterFirst = await page
      .locator(`${EDITOR} .doc-merge-field`, { hasText: 'Next Record' })
      .count();
    await page.getByTestId('mailings-update-labels').click();
    // Pressing it twice must not double the rules, or the sheet starts skipping
    // every other recipient.
    await expect(
      page.locator(`${EDITOR} .doc-merge-field`, { hasText: 'Next Record' }),
    ).toHaveCount(rulesAfterFirst);
  });

  test('TC-MAIL-039: Update Labels explains itself on a document with no sheet', async ({ page }) => {
    await attachRecipientList(page);
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-start-merge').click();
    await page.getByTestId('mailings-merge-type-labels').click();
    await page.getByTestId('envelopes-labels-dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');

    await page.getByTestId('mailings-update-labels').click();
    await dismissAlert(page, /needs a label sheet/);
  });

  /* ---------------------------------------------------------------- *
   * The wizard
   * ---------------------------------------------------------------- */

  test('TC-MAIL-040: the wizard walks its six steps and can finish a merge', async ({ page }) => {
    await switchRibbonTab(page, 'mailings');
    await page.getByTestId('mailings-start-merge').click();
    await page.getByTestId('mailings-merge-wizard').click();

    const wizard = page.getByTestId('merge-wizard');
    await expect(wizard).toBeVisible();
    await expect(page.getByTestId('merge-wizard-body')).toContainText('What kind of document');
    // Nothing to go back to on step one.
    await expect(page.getByTestId('merge-wizard-back')).toBeDisabled();

    await page.getByTestId('merge-wizard-next').click();
    await page.getByTestId('merge-wizard-next').click();
    await expect(page.getByTestId('merge-wizard-body')).toContainText('No list attached yet');

    // Attach through the wizard's own button.
    await page.evaluate(
      ({ filePath, content }) => {
        window.__OFFICEWRITE_TEST__?.seedFile(filePath, content);
        window.__OFFICEWRITE_TEST__?.setOpenDataFileResult(filePath);
      },
      { filePath: MERGE_CSV_PATH, content: MERGE_CSV },
    );
    await page.getByTestId('merge-wizard-select').click();
    await expect(page.getByTestId('merge-wizard-body')).toContainText('3 ticked');

    await page.getByTestId('merge-wizard-step-4').click();
    await expect(page.getByTestId('merge-wizard-body')).toContainText('No merge fields');
    await page.getByTestId('merge-wizard-greeting').click();
    await page.getByTestId('greeting-line-insert').click();

    await page.getByTestId('merge-wizard-step-5').click();
    await page.getByTestId('merge-wizard-preview').click();
    await expect(page.locator(EDITOR)).toContainText('Dear Lovelace,');
    await page.getByTestId('merge-wizard-next-record').click();
    await expect(page.locator(EDITOR)).toContainText('Dear Hopper,');

    await page.getByTestId('merge-wizard-step-6').click();
    await page.getByTestId('merge-wizard-finish').click();
    await page.getByTestId('finish-merge-confirm').click();
    await dismissAlert(page, /Merged 3 record/);
    await expect(page.locator(EDITOR)).toContainText('Dear Turing,');

    await page.getByTestId('merge-wizard-close').click();
    await expect(wizard).toBeHidden();
  });

  /* ---------------------------------------------------------------- *
   * Persistence and the command palette
   * ---------------------------------------------------------------- */

  test('TC-MAIL-041: merge fields survive a save and reopen as real fields', async ({ page }) => {
    await attachRecipientList(page);
    await typeInEditor(page, 'Hello ');
    await insertMergeFieldFor(page, 'First Name');

    const path = 'C:\\OfficewriteTest\\merge.officewrite';
    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setSaveFileResult(p), path);
    await page.keyboard.press('Control+s');
    await expect
      .poll(() => page.evaluate((p) => window.__OFFICEWRITE_TEST__?.readStoredFile(p), path))
      .not.toBeNull();

    await page.evaluate((p) => window.__OFFICEWRITE_TEST__?.setOpenFileResult(p), path);
    await page.keyboard.press('Control+o');
    await expect(page.locator(`${EDITOR} .doc-merge-field`)).toHaveText('«First Name»');
  });

  test('TC-MAIL-042: Alt+Q reaches the Mailings commands', async ({ page }) => {
    await attachRecipientList(page);
    await focusEditor(page);
    await runCommand(page, 'check for errors');
    await expect(page.getByTestId('check-merge-errors-dialog')).toBeVisible();
  });
});
