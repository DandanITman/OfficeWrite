import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADDRESS_BLOCK,
  DEFAULT_GREETING_LINE,
  LABEL_PRESETS,
  autoMatchFields,
  buildAddressBlock,
  buildGreetingLine,
  checkMergeErrors,
  compareMergeValues,
  comparisonNeedsValue,
  dataSourceFromText,
  dataSourceToCsv,
  detectDelimiter,
  emptyMergeContext,
  includedRecipients,
  labelsPerSheet,
  mergeFieldLabel,
  parseDelimited,
  resolveMergeField,
  type MergeDataSource,
} from './mailMerge';
import {
  buildLabelSheet,
  collectMergeFields,
  collectMergePrompts,
  executeMerge,
  mergeFieldNames,
  usesCompositeFields,
  type DocNode,
} from './mailMergeDocument';

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

const CSV = [
  'First Name,Last Name,Company,Address 1,City,State,ZIP,Country,Email,Balance',
  'Ada,Lovelace,Analytical Engines,12 Mill Lane,Cambridge,Cambs,CB1 2AB,United Kingdom,ada@example.com,240',
  'Grace,Hopper,,"1 Navy Yard, Building 3",Arlington,VA,22202,United States,grace@example.com,0',
  'Alan,Turing,Bletchley Park,,Milton Keynes,Bucks,MK3 6EB,United Kingdom,alan@example.com,90',
].join('\n');

function source(): MergeDataSource {
  return dataSourceFromText(CSV, 'contacts.csv');
}

/** A paragraph holding one merge field, plus a line of ordinary text. */
function docWith(...fields: Array<Record<string, unknown>>): DocNode {
  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, ...fields.map(field => ({ type: 'mergeField', attrs: field }))] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Fixed line.' }] },
    ] as DocNode[],
  };
}

/** All text in a merged result, so tests assert on output rather than shape. */
function textOf(node: DocNode | undefined): string {
  if (!node) return '';
  if (node.type === 'hardBreak') return '\n';
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}

/* ------------------------------------------------------------------ *
 * Reading data sources
 * ------------------------------------------------------------------ */

describe('parsing a recipient list', () => {
  it('detects a comma even when a quoted cell contains one', () => {
    expect(detectDelimiter('a,b,"c,d",e')).toBe(',');
  });

  it('prefers tabs when the header is tab-separated', () => {
    expect(detectDelimiter('First\tLast\tCity')).toBe('\t');
  });

  it('keeps a separator that sits inside quotes', () => {
    const rows = parseDelimited('a,b\n"Smith, John",42');
    expect(rows[1]).toEqual(['Smith, John', '42']);
  });

  it('reads a doubled quote as one literal quote', () => {
    const rows = parseDelimited('a\n"He said ""hi"""');
    expect(rows[1]).toEqual(['He said "hi"']);
  });

  it('strips a UTF-8 byte order mark from the first header', () => {
    const parsed = dataSourceFromText('﻿Name,City\nAda,Cambridge', 'x.csv');
    expect(parsed.fields[0]).toBe('Name');
  });

  it('pads short rows rather than dropping them', () => {
    const parsed = dataSourceFromText('A,B,C\n1,2', 'x.csv');
    expect(parsed.recipients[0].values).toEqual({ A: '1', B: '2', C: '' });
  });

  it('gives duplicate headers distinct names so no column is lost', () => {
    const parsed = dataSourceFromText('Name,Name\nAda,Lovelace', 'x.csv');
    expect(parsed.fields).toEqual(['Name', 'Name 2']);
    expect(parsed.recipients[0].values['Name 2']).toBe('Lovelace');
  });

  it('names a blank header by position', () => {
    const parsed = dataSourceFromText('Name,,City\nAda,x,Cambridge', 'x.csv');
    expect(parsed.fields[1]).toBe('Field 2');
  });

  it('numbers recipients from one, in file order', () => {
    expect(source().recipients.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('ignores a trailing newline instead of adding an empty recipient', () => {
    const parsed = dataSourceFromText('Name\nAda\n', 'x.csv');
    expect(parsed.recipients).toHaveLength(1);
  });

  it('returns an empty source for text with no rows', () => {
    expect(dataSourceFromText('   ', 'x.csv').recipients).toEqual([]);
  });

  it('round-trips through CSV, re-quoting cells that need it', () => {
    const csv = dataSourceToCsv(source());
    const again = dataSourceFromText(csv, 'again.csv');
    expect(again.recipients.map((r) => r.values['Address 1'])).toEqual(
      source().recipients.map((r) => r.values['Address 1']),
    );
  });

  it('counts only the ticked recipients', () => {
    const data = source();
    data.recipients[1].included = false;
    expect(includedRecipients(data).map((r) => r.id)).toEqual([1, 3]);
  });
});

/* ------------------------------------------------------------------ *
 * Match Fields
 * ------------------------------------------------------------------ */

describe('matching columns to the standard address fields', () => {
  it('matches the obvious headers', () => {
    const mapping = autoMatchFields(source().fields);
    expect(mapping['First Name']).toBe('First Name');
    expect(mapping['Postal Code']).toBe('ZIP');
    expect(mapping['Country or Region']).toBe('Country');
    expect(mapping['E-mail Address']).toBe('Email');
  });

  it('matches headers written in other styles', () => {
    const mapping = autoMatchFields(['fname', 'LAST_NAME', 'postcode', 'e-mail']);
    expect(mapping['First Name']).toBe('fname');
    expect(mapping['Last Name']).toBe('LAST_NAME');
    expect(mapping['Postal Code']).toBe('postcode');
    expect(mapping['E-mail Address']).toBe('e-mail');
  });

  it('does not let an email column answer for the street address', () => {
    const mapping = autoMatchFields(['email', 'street']);
    expect(mapping['E-mail Address']).toBe('email');
    expect(mapping['Address 1']).toBe('street');
  });

  it('claims each column at most once', () => {
    const mapping = autoMatchFields(source().fields);
    const claimed = Object.values(mapping).filter(Boolean);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it('leaves a field unmatched when nothing fits', () => {
    expect(autoMatchFields(['Widget'])['First Name']).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Address Block
 * ------------------------------------------------------------------ */

describe('address block', () => {
  const data = source();
  const mapping = autoMatchFields(data.fields);

  it('lays the lines out the way an envelope wants them', () => {
    const lines = buildAddressBlock(data.recipients[0], mapping, DEFAULT_ADDRESS_BLOCK);
    expect(lines).toEqual([
      'Ada Lovelace',
      'Analytical Engines',
      '12 Mill Lane',
      'Cambridge, Cambs  CB1 2AB',
      'United Kingdom',
    ]);
  });

  it('collapses a missing company rather than leaving a blank line', () => {
    const lines = buildAddressBlock(data.recipients[1], mapping, DEFAULT_ADDRESS_BLOCK);
    expect(lines).not.toContain('');
    expect(lines[0]).toBe('Grace Hopper');
    expect(lines[1]).toBe('1 Navy Yard, Building 3');
  });

  it('suppresses the home country and keeps the others', () => {
    const options = { ...DEFAULT_ADDRESS_BLOCK, homeCountry: 'United Kingdom' };
    expect(buildAddressBlock(data.recipients[0], mapping, options)).not.toContain('United Kingdom');
    expect(buildAddressBlock(data.recipients[1], mapping, options)).toContain('United States');
  });

  it('always includes the country when asked to', () => {
    const options = { ...DEFAULT_ADDRESS_BLOCK, countryMode: 'always' as const };
    expect(buildAddressBlock(data.recipients[0], mapping, options)).toContain('United Kingdom');
  });

  it('never includes the country when asked not to', () => {
    const options = { ...DEFAULT_ADDRESS_BLOCK, countryMode: 'never' as const };
    expect(buildAddressBlock(data.recipients[0], mapping, options)).not.toContain('United Kingdom');
  });

  it('drops the name and company when they are turned off', () => {
    const options = { ...DEFAULT_ADDRESS_BLOCK, includeName: false, includeCompany: false };
    expect(buildAddressBlock(data.recipients[0], mapping, options)[0]).toBe('12 Mill Lane');
  });

  it('is empty rather than throwing when nothing is matched', () => {
    expect(buildAddressBlock(data.recipients[0], {}, DEFAULT_ADDRESS_BLOCK)).toEqual([]);
  });

  it('is empty for no recipient at all', () => {
    expect(buildAddressBlock(null, mapping, DEFAULT_ADDRESS_BLOCK)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Greeting Line
 * ------------------------------------------------------------------ */

describe('greeting line', () => {
  const data = source();
  const mapping = autoMatchFields(data.fields);

  it('builds the default "Dear Mr. Randall," shape', () => {
    expect(buildGreetingLine(data.recipients[0], mapping, DEFAULT_GREETING_LINE)).toBe(
      'Dear Lovelace,',
    );
  });

  it('honours the chosen name format', () => {
    const options = { ...DEFAULT_GREETING_LINE, nameFormat: 'first-last' as const };
    expect(buildGreetingLine(data.recipients[0], mapping, options)).toBe('Dear Ada Lovelace,');
  });

  it('honours the chosen salutation and punctuation', () => {
    const options = {
      ...DEFAULT_GREETING_LINE,
      salutation: 'Hi',
      nameFormat: 'first' as const,
      punctuation: '!',
    };
    expect(buildGreetingLine(data.recipients[0], mapping, options)).toBe('Hi Ada!');
  });

  it('drops the punctuation when set to none', () => {
    const options = { ...DEFAULT_GREETING_LINE, punctuation: '(none)' };
    expect(buildGreetingLine(data.recipients[0], mapping, options)).toBe('Dear Lovelace');
  });

  it('drops the salutation when set to none', () => {
    const options = { ...DEFAULT_GREETING_LINE, salutation: '(none)' };
    expect(buildGreetingLine(data.recipients[0], mapping, options)).toBe('Lovelace,');
  });

  /* The one that matters: never "Dear ,". */
  it('falls back to the generic greeting when the row has no name', () => {
    const nameless = { id: 9, values: { City: 'Cambridge' }, included: true };
    expect(buildGreetingLine(nameless, mapping, DEFAULT_GREETING_LINE)).toBe('Dear Sir or Madam,');
  });
});

/* ------------------------------------------------------------------ *
 * Comparisons
 * ------------------------------------------------------------------ */

describe('rule comparisons', () => {
  it('compares numbers numerically, not as text', () => {
    // "10" > "9" is false as strings, which is the classic silent merge bug.
    expect(compareMergeValues('10', 'greaterThan', '9')).toBe(true);
    expect(compareMergeValues('9', 'greaterThan', '10')).toBe(false);
  });

  it('compares text case-insensitively', () => {
    expect(compareMergeValues('Cambridge', 'equal', 'cambridge')).toBe(true);
    expect(compareMergeValues('Cambridge', 'notEqual', 'Oxford')).toBe(true);
  });

  it('handles the boundary comparisons', () => {
    expect(compareMergeValues('5', 'lessOrEqual', '5')).toBe(true);
    expect(compareMergeValues('5', 'greaterOrEqual', '5')).toBe(true);
    expect(compareMergeValues('4', 'lessThan', '5')).toBe(true);
  });

  it('treats whitespace-only as blank', () => {
    expect(compareMergeValues('   ', 'isBlank', '')).toBe(true);
    expect(compareMergeValues('x', 'isNotBlank', '')).toBe(true);
    expect(compareMergeValues('', 'isNotBlank', '')).toBe(false);
  });

  it('says which comparisons need a value, so the UI can disable the box', () => {
    expect(comparisonNeedsValue('equal')).toBe(true);
    expect(comparisonNeedsValue('isBlank')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Resolving one field
 * ------------------------------------------------------------------ */

describe('resolving a field', () => {
  const data = source();
  const mapping = autoMatchFields(data.fields);
  const context = {
    ...emptyMergeContext(),
    recipient: data.recipients[0],
    recordNumber: 1,
    sequenceNumber: 1,
    mapping,
  };

  it('reads a data column', () => {
    expect(resolveMergeField({ kind: 'field', field: 'City' }, context)).toBe('Cambridge');
  });

  it('resolves an unknown column to nothing rather than throwing', () => {
    expect(resolveMergeField({ kind: 'field', field: 'Nope' }, context)).toBe('');
  });

  it('falls back to a bookmark when no column has that name', () => {
    const withBookmark = { ...context, bookmarks: { OrderRef: 'A-1' } };
    expect(resolveMergeField({ kind: 'field', field: 'OrderRef' }, withBookmark)).toBe('A-1');
  });

  it('prefers a real column over a bookmark of the same name', () => {
    const clash = { ...context, bookmarks: { City: 'Nowhere' } };
    expect(resolveMergeField({ kind: 'field', field: 'City' }, clash)).toBe('Cambridge');
  });

  it('joins address block lines with newlines', () => {
    const value = resolveMergeField({ kind: 'addressBlock' }, context);
    expect(value.split('\n')[0]).toBe('Ada Lovelace');
  });

  it('reports the record and sequence numbers separately', () => {
    const late = { ...context, recordNumber: 7, sequenceNumber: 2 };
    expect(resolveMergeField({ kind: 'rule', rule: 'mergeRecord' }, late)).toBe('7');
    expect(resolveMergeField({ kind: 'rule', rule: 'mergeSequence' }, late)).toBe('2');
  });

  it('picks the branch an If rule asks for', () => {
    const attrs = {
      kind: 'rule' as const,
      rule: 'ifThenElse' as const,
      compareField: 'Balance',
      comparison: 'greaterThan' as const,
      compareTo: '100',
      trueText: 'Payment overdue.',
      falseText: 'Thank you.',
    };
    expect(resolveMergeField(attrs, context)).toBe('Payment overdue.');
    expect(
      resolveMergeField(attrs, { ...context, recipient: data.recipients[1] }),
    ).toBe('Thank you.');
  });

  it('prints nothing for the rules that only steer the merge', () => {
    for (const rule of ['nextRecord', 'skipRecordIf', 'setBookmark', 'ask'] as const) {
      expect(resolveMergeField({ kind: 'rule', rule }, context), rule).toBe('');
    }
  });

  it('labels an unmerged field with chevrons', () => {
    expect(mergeFieldLabel({ kind: 'field', field: 'City' })).toBe('«City»');
    expect(mergeFieldLabel({ kind: 'addressBlock' })).toBe('«AddressBlock»');
    expect(mergeFieldLabel({ kind: 'greetingLine' })).toBe('«GreetingLine»');
    expect(mergeFieldLabel({ kind: 'rule', rule: 'nextRecord' })).toBe('«Next Record»');
  });
});

/* ------------------------------------------------------------------ *
 * Walking the document
 * ------------------------------------------------------------------ */

describe('finding fields in a document', () => {
  it('collects every field in document order', () => {
    const doc = docWith({ kind: 'field', field: 'A' }, { kind: 'field', field: 'B' });
    expect(collectMergeFields(doc).map((f) => f.field)).toEqual(['A', 'B']);
  });

  it('reports only data columns as field names', () => {
    const doc = docWith({ kind: 'field', field: 'City' }, { kind: 'addressBlock' });
    expect(mergeFieldNames(doc)).toEqual(['City']);
  });

  it('reports which composite blocks are used', () => {
    expect(usesCompositeFields(docWith({ kind: 'greetingLine' }))).toEqual({
      addressBlock: false,
      greetingLine: true,
    });
  });

  it('collects the prompts a merge has to ask for, once each', () => {
    const doc = docWith(
      { kind: 'rule', rule: 'fillIn', prompt: 'Signed by?', defaultText: 'Ada' },
      { kind: 'rule', rule: 'fillIn', prompt: 'Signed by?' },
      { kind: 'rule', rule: 'ask', name: 'Ref', prompt: 'Reference?' },
    );
    const prompts = collectMergePrompts(doc);
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toMatchObject({ rule: 'fillIn', key: 'Signed by?', defaultText: 'Ada' });
    expect(prompts[1]).toMatchObject({ rule: 'ask', key: 'Ref' });
  });
});

/* ------------------------------------------------------------------ *
 * Running the merge
 * ------------------------------------------------------------------ */

describe('executing a merge', () => {
  const data = source();
  const mapping = autoMatchFields(data.fields);

  it('writes one copy per ticked recipient', () => {
    const doc = docWith({ kind: 'field', field: 'First Name' });
    const result = executeMerge(doc, data, mapping, { type: 'letters' });
    expect(result.merged).toBe(3);
    expect(textOf(result.content)).toContain('Hello Ada');
    expect(textOf(result.content)).toContain('Hello Grace');
    expect(textOf(result.content)).toContain('Hello Alan');
  });

  it('separates letters with a page break but a directory without', () => {
    const doc = docWith({ kind: 'field', field: 'First Name' });
    const letters = executeMerge(doc, data, mapping, { type: 'letters' });
    const directory = executeMerge(doc, data, mapping, { type: 'directory' });
    expect(letters.content.content.filter((n) => n.type === 'pageBreak')).toHaveLength(2);
    expect(directory.content.content.filter((n) => n.type === 'pageBreak')).toHaveLength(0);
  });

  it('honours a record range', () => {
    const doc = docWith({ kind: 'field', field: 'First Name' });
    const result = executeMerge(doc, data, mapping, { type: 'letters', from: 2, to: 3 });
    expect(result.merged).toBe(2);
    expect(textOf(result.content)).not.toContain('Ada');
  });

  it('leaves out unticked recipients', () => {
    const some = source();
    some.recipients[0].included = false;
    const doc = docWith({ kind: 'field', field: 'First Name' });
    const result = executeMerge(doc, some, mapping, { type: 'letters' });
    expect(result.merged).toBe(2);
    expect(textOf(result.content)).not.toContain('Ada');
  });

  it('drops a record a Skip Record If rule rejects', () => {
    const doc = docWith(
      { kind: 'field', field: 'First Name' },
      {
        kind: 'rule',
        rule: 'skipRecordIf',
        compareField: 'Country',
        comparison: 'equal',
        compareTo: 'United States',
      },
    );
    const result = executeMerge(doc, data, mapping, { type: 'letters' });
    expect(result.merged).toBe(2);
    expect(result.skipped).toBe(1);
    expect(textOf(result.content)).not.toContain('Grace');
  });

  it('advances mid-copy on Next Record, so one sheet holds several recipients', () => {
    const doc: DocNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mergeField', attrs: { kind: 'field', field: 'First Name' } },
            { type: 'text', text: ' / ' },
            { type: 'mergeField', attrs: { kind: 'rule', rule: 'nextRecord' } },
            { type: 'mergeField', attrs: { kind: 'field', field: 'First Name' } },
          ],
        },
      ],
    };
    const result = executeMerge(doc, data, mapping, { type: 'labels' });
    // Two records per copy, so three recipients make two copies.
    expect(result.merged).toBe(2);
    expect(textOf(result.content.content[0])).toBe('Ada / Grace');
  });

  it('numbers Merge Record # by the row and Merge Sequence # by the output', () => {
    const some = source();
    some.recipients[0].included = false;
    const doc = docWith(
      { kind: 'rule', rule: 'mergeRecord' },
      { kind: 'rule', rule: 'mergeSequence' },
    );
    const result = executeMerge(doc, some, mapping, { type: 'directory' });
    // Row 2 is the first output, so record 2 / sequence 1.
    expect(textOf(result.content.content[0])).toBe('Hello 21');
  });

  it('uses the answers a Fill-in rule was given', () => {
    const doc = docWith({ kind: 'rule', rule: 'fillIn', prompt: 'Signed by?', defaultText: 'Ada' });
    const answered = executeMerge(doc, data, mapping, {
      type: 'letters',
      to: 1,
      answers: { 'Signed by?': 'Grace Hopper' },
    });
    expect(textOf(answered.content)).toContain('Grace Hopper');
  });

  it('falls back to a Fill-in default when no answer was given', () => {
    const doc = docWith({ kind: 'rule', rule: 'fillIn', prompt: 'Signed by?', defaultText: 'Ada' });
    const result = executeMerge(doc, data, mapping, { type: 'letters', to: 1 });
    expect(textOf(result.content)).toContain('Ada');
  });

  it('makes an Ask answer readable through a field of the same name', () => {
    const doc = docWith(
      { kind: 'rule', rule: 'ask', name: 'Ref', prompt: 'Reference?' },
      { kind: 'field', field: 'Ref' },
    );
    const result = executeMerge(doc, data, mapping, {
      type: 'letters',
      to: 1,
      answers: { Ref: 'INV-7' },
    });
    expect(textOf(result.content)).toContain('INV-7');
  });

  it('applies a Set Bookmark value later in the same copy', () => {
    const doc = docWith(
      { kind: 'rule', rule: 'setBookmark', name: 'Tier', defaultText: 'Gold' },
      { kind: 'field', field: 'Tier' },
    );
    const result = executeMerge(doc, data, mapping, { type: 'letters', to: 1 });
    expect(textOf(result.content)).toContain('Gold');
  });

  it('turns a multi-line address block into hard breaks', () => {
    const doc = docWith({ kind: 'addressBlock' });
    const result = executeMerge(doc, data, mapping, { type: 'letters', to: 1 });
    const paragraph = result.content.content[0];
    expect(paragraph.content?.filter((n) => n.type === 'hardBreak').length).toBeGreaterThan(0);
    expect(textOf(paragraph)).toContain('Ada Lovelace');
    expect(textOf(paragraph)).toContain('Cambridge, Cambs  CB1 2AB');
  });

  it('keeps ordinary text untouched in every copy', () => {
    const doc = docWith({ kind: 'field', field: 'First Name' });
    const result = executeMerge(doc, data, mapping, { type: 'letters' });
    const fixed = result.content.content.filter((node) => textOf(node) === 'Fixed line.');
    expect(fixed).toHaveLength(3);
  });

  /* Without the "advance by at least one" guard this loops for ever. */
  it('terminates on a document with no fields at all', () => {
    const doc: DocNode = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Static.' }] }],
    };
    const result = executeMerge(doc, data, mapping, { type: 'letters' });
    expect(result.merged).toBe(3);
  });

  it('produces the document once, with fields blank, when nothing is ticked', () => {
    const none = source();
    none.recipients.forEach((recipient) => {
      recipient.included = false;
    });
    const doc = docWith({ kind: 'field', field: 'First Name' });
    const result = executeMerge(doc, none, mapping, { type: 'letters' });
    expect(result.merged).toBe(0);
    expect(textOf(result.content)).toContain('Fixed line.');
  });

  it('merges nothing at all when there is no data source', () => {
    const doc = docWith({ kind: 'field', field: 'First Name' });
    expect(executeMerge(doc, null, {}, { type: 'letters' }).merged).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Check for Errors
 * ------------------------------------------------------------------ */

describe('check for errors', () => {
  const data = source();
  const mapping = autoMatchFields(data.fields);
  const none = { addressBlock: false, greetingLine: false };

  it('reports a missing recipient list first and stops there', () => {
    const problems = checkMergeErrors(['City'], null, {}, none);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe('error');
  });

  it('reports a field with no matching column', () => {
    const problems = checkMergeErrors(['Nope'], data, mapping, none);
    expect(problems.some((p) => p.severity === 'error' && p.message.includes('Nope'))).toBe(true);
  });

  it('reports the same missing field only once', () => {
    const problems = checkMergeErrors(['Nope', 'Nope'], data, mapping, none);
    expect(problems.filter((p) => p.message.includes('Nope'))).toHaveLength(1);
  });

  it('passes a document whose fields all exist', () => {
    expect(checkMergeErrors(['City', 'Email'], data, mapping, none)).toEqual([]);
  });

  it('warns when the document has no fields at all', () => {
    const problems = checkMergeErrors([], data, mapping, none);
    expect(problems.some((p) => p.severity === 'warning')).toBe(true);
  });

  it('reports nothing ticked', () => {
    const empty = source();
    empty.recipients.forEach((r) => {
      r.included = false;
    });
    const problems = checkMergeErrors(['City'], empty, mapping, none);
    expect(problems.some((p) => p.message.includes('No recipients are ticked'))).toBe(true);
  });

  it('reports an address block with nothing matched', () => {
    const problems = checkMergeErrors([], data, {}, { addressBlock: true, greetingLine: false });
    expect(problems.some((p) => p.message.includes('Address Block'))).toBe(true);
  });

  it('warns about a greeting line with no name columns', () => {
    const problems = checkMergeErrors([], data, {}, { addressBlock: false, greetingLine: true });
    expect(
      problems.some((p) => p.severity === 'warning' && p.message.includes('Greeting Line')),
    ).toBe(true);
  });

  it('warns about rows that are entirely empty', () => {
    const withBlank = source();
    withBlank.recipients.push({
      id: 4,
      values: Object.fromEntries(withBlank.fields.map((f) => [f, ''])),
      included: true,
    });
    const problems = checkMergeErrors(['City'], withBlank, mapping, none);
    expect(problems.some((p) => p.message.includes('completely empty'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

describe('label sheets', () => {
  it('reports how many labels a stock holds', () => {
    const avery5160 = LABEL_PRESETS.find((preset) => preset.id === 'avery-5160')!;
    expect(labelsPerSheet(avery5160)).toBe(30);
  });

  it('builds a grid of the right size', () => {
    const sheet = buildLabelSheet(3, 10);
    expect(sheet.content).toHaveLength(10);
    expect(sheet.content?.[0].content).toHaveLength(3);
  });

  it('gives every cell but the first a Next Record rule', () => {
    const sheet = buildLabelSheet(2, 2);
    const rules = collectMergeFields(sheet).filter((field) => field.rule === 'nextRecord');
    expect(rules).toHaveLength(3);
  });

  it('walks the whole list from one sheet', () => {
    const data = dataSourceFromText(
      ['Name', 'A', 'B', 'C', 'D'].join('\n'),
      'four.csv',
    );
    const sheet = buildLabelSheet(2, 2);
    const doc: DocNode = { type: 'doc', content: [sheet] };
    const result = executeMerge(doc, data, autoMatchFields(data.fields), { type: 'labels' });
    expect(result.merged).toBe(1);
  });

  it('names every preset and keeps the ids unique', () => {
    expect(new Set(LABEL_PRESETS.map((p) => p.id)).size).toBe(LABEL_PRESETS.length);
    for (const preset of LABEL_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });
});
