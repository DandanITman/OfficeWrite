/**
 * Mail merge: the data model and every rule the Mailings tab can express.
 *
 * The split is deliberate. Everything that decides *what text a field becomes*
 * lives here, with no editor and no DOM, because three callers need the same
 * answer and must never disagree: the merge-field node view drawing a preview,
 * Check for Errors reporting a field with no column behind it, and Finish &
 * Merge writing the finished documents. When that logic lived in the view, the
 * preview and the output were free to drift.
 *
 * Names follow the vocabulary of the field: "recipient" for a row, "field" for a column, and the
 * standard address-field names Match Fields maps onto. Anyone who has used
 * a mail merge before should recognise the vocabulary.
 */

/* ------------------------------------------------------------------ *
 * Documents a merge can produce
 * ------------------------------------------------------------------ */

export type MergeType = 'letters' | 'email' | 'envelopes' | 'labels' | 'directory' | 'normal';

export const MERGE_TYPE_LABELS: Record<MergeType, string> = {
  letters: 'Letters',
  email: 'E-mail Messages',
  envelopes: 'Envelopes',
  labels: 'Labels',
  directory: 'Directory',
  normal: 'Normal Officewrite Document',
};

/**
 * Whether each merged record starts a new page.
 *
 * A directory is the one type that does not: a directory merge exists
 * precisely to run records together into a single list, so page-breaking it
 * would defeat the type. Labels place several records on one sheet and break
 * per sheet rather than per record, which `executeMerge` handles through Next
 * Record rather than here.
 */
export function breaksPerRecord(type: MergeType): boolean {
  return type !== 'directory';
}

/* ------------------------------------------------------------------ *
 * Recipients
 * ------------------------------------------------------------------ */

export interface MergeRecipient {
  /**
   * Position in the original file, 1-based, and stable.
   *
   * Merge Record # reports the row's place in the data source, not its
   * place in whatever order the recipient list happens to be sorted into. An
   * array index could not survive a sort or a filter, so the row carries its
   * own number.
   */
  id: number;
  values: Record<string, string>;
  /** Unticking a row in Edit Recipient List leaves it out of the merge. */
  included: boolean;
}

export interface MergeDataSource {
  /** Shown in the ribbon and the recipient list; usually the file name. */
  name: string;
  /** Column headers, in file order - the order Insert Merge Field lists them. */
  fields: string[];
  recipients: MergeRecipient[];
}

export function emptyDataSource(name = ''): MergeDataSource {
  return { name, fields: [], recipients: [] };
}

/** The rows a merge will actually visit, in recipient-list order. */
export function includedRecipients(source: MergeDataSource | null): MergeRecipient[] {
  return source ? source.recipients.filter((recipient) => recipient.included) : [];
}

/* ------------------------------------------------------------------ *
 * Reading a data source
 * ------------------------------------------------------------------ */

/**
 * Guess the separator from the header line.
 *
 * Counting occurrences outside quotes is what makes this safe: a single CSV
 * column holding `"Smith, John"` has a comma in it, and a naive count would
 * pick comma for a tab-separated file whose first row contained one address.
 */
export function detectDelimiter(headerLine: string): string {
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (let i = 0; i < headerLine.length; i += 1) {
      const char = headerLine[i];
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (!quoted && char === candidate) count += 1;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * A delimited-text reader that handles the three things real exported lists do:
 * quoted fields, separators inside quotes, and doubled quotes as an escape.
 *
 * Written as a character scanner rather than `split`, because splitting on the
 * delimiter tears `"Smith, John"` in half and splitting on newlines tears any
 * address that spans two lines inside one quoted cell.
 */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  if (!clean.trim()) return [];

  const firstBreak = clean.search(/\r?\n/);
  const headerLine = firstBreak === -1 ? clean : clean.slice(0, firstBreak);
  const sep = delimiter ?? detectDelimiter(headerLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const endRow = () => {
    endCell();
    // A trailing newline would otherwise add a row of one empty cell.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
          continue;
        }
        quoted = false;
        continue;
      }
      cell += char;
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === sep) {
      endCell();
      continue;
    }
    if (char === '\r') continue;
    if (char === '\n') {
      endRow();
      continue;
    }
    cell += char;
  }
  if (cell !== '' || row.length > 0) endRow();

  return rows;
}

/**
 * Build a data source from delimited text.
 *
 * Short rows are padded rather than rejected: a hand-edited CSV routinely omits
 * trailing empty columns, and those files still have to load. A blank or duplicated
 * header becomes a positional name so every column stays addressable - two
 * columns called "Name" would otherwise collapse into one and silently lose
 * data.
 */
export function dataSourceFromText(text: string, name: string, delimiter?: string): MergeDataSource {
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) return emptyDataSource(name);

  const seen = new Set<string>();
  const fields = rows[0].map((header, index) => {
    const base = header.trim() || `Field ${index + 1}`;
    if (!seen.has(base)) {
      seen.add(base);
      return base;
    }
    let n = 2;
    while (seen.has(`${base} ${n}`)) n += 1;
    const unique = `${base} ${n}`;
    seen.add(unique);
    return unique;
  });

  const recipients = rows.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    fields.forEach((field, column) => {
      values[field] = cells[column] ?? '';
    });
    return { id: index + 1, values, included: true } satisfies MergeRecipient;
  });

  return { name, fields, recipients };
}

/** Quote a cell only where a reader would otherwise misread it. */
function quoteCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Write the list back out as CSV, so an edited recipient list can be saved. */
export function dataSourceToCsv(source: MergeDataSource): string {
  const lines = [source.fields.map(quoteCell).join(',')];
  for (const recipient of source.recipients) {
    lines.push(source.fields.map((field) => quoteCell(recipient.values[field] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

/* ------------------------------------------------------------------ *
 * Match Fields
 * ------------------------------------------------------------------ */

/**
 * The address fields the Match Fields dialog knows about.
 *
 * Address Block and Greeting Line are written against these names rather than
 * against the user's column headers, which is the whole point of the mapping: a
 * file with a `fname` column still produces a correct greeting once `First
 * Name` points at it.
 */
export const MERGE_ADDRESS_FIELDS = [
  'Courtesy Title',
  'First Name',
  'Last Name',
  'Suffix',
  'Nickname',
  'Job Title',
  'Company',
  'Address 1',
  'Address 2',
  'City',
  'State',
  'Postal Code',
  'Country or Region',
  'Home Phone',
  'Work Phone',
  'E-mail Address',
] as const;

export type MergeAddressField = (typeof MERGE_ADDRESS_FIELDS)[number];

/** Standard address field → the data-source column it reads, or null for "(not matched)". */
export type FieldMapping = Partial<Record<MergeAddressField, string | null>>;

/**
 * Column-header spellings each standard field answers to.
 *
 * Compared after stripping everything but letters and digits, so `first_name`,
 * "First Name" and `FIRSTNAME` all land on the same entry. Ordered
 * most-specific-first: `postcode` must be tried before the bare `zip` fallback,
 * and `E-mail Address` before `Address 1`, or an `email` column matches the
 * street.
 */
const FIELD_ALIASES: Record<MergeAddressField, string[]> = {
  'Courtesy Title': ['courtesytitle', 'title', 'salutation', 'prefix', 'honorific'],
  'First Name': ['firstname', 'first', 'fname', 'givenname', 'forename'],
  'Last Name': ['lastname', 'last', 'lname', 'surname', 'familyname'],
  Suffix: ['suffix', 'namesuffix'],
  Nickname: ['nickname', 'preferredname', 'knownas'],
  'Job Title': ['jobtitle', 'position', 'role', 'occupation'],
  Company: ['company', 'organisation', 'organization', 'employer', 'business'],
  'Address 1': ['address1', 'addressline1', 'address', 'street', 'streetaddress', 'addr1'],
  'Address 2': ['address2', 'addressline2', 'apartment', 'unit', 'suite', 'addr2'],
  City: ['city', 'town', 'locality'],
  State: ['state', 'province', 'county', 'region'],
  'Postal Code': ['postalcode', 'postcode', 'zipcode', 'zip'],
  'Country or Region': ['countryorregion', 'country', 'nation'],
  'Home Phone': ['homephone', 'phone', 'telephone', 'tel', 'mobile', 'cell'],
  'Work Phone': ['workphone', 'officephone', 'businessphone'],
  'E-mail Address': ['emailaddress', 'email', 'mail', 'emailaddr', 'e-mail'],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Guess the mapping from the column headers, as is conventional on attaching a
 * list. Each column is claimed at most once, so a file with both `email` and
 * `address` cannot have one column answer for two standard fields.
 */
export function autoMatchFields(columns: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const taken = new Set<string>();
  const normalized = columns.map((column) => ({ column, key: normalizeHeader(column) }));

  for (const field of MERGE_ADDRESS_FIELDS) {
    const aliases = FIELD_ALIASES[field];
    let match: string | null = null;

    // Exact alias first across all columns, then a contains-match, so a
    // `billing_first_name` column is only used when nothing cleaner exists.
    for (const alias of aliases) {
      const exact = normalized.find((entry) => !taken.has(entry.column) && entry.key === alias);
      if (exact) {
        match = exact.column;
        break;
      }
    }
    if (!match) {
      for (const alias of aliases) {
        const partial = normalized.find(
          (entry) => !taken.has(entry.column) && entry.key.includes(alias),
        );
        if (partial) {
          match = partial.column;
          break;
        }
      }
    }

    mapping[field] = match;
    if (match) taken.add(match);
  }
  return mapping;
}

/** Read a standard address field for a recipient, through the mapping. */
export function mappedValue(
  recipient: MergeRecipient | null,
  mapping: FieldMapping,
  field: MergeAddressField,
): string {
  if (!recipient) return '';
  const column = mapping[field];
  if (!column) return '';
  return (recipient.values[column] ?? '').trim();
}

/* ------------------------------------------------------------------ *
 * Address Block
 * ------------------------------------------------------------------ */

/** The name layouts Insert Address Block offers. */
export const ADDRESS_NAME_FORMATS = [
  { id: 'first-last', label: 'Joshua Randall Jr.', fields: ['First Name', 'Last Name', 'Suffix'] },
  { id: 'title-last', label: 'Mr. Randall', fields: ['Courtesy Title', 'Last Name'] },
  {
    id: 'title-first-last',
    label: 'Mr. Joshua Randall Jr.',
    fields: ['Courtesy Title', 'First Name', 'Last Name', 'Suffix'],
  },
  { id: 'first-only', label: 'Joshua', fields: ['First Name'] },
  { id: 'last-only', label: 'Randall', fields: ['Last Name'] },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  fields: readonly MergeAddressField[];
}>;

export type AddressNameFormatId = (typeof ADDRESS_NAME_FORMATS)[number]['id'];

export interface AddressBlockOptions {
  includeName: boolean;
  nameFormat: AddressNameFormatId;
  includeJobTitle: boolean;
  includeCompany: boolean;
  /** The "Never / Always / Only include when different from" country rule. */
  countryMode: 'never' | 'always' | 'exceptHome';
  /** The home country the `exceptHome` rule suppresses. */
  homeCountry: string;
}

export const DEFAULT_ADDRESS_BLOCK: AddressBlockOptions = {
  includeName: true,
  nameFormat: 'title-first-last',
  includeJobTitle: false,
  includeCompany: true,
  countryMode: 'exceptHome',
  homeCountry: 'United States',
};

/**
 * The address block as lines.
 *
 * Empty parts collapse rather than leaving a blank line, which is the behaviour
 * that makes a merge usable against a real list: half the rows have no Address
 * 2 and no company, and gaps should not be printed for them.
 */
export function buildAddressBlock(
  recipient: MergeRecipient | null,
  mapping: FieldMapping,
  options: AddressBlockOptions = DEFAULT_ADDRESS_BLOCK,
): string[] {
  const read = (field: MergeAddressField) => mappedValue(recipient, mapping, field);
  const lines: string[] = [];

  if (options.includeName) {
    const format =
      ADDRESS_NAME_FORMATS.find((entry) => entry.id === options.nameFormat) ??
      ADDRESS_NAME_FORMATS[2];
    const name = format.fields
      .map((field) => read(field))
      .filter(Boolean)
      .join(' ');
    if (name) lines.push(name);
  }
  if (options.includeJobTitle) {
    const jobTitle = read('Job Title');
    if (jobTitle) lines.push(jobTitle);
  }
  if (options.includeCompany) {
    const company = read('Company');
    if (company) lines.push(company);
  }

  const address1 = read('Address 1');
  if (address1) lines.push(address1);
  const address2 = read('Address 2');
  if (address2) lines.push(address2);

  // "City, State  Postal Code" - the usual spacing, with each part optional.
  const city = read('City');
  const state = read('State');
  const postal = read('Postal Code');
  const cityState = [city, state].filter(Boolean).join(', ');
  const locality = [cityState, postal].filter(Boolean).join('  ');
  if (locality) lines.push(locality);

  const country = read('Country or Region');
  if (country) {
    const home = options.homeCountry.trim().toLowerCase();
    const show =
      options.countryMode === 'always' ||
      (options.countryMode === 'exceptHome' && country.trim().toLowerCase() !== home);
    if (show) lines.push(country);
  }

  return lines;
}

/* ------------------------------------------------------------------ *
 * Greeting Line
 * ------------------------------------------------------------------ */

export const GREETING_SALUTATIONS = ['Dear', 'To', 'Hello', 'Hi', '(none)'] as const;
export const GREETING_PUNCTUATION = [',', ':', '!', '.', '(none)'] as const;

/** The name layouts the Greeting Line dialog offers. */
export const GREETING_NAME_FORMATS = [
  { id: 'title-last', label: 'Mr. Randall', fields: ['Courtesy Title', 'Last Name'] },
  { id: 'first', label: 'Joshua', fields: ['First Name'] },
  { id: 'first-last', label: 'Joshua Randall Jr.', fields: ['First Name', 'Last Name', 'Suffix'] },
  {
    id: 'title-first-last',
    label: 'Mr. Joshua Randall Jr.',
    fields: ['Courtesy Title', 'First Name', 'Last Name', 'Suffix'],
  },
  { id: 'last', label: 'Randall', fields: ['Last Name'] },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  fields: readonly MergeAddressField[];
}>;

export type GreetingNameFormatId = (typeof GREETING_NAME_FORMATS)[number]['id'];

export interface GreetingLineOptions {
  salutation: string;
  nameFormat: GreetingNameFormatId;
  punctuation: string;
  /** Used when the row has no name at all - "Dear Sir or Madam,". */
  invalidGreeting: string;
}

export const DEFAULT_GREETING_LINE: GreetingLineOptions = {
  salutation: 'Dear',
  nameFormat: 'title-last',
  punctuation: ',',
  invalidGreeting: 'Dear Sir or Madam',
};

/**
 * One greeting line.
 *
 * A row with no usable name falls back to the invalid greeting rather than
 * producing "Dear ," - the single most visible way a merge embarrasses whoever
 * sent it.
 */
export function buildGreetingLine(
  recipient: MergeRecipient | null,
  mapping: FieldMapping,
  options: GreetingLineOptions = DEFAULT_GREETING_LINE,
): string {
  const format =
    GREETING_NAME_FORMATS.find((entry) => entry.id === options.nameFormat) ??
    GREETING_NAME_FORMATS[0];
  const name = format.fields
    .map((field) => mappedValue(recipient, mapping, field))
    .filter(Boolean)
    .join(' ');

  const punctuation = options.punctuation === '(none)' ? '' : options.punctuation;
  if (!name) return `${options.invalidGreeting}${punctuation}`;

  const salutation = options.salutation === '(none)' ? '' : options.salutation;
  const greeting = [salutation, name].filter(Boolean).join(' ');
  return `${greeting}${punctuation}`;
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

export type MergeRuleKind =
  | 'ask'
  | 'fillIn'
  | 'ifThenElse'
  | 'mergeRecord'
  | 'mergeSequence'
  | 'nextRecord'
  | 'nextRecordIf'
  | 'skipRecordIf'
  | 'setBookmark';

/** The Rules menu. */
export const MERGE_RULE_LABELS: Record<MergeRuleKind, string> = {
  ask: 'Ask…',
  fillIn: 'Fill-in…',
  ifThenElse: 'If…Then…Else…',
  mergeRecord: 'Merge Record #',
  mergeSequence: 'Merge Sequence #',
  nextRecord: 'Next Record',
  nextRecordIf: 'Next Record If…',
  skipRecordIf: 'Skip Record If…',
  setBookmark: 'Set Bookmark…',
};

export type MergeComparison =
  | 'equal'
  | 'notEqual'
  | 'lessThan'
  | 'greaterThan'
  | 'lessOrEqual'
  | 'greaterOrEqual'
  | 'isBlank'
  | 'isNotBlank';

export const MERGE_COMPARISON_LABELS: Record<MergeComparison, string> = {
  equal: 'Equal to',
  notEqual: 'Not equal to',
  lessThan: 'Less than',
  greaterThan: 'Greater than',
  lessOrEqual: 'Less than or equal',
  greaterOrEqual: 'Greater than or equal',
  isBlank: 'Is blank',
  isNotBlank: 'Is not blank',
};

/** Comparisons that ignore the "Compare to" box, so the UI can disable it. */
export function comparisonNeedsValue(comparison: MergeComparison): boolean {
  return comparison !== 'isBlank' && comparison !== 'isNotBlank';
}

/**
 * Evaluate one comparison.
 *
 * Numbers compare numerically when both sides are numeric, and as
 * case-insensitive text otherwise. Without the numeric branch a "greater than"
 * on a quantity column compares "10" against "9" as strings and reports false,
 * which is the classic silent mail-merge bug.
 */
export function compareMergeValues(
  left: string,
  comparison: MergeComparison,
  right: string,
): boolean {
  const a = (left ?? '').trim();
  const b = (right ?? '').trim();

  if (comparison === 'isBlank') return a === '';
  if (comparison === 'isNotBlank') return a !== '';

  const numA = Number(a);
  const numB = Number(b);
  const numeric = a !== '' && b !== '' && Number.isFinite(numA) && Number.isFinite(numB);

  if (numeric) {
    switch (comparison) {
      case 'equal':
        return numA === numB;
      case 'notEqual':
        return numA !== numB;
      case 'lessThan':
        return numA < numB;
      case 'greaterThan':
        return numA > numB;
      case 'lessOrEqual':
        return numA <= numB;
      case 'greaterOrEqual':
        return numA >= numB;
    }
  }

  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  switch (comparison) {
    case 'equal':
      return lowerA === lowerB;
    case 'notEqual':
      return lowerA !== lowerB;
    case 'lessThan':
      return lowerA < lowerB;
    case 'greaterThan':
      return lowerA > lowerB;
    case 'lessOrEqual':
      return lowerA <= lowerB;
    case 'greaterOrEqual':
      return lowerA >= lowerB;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ *
 * Field resolution
 * ------------------------------------------------------------------ */

/**
 * Everything a merge field can be: a data column, one of the two composite
 * blocks, or a rule. Kept as one attribute set because they all live in the
 * document as the same inline node - they are all fields.
 */
export interface MergeFieldAttrs {
  kind: 'field' | 'addressBlock' | 'greetingLine' | 'rule';
  /** The data-source column, for `kind: 'field'`. */
  field?: string;
  rule?: MergeRuleKind;
  /** Bookmark or prompt name, for ask / fillIn / setBookmark. */
  name?: string;
  prompt?: string;
  defaultText?: string;
  /** The comparison, for ifThenElse / nextRecordIf / skipRecordIf. */
  compareField?: string;
  comparison?: MergeComparison;
  compareTo?: string;
  trueText?: string;
  falseText?: string;
  addressOptions?: AddressBlockOptions;
  greetingOptions?: GreetingLineOptions;
}

/** What a field needs to know about where it sits in the merge. */
export interface MergeContext {
  recipient: MergeRecipient | null;
  /** Merge Record #: the row's place in the data source. */
  recordNumber: number;
  /** Merge Sequence #: how many records this merge has emitted. */
  sequenceNumber: number;
  mapping: FieldMapping;
  /** Answers collected by Ask, keyed by bookmark name. */
  bookmarks: Record<string, string>;
}

export function emptyMergeContext(): MergeContext {
  return { recipient: null, recordNumber: 0, sequenceNumber: 0, mapping: {}, bookmarks: {} };
}

/** How an unmerged field shows in the document: «Field» chevrons. */
export function mergeFieldLabel(attrs: MergeFieldAttrs): string {
  switch (attrs.kind) {
    case 'addressBlock':
      return '«AddressBlock»';
    case 'greetingLine':
      return '«GreetingLine»';
    case 'rule':
      switch (attrs.rule) {
        case 'mergeRecord':
          return '«Merge Record #»';
        case 'mergeSequence':
          return '«Merge Sequence #»';
        case 'nextRecord':
          return '«Next Record»';
        case 'nextRecordIf':
          return '«Next Record If»';
        case 'skipRecordIf':
          return '«Skip Record If»';
        case 'setBookmark':
          return `«Set ${attrs.name || 'Bookmark'}»`;
        case 'ask':
          return `«Ask ${attrs.name || ''}»`.replace(' »', '»');
        case 'fillIn':
          return '«Fill-in»';
        case 'ifThenElse':
          return '«If…Then…Else»';
        default:
          return '«Rule»';
      }
    default:
      return `«${attrs.field ?? ''}»`;
  }
}

/**
 * The text a field becomes for one record.
 *
 * Rules that steer the merge rather than print something - Next Record, Skip
 * Record If, Set Bookmark - resolve to the empty string, and `executeMerge`
 * reads their attributes separately to decide what to do. That keeps this
 * function total: every field has a text answer, even if it is nothing.
 */
export function resolveMergeField(attrs: MergeFieldAttrs, context: MergeContext): string {
  switch (attrs.kind) {
    case 'addressBlock':
      return buildAddressBlock(
        context.recipient,
        context.mapping,
        attrs.addressOptions ?? DEFAULT_ADDRESS_BLOCK,
      ).join('\n');

    case 'greetingLine':
      return buildGreetingLine(
        context.recipient,
        context.mapping,
        attrs.greetingOptions ?? DEFAULT_GREETING_LINE,
      );

    case 'rule':
      switch (attrs.rule) {
        case 'mergeRecord':
          return String(context.recordNumber);
        case 'mergeSequence':
          return String(context.sequenceNumber);
        case 'fillIn':
          // The question is asked once per merge and the answer reused; the prompt's answer
          // is stashed under the prompt text so a second Fill-in with the same
          // wording does not ask twice.
          return context.bookmarks[attrs.prompt ?? ''] ?? attrs.defaultText ?? '';
        case 'ask':
          return '';
        case 'ifThenElse': {
          const left = context.recipient?.values[attrs.compareField ?? ''] ?? '';
          const matched = compareMergeValues(
            left,
            attrs.comparison ?? 'equal',
            attrs.compareTo ?? '',
          );
          return (matched ? attrs.trueText : attrs.falseText) ?? '';
        }
        default:
          // nextRecord, nextRecordIf, skipRecordIf, setBookmark print nothing.
          return '';
      }

    default: {
      const field = attrs.field ?? '';
      if (!field) return '';
      const value = context.recipient?.values[field];
      if (value !== undefined) return value;
      /**
       * A field naming no column falls back to a bookmark of the same name.
       *
       * This is how Ask and Set Bookmark become useful. They are usually paired with a
       * separate REF field, which would mean a second field type and a second
       * dialog for users to learn. Reusing the merge-field syntax they have
       * already met keeps one concept where there would otherwise be two, and Check for Errors
       * still reports a field that matches neither a column nor a bookmark.
       */
      return context.bookmarks[field] ?? '';
    }
  }
}

/* ------------------------------------------------------------------ *
 * Check for Errors
 * ------------------------------------------------------------------ */

export interface MergeProblem {
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Check for Errors, minus the parts that need a printer.
 *
 * Reports what actually breaks a merge: no data source, no ticked rows, a field
 * naming a column the file does not have, and an Address Block or Greeting Line
 * whose mapping has nothing behind it. A field pointing at a missing column is
 * the important one - it merges to empty, so the output looks plausible and
 * wrong.
 */
export function checkMergeErrors(
  fieldNames: string[],
  source: MergeDataSource | null,
  mapping: FieldMapping,
  used: { addressBlock: boolean; greetingLine: boolean },
): MergeProblem[] {
  const problems: MergeProblem[] = [];

  if (!source || source.fields.length === 0) {
    problems.push({
      severity: 'error',
      message: 'No recipient list is attached. Use Select Recipients to choose one.',
    });
    return problems;
  }

  const included = includedRecipients(source).length;
  if (included === 0) {
    problems.push({
      severity: 'error',
      message: `No recipients are ticked. ${source.recipients.length} row(s) are in the list, all excluded.`,
    });
  }

  const unknown = [...new Set(fieldNames)].filter((name) => !source.fields.includes(name));
  for (const name of unknown) {
    problems.push({
      severity: 'error',
      message: `The field «${name}» has no matching column in ${source.name}, so it merges to nothing.`,
    });
  }

  if (used.addressBlock) {
    const hasAddress = Boolean(mapping['Address 1'] || mapping.City || mapping['Postal Code']);
    if (!hasAddress) {
      problems.push({
        severity: 'error',
        message:
          'Address Block has no address columns matched. Use Match Fields to point it at your data.',
      });
    }
  }
  if (used.greetingLine) {
    const hasName = Boolean(mapping['First Name'] || mapping['Last Name']);
    if (!hasName) {
      problems.push({
        severity: 'warning',
        message:
          'Greeting Line has no name columns matched, so every letter falls back to the generic greeting.',
      });
    }
  }

  if (fieldNames.length === 0 && !used.addressBlock && !used.greetingLine) {
    problems.push({
      severity: 'warning',
      message:
        'The document has no merge fields, so every copy will be identical. Use Insert Merge Field to add one.',
    });
  }

  // Rows whose every cell is empty merge to a blank letter.
  const blank = includedRecipients(source).filter((recipient) =>
    source.fields.every((field) => !(recipient.values[field] ?? '').trim()),
  );
  if (blank.length > 0) {
    problems.push({
      severity: 'warning',
      message: `${blank.length} ticked row(s) are completely empty and would merge to a blank document.`,
    });
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * Labels and envelopes
 * ------------------------------------------------------------------ */

export interface LabelPreset {
  id: string;
  name: string;
  columns: number;
  rows: number;
  /** Inches, so the numbers match the box the labels came in. */
  width: number;
  height: number;
}

/** The label stocks offered by default, sized as their vendors specify. */
export const LABEL_PRESETS: LabelPreset[] = [
  { id: 'avery-5160', name: 'Avery 5160 Address', columns: 3, rows: 10, width: 2.63, height: 1 },
  { id: 'avery-5161', name: 'Avery 5161 Address', columns: 2, rows: 10, width: 4, height: 1 },
  { id: 'avery-5162', name: 'Avery 5162 Address', columns: 2, rows: 7, width: 4, height: 1.33 },
  { id: 'avery-5163', name: 'Avery 5163 Shipping', columns: 2, rows: 5, width: 4, height: 2 },
  { id: 'avery-5164', name: 'Avery 5164 Shipping', columns: 2, rows: 3, width: 4, height: 3.33 },
  { id: 'avery-5167', name: 'Avery 5167 Return address', columns: 4, rows: 20, width: 1.75, height: 0.5 },
  { id: 'avery-5395', name: 'Avery 5395 Name badge', columns: 2, rows: 4, width: 3.38, height: 2.33 },
  { id: 'avery-l7160', name: 'Avery L7160 A4 address', columns: 3, rows: 7, width: 2.48, height: 1.5 },
];

export interface EnvelopePreset {
  id: string;
  name: string;
  /** Inches, width before height, as the envelope is fed. */
  width: number;
  height: number;
}

export const ENVELOPE_PRESETS: EnvelopePreset[] = [
  { id: 'size-10', name: 'Size 10 (4⅛ × 9½ in)', width: 9.5, height: 4.125 },
  { id: 'size-6-75', name: 'Size 6¾ (3⅝ × 6½ in)', width: 6.5, height: 3.625 },
  { id: 'size-9', name: 'Size 9 (3⅞ × 8⅞ in)', width: 8.875, height: 3.875 },
  { id: 'monarch', name: 'Monarch (3⅞ × 7½ in)', width: 7.5, height: 3.875 },
  { id: 'dl', name: 'DL (110 × 220 mm)', width: 8.66, height: 4.33 },
  { id: 'c5', name: 'C5 (162 × 229 mm)', width: 9.02, height: 6.38 },
  { id: 'c6', name: 'C6 (114 × 162 mm)', width: 6.38, height: 4.49 },
];

/** How many labels one sheet of the chosen stock holds. */
export function labelsPerSheet(preset: LabelPreset): number {
  return preset.columns * preset.rows;
}
