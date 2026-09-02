import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, Plus, Trash2 } from 'lucide-react';
import {
  ADDRESS_NAME_FORMATS,
  DEFAULT_ADDRESS_BLOCK,
  DEFAULT_GREETING_LINE,
  ENVELOPE_PRESETS,
  GREETING_NAME_FORMATS,
  GREETING_PUNCTUATION,
  GREETING_SALUTATIONS,
  LABEL_PRESETS,
  MERGE_ADDRESS_FIELDS,
  MERGE_COMPARISON_LABELS,
  MERGE_RULE_LABELS,
  MERGE_TYPE_LABELS,
  autoMatchFields,
  buildAddressBlock,
  buildGreetingLine,
  comparisonNeedsValue,
  includedRecipients,
  labelsPerSheet,
  type AddressBlockOptions,
  type AddressNameFormatId,
  type FieldMapping,
  type GreetingLineOptions,
  type GreetingNameFormatId,
  type MergeComparison,
  type MergeDataSource,
  type MergeFieldAttrs,
  type MergeProblem,
  type MergeRecipient,
  type MergeRuleKind,
  type MergeType,
} from '@officewrite/core';
import { Dialog } from './Dialog';

/**
 * The Mailings dialogs.
 *
 * Every one of them is a form over the types in `@officewrite/core`, and none of
 * them touches the editor: they hand a finished value back to App, which owns
 * the document. That split is what lets the merge rules be unit-tested without
 * a DOM, and it stops a dialog from being the only place a rule is understood.
 *
 * The live previews are not decoration. Address Block and Greeting Line
 * dialogs both show the first recipient rendered through the current options,
 * because the options are otherwise impossible to reason about - "Only include
 * the country when different from" means nothing until you can see it applied to
 * a real row.
 */

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function ActionRow({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled,
  testId,
  children,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDisabled?: boolean;
  testId: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="dialog-actions">
      {children}
      <button className="icon-btn" onClick={onCancel}>
        Cancel
      </button>
      <button
        className="icon-btn primary"
        disabled={confirmDisabled}
        data-testid={testId}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

/** The shell the confirm/cancel dialogs share - Dialog only offers one button. */
function FormDialog({
  title,
  testId,
  wide,
  onClose,
  children,
}: {
  title: string;
  testId: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className={`dialog panel-card${wide ? ' dialog-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** The first ticked recipient, which every preview renders against. */
function previewRecipient(source: MergeDataSource | null): MergeRecipient | null {
  return includedRecipients(source)[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Envelopes and Labels
 * ------------------------------------------------------------------ */

export interface EnvelopeRequest {
  deliveryAddress: string;
  returnAddress: string;
  presetId: string;
  /** Read the delivery address from the recipient list instead of the box. */
  fromRecipients: boolean;
}

export interface LabelRequest {
  address: string;
  presetId: string;
  fromRecipients: boolean;
}

/**
 * The Envelopes and Labels dialog, both tabs in one window.
 *
 * Keeping them together matters: the two share the address you just typed, and
 * One window lets you switch tabs without losing it. Two separate dialogs would make
 * "actually, put that on a label instead" a retype.
 */
export function EnvelopesLabelsDialog({
  open,
  initialTab,
  source,
  defaultReturnAddress,
  onInsertEnvelope,
  onInsertLabels,
  onClose,
}: {
  open: boolean;
  initialTab: 'envelopes' | 'labels';
  source: MergeDataSource | null;
  defaultReturnAddress: string;
  onInsertEnvelope: (request: EnvelopeRequest) => void;
  onInsertLabels: (request: LabelRequest) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [delivery, setDelivery] = useState('');
  const [returnAddress, setReturnAddress] = useState(defaultReturnAddress);
  const [envelopeId, setEnvelopeId] = useState(ENVELOPE_PRESETS[0].id);
  const [labelId, setLabelId] = useState(LABEL_PRESETS[0].id);
  const [fromRecipients, setFromRecipients] = useState(false);

  // Reopening from the ribbon must land on the button that was pressed.
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const hasSource = Boolean(source && source.fields.length > 0);
  const label = LABEL_PRESETS.find((preset) => preset.id === labelId) ?? LABEL_PRESETS[0];

  return (
    <FormDialog title="Envelopes and Labels" testId="envelopes-labels-dialog" wide onClose={onClose}>
      <div className="dialog-tabs" role="tablist" aria-label="Envelopes and Labels">
        <button
          role="tab"
          aria-selected={tab === 'envelopes'}
          className={tab === 'envelopes' ? 'active' : ''}
          data-testid="envelopes-tab"
          onClick={() => setTab('envelopes')}
        >
          Envelopes
        </button>
        <button
          role="tab"
          aria-selected={tab === 'labels'}
          className={tab === 'labels' ? 'active' : ''}
          data-testid="labels-tab"
          onClick={() => setTab('labels')}
        >
          Labels
        </button>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={fromRecipients}
          disabled={!hasSource}
          data-testid="envelope-from-recipients"
          onChange={(event) => setFromRecipients(event.target.checked)}
        />
        Use the addresses from the recipient list
        {!hasSource && <span className="muted"> (attach a list first)</span>}
      </label>

      {tab === 'envelopes' ? (
        <>
          <label>
            Delivery address
            <textarea
              rows={4}
              value={delivery}
              disabled={fromRecipients}
              placeholder={fromRecipients ? 'Taken from the recipient list' : 'Name\nStreet\nCity, State  ZIP'}
              aria-label="Delivery address"
              data-testid="envelope-delivery"
              onChange={(event) => setDelivery(event.target.value)}
            />
          </label>
          <label>
            Return address
            <textarea
              rows={3}
              value={returnAddress}
              aria-label="Return address"
              data-testid="envelope-return"
              onChange={(event) => setReturnAddress(event.target.value)}
            />
          </label>
          <label>
            Envelope size
            <select
              value={envelopeId}
              aria-label="Envelope size"
              data-testid="envelope-size"
              onChange={(event) => setEnvelopeId(event.target.value)}
            >
              {ENVELOPE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <ActionRow
            onCancel={onClose}
            onConfirm={() => {
              onInsertEnvelope({
                deliveryAddress: delivery,
                returnAddress,
                presetId: envelopeId,
                fromRecipients,
              });
              onClose();
            }}
            confirmLabel="Add to Document"
            confirmDisabled={!fromRecipients && !delivery.trim()}
            testId="envelope-add"
          />
        </>
      ) : (
        <>
          <label>
            Address
            <textarea
              rows={4}
              value={delivery}
              disabled={fromRecipients}
              placeholder={fromRecipients ? 'Taken from the recipient list' : 'Name\nStreet\nCity, State  ZIP'}
              aria-label="Label address"
              data-testid="label-address"
              onChange={(event) => setDelivery(event.target.value)}
            />
          </label>
          <label>
            Label stock
            <select
              value={labelId}
              aria-label="Label stock"
              data-testid="label-stock"
              onChange={(event) => setLabelId(event.target.value)}
            >
              {LABEL_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted" data-testid="label-summary">
            {label.columns} across × {label.rows} down = {labelsPerSheet(label)} per sheet, each{' '}
            {label.width}″ × {label.height}″.
          </p>
          <ActionRow
            onCancel={onClose}
            onConfirm={() => {
              onInsertLabels({ address: delivery, presetId: labelId, fromRecipients });
              onClose();
            }}
            confirmLabel="New Document"
            confirmDisabled={!fromRecipients && !delivery.trim()}
            testId="label-add"
          />
        </>
      )}
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Edit Recipient List
 * ------------------------------------------------------------------ */

/**
 * The Mail Merge Recipients dialog.
 *
 * Editing cells in place rather than behind a second "Edit…" window, because the
 * one thing everybody does here is fix a typo in one address before sending, and
 * Elsewhere that is four clicks deep.
 */
export function RecipientListDialog({
  open,
  source,
  onApply,
  onClose,
}: {
  open: boolean;
  source: MergeDataSource | null;
  onApply: (source: MergeDataSource) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MergeDataSource | null>(source);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAscending, setSortAscending] = useState(true);
  const [filterField, setFilterField] = useState('');
  const [filterText, setFilterText] = useState('');

  // Reattaching a different list must not leave the previous one on screen.
  useEffect(() => {
    if (open) setDraft(source);
  }, [open, source]);

  const rows = useMemo(() => {
    if (!draft) return [];
    let visible = draft.recipients;
    if (filterField && filterText.trim()) {
      const needle = filterText.trim().toLowerCase();
      visible = visible.filter((recipient) =>
        (recipient.values[filterField] ?? '').toLowerCase().includes(needle),
      );
    }
    if (sortField) {
      // Copied before sorting: mutating would reorder the draft itself, and the
      // row order in the file is what Merge Record # reports.
      visible = [...visible].sort((a, b) => {
        const left = (a.values[sortField] ?? '').toLowerCase();
        const right = (b.values[sortField] ?? '').toLowerCase();
        const compared = left < right ? -1 : left > right ? 1 : 0;
        return sortAscending ? compared : -compared;
      });
    }
    return visible;
  }, [draft, filterField, filterText, sortField, sortAscending]);

  if (!open || !draft) return null;

  const update = (next: MergeDataSource) => setDraft(next);

  const setIncluded = (id: number, included: boolean) =>
    update({
      ...draft,
      recipients: draft.recipients.map((r) => (r.id === id ? { ...r, included } : r)),
    });

  const setValue = (id: number, field: string, value: string) =>
    update({
      ...draft,
      recipients: draft.recipients.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [field]: value } } : r,
      ),
    });

  const setAll = (included: boolean) =>
    update({ ...draft, recipients: draft.recipients.map((r) => ({ ...r, included })) });

  const addRow = () => {
    const values: Record<string, string> = {};
    for (const field of draft.fields) values[field] = '';
    const nextId = draft.recipients.reduce((max, r) => Math.max(max, r.id), 0) + 1;
    update({ ...draft, recipients: [...draft.recipients, { id: nextId, values, included: true }] });
  };

  const removeRow = (id: number) =>
    update({ ...draft, recipients: draft.recipients.filter((r) => r.id !== id) });

  const ticked = draft.recipients.filter((r) => r.included).length;

  return (
    <FormDialog title="Mail Merge Recipients" testId="recipient-list-dialog" wide onClose={onClose}>
      <p className="muted">
        {draft.name}: {draft.recipients.length} row(s), {ticked} ticked. Untick a row to leave it out
        of the merge.
      </p>

      <div className="dialog-grid">
        <label>
          Sort by
          <select
            value={sortField ?? ''}
            aria-label="Sort by"
            data-testid="recipient-sort-field"
            onChange={(event) => setSortField(event.target.value || null)}
          >
            <option value="">(file order)</option>
            {draft.fields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </label>
        <label>
          Direction
          <select
            value={sortAscending ? 'asc' : 'desc'}
            aria-label="Sort direction"
            disabled={!sortField}
            data-testid="recipient-sort-direction"
            onChange={(event) => setSortAscending(event.target.value === 'asc')}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <label>
          Filter column
          <select
            value={filterField}
            aria-label="Filter column"
            data-testid="recipient-filter-field"
            onChange={(event) => setFilterField(event.target.value)}
          >
            <option value="">(no filter)</option>
            {draft.fields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contains
          <input
            type="search"
            value={filterText}
            disabled={!filterField}
            aria-label="Filter text"
            data-testid="recipient-filter-text"
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
      </div>

      <div className="recipient-toolbar">
        <button className="icon-btn" data-testid="recipient-select-all" onClick={() => setAll(true)}>
          <Check size={14} /> Tick all
        </button>
        <button className="icon-btn" data-testid="recipient-select-none" onClick={() => setAll(false)}>
          Untick all
        </button>
        <button className="icon-btn" data-testid="recipient-add-row" onClick={addRow}>
          <Plus size={14} /> New entry
        </button>
      </div>

      <div className="recipient-table-wrap">
        <table className="recipient-table" data-testid="recipient-table">
          <thead>
            <tr>
              <th scope="col">Use</th>
              <th scope="col">#</th>
              {draft.fields.map((field) => (
                <th key={field} scope="col">
                  {field}
                </th>
              ))}
              <th scope="col" aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={draft.fields.length + 3} className="muted">
                  No rows match that filter.
                </td>
              </tr>
            ) : (
              rows.map((recipient) => (
                <tr key={recipient.id} data-testid={`recipient-row-${recipient.id}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={recipient.included}
                      aria-label={`Include row ${recipient.id}`}
                      data-testid={`recipient-include-${recipient.id}`}
                      onChange={(event) => setIncluded(recipient.id, event.target.checked)}
                    />
                  </td>
                  <td className="recipient-number">{recipient.id}</td>
                  {draft.fields.map((field) => (
                    <td key={field}>
                      <input
                        value={recipient.values[field] ?? ''}
                        aria-label={`${field}, row ${recipient.id}`}
                        data-testid={`recipient-cell-${recipient.id}-${field}`}
                        onChange={(event) => setValue(recipient.id, field, event.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      className="icon-btn ghost-muted"
                      title="Remove this entry"
                      aria-label={`Remove row ${recipient.id}`}
                      data-testid={`recipient-remove-${recipient.id}`}
                      onClick={() => removeRow(recipient.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ActionRow
        onCancel={onClose}
        onConfirm={() => {
          onApply(draft);
          onClose();
        }}
        confirmLabel="OK"
        testId="recipient-list-apply"
      />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Type a New List
 * ------------------------------------------------------------------ */

/** The columns New Address List starts with. */
const NEW_LIST_FIELDS = [
  'Title',
  'First Name',
  'Last Name',
  'Company',
  'Address 1',
  'City',
  'State',
  'Postal Code',
  'E-mail Address',
];

/** New Address List: build a data source without leaving the app. */
export function NewRecipientListDialog({
  open,
  onCreate,
  onClose,
}: {
  open: boolean;
  onCreate: (source: MergeDataSource) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<string[]>(NEW_LIST_FIELDS);
  const [rows, setRows] = useState<Array<Record<string, string>>>([{}]);
  const [newField, setNewField] = useState('');

  useEffect(() => {
    if (open) {
      setFields(NEW_LIST_FIELDS);
      setRows([{}]);
      setNewField('');
    }
  }, [open]);

  if (!open) return null;

  const filled = rows.filter((row) => fields.some((field) => (row[field] ?? '').trim()));

  return (
    <FormDialog title="New Address List" testId="new-recipient-list-dialog" wide onClose={onClose}>
      <p className="muted">
        Type the entries you want. Empty rows are dropped, so you can leave the last one blank.
      </p>

      <div className="recipient-toolbar">
        <input
          value={newField}
          placeholder="Add a column, e.g. Order Total"
          aria-label="New column name"
          data-testid="new-list-field-name"
          onChange={(event) => setNewField(event.target.value)}
        />
        <button
          className="icon-btn"
          data-testid="new-list-add-field"
          disabled={!newField.trim() || fields.includes(newField.trim())}
          onClick={() => {
            setFields((prev) => [...prev, newField.trim()]);
            setNewField('');
          }}
        >
          <Plus size={14} /> Add column
        </button>
        <button
          className="icon-btn"
          data-testid="new-list-add-row"
          onClick={() => setRows((prev) => [...prev, {}])}
        >
          <Plus size={14} /> New entry
        </button>
      </div>

      <div className="recipient-table-wrap">
        <table className="recipient-table" data-testid="new-list-table">
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field} scope="col">
                  {field}
                </th>
              ))}
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {fields.map((field) => (
                  <td key={field}>
                    <input
                      value={row[field] ?? ''}
                      aria-label={`${field}, entry ${index + 1}`}
                      data-testid={`new-list-cell-${index}-${field}`}
                      onChange={(event) =>
                        setRows((prev) =>
                          prev.map((entry, i) =>
                            i === index ? { ...entry, [field]: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    className="icon-btn ghost-muted"
                    aria-label={`Remove entry ${index + 1}`}
                    disabled={rows.length === 1}
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ActionRow
        onCancel={onClose}
        onConfirm={() => {
          onCreate({
            name: 'Typed list',
            fields,
            recipients: filled.map((row, index) => {
              const values: Record<string, string> = {};
              for (const field of fields) values[field] = row[field] ?? '';
              return { id: index + 1, values, included: true };
            }),
          });
          onClose();
        }}
        confirmLabel="OK"
        confirmDisabled={filled.length === 0}
        testId="new-list-create"
      >
        <span className="muted">{filled.length} entr{filled.length === 1 ? 'y' : 'ies'}</span>
      </ActionRow>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Insert Merge Field
 * ------------------------------------------------------------------ */

/** The Insert Merge Field dialog: the full column list, with Insert repeatable. */
export function InsertMergeFieldDialog({
  open,
  source,
  onInsert,
  onClose,
}: {
  open: boolean;
  source: MergeDataSource | null;
  onInsert: (field: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState('');

  useEffect(() => {
    if (open) setSelected(source?.fields[0] ?? '');
  }, [open, source]);

  if (!open) return null;
  const fields = source?.fields ?? [];
  const sample = previewRecipient(source);

  return (
    <FormDialog title="Insert Merge Field" testId="insert-merge-field-dialog" onClose={onClose}>
      {fields.length === 0 ? (
        <p className="muted">No recipient list is attached yet.</p>
      ) : (
        <>
          <label>
            Fields
            <select
              size={Math.min(10, Math.max(4, fields.length))}
              value={selected}
              aria-label="Fields"
              data-testid="insert-field-list"
              onChange={(event) => setSelected(event.target.value)}
            >
              {fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>
          {sample && (
            <p className="muted" data-testid="insert-field-sample">
              First recipient: <strong>{sample.values[selected] || '(blank)'}</strong>
            </p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <button className="icon-btn" onClick={onClose}>
          Close
        </button>
        {/* Insert without closing, so several fields can go in
            one after another. */}
        <button
          className="icon-btn primary"
          disabled={!selected}
          data-testid="insert-field-confirm"
          onClick={() => onInsert(selected)}
        >
          Insert
        </button>
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Address Block
 * ------------------------------------------------------------------ */

export function AddressBlockDialog({
  open,
  source,
  mapping,
  onInsert,
  onOpenMatchFields,
  onClose,
}: {
  open: boolean;
  source: MergeDataSource | null;
  mapping: FieldMapping;
  onInsert: (options: AddressBlockOptions) => void;
  onOpenMatchFields: () => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<AddressBlockOptions>(DEFAULT_ADDRESS_BLOCK);

  useEffect(() => {
    if (open) setOptions(DEFAULT_ADDRESS_BLOCK);
  }, [open]);

  if (!open) return null;

  const sample = previewRecipient(source);
  const lines = buildAddressBlock(sample, mapping, options);
  const set = <K extends keyof AddressBlockOptions>(key: K, value: AddressBlockOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  return (
    <FormDialog title="Insert Address Block" testId="address-block-dialog" wide onClose={onClose}>
      <div className="merge-two-col">
        <div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={options.includeName}
              data-testid="address-include-name"
              onChange={(event) => set('includeName', event.target.checked)}
            />
            Insert recipient's name in this format
          </label>
          <label>
            <span className="sr-only">Name format</span>
            <select
              value={options.nameFormat}
              disabled={!options.includeName}
              aria-label="Name format"
              data-testid="address-name-format"
              onChange={(event) => set('nameFormat', event.target.value as AddressNameFormatId)}
            >
              {ADDRESS_NAME_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={options.includeJobTitle}
              data-testid="address-include-job-title"
              onChange={(event) => set('includeJobTitle', event.target.checked)}
            />
            Insert job title
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={options.includeCompany}
              data-testid="address-include-company"
              onChange={(event) => set('includeCompany', event.target.checked)}
            />
            Insert company name
          </label>
          <label>
            Country or region
            <select
              value={options.countryMode}
              aria-label="Country or region"
              data-testid="address-country-mode"
              onChange={(event) =>
                set('countryMode', event.target.value as AddressBlockOptions['countryMode'])
              }
            >
              <option value="never">Never include</option>
              <option value="always">Always include</option>
              <option value="exceptHome">Only when different from</option>
            </select>
          </label>
          {options.countryMode === 'exceptHome' && (
            <label>
              Home country
              <input
                value={options.homeCountry}
                aria-label="Home country"
                data-testid="address-home-country"
                onChange={(event) => set('homeCountry', event.target.value)}
              />
            </label>
          )}
        </div>

        <div>
          <h3>Preview</h3>
          <div className="merge-preview-card" data-testid="address-block-preview">
            {sample ? (
              lines.length > 0 ? (
                lines.map((line, index) => <div key={index}>{line}</div>)
              ) : (
                <p className="muted">
                  Nothing to show. None of the address fields are matched to a column.
                </p>
              )
            ) : (
              <p className="muted">Attach a recipient list to preview a real address.</p>
            )}
          </div>
          <p className="muted">
            <Info size={13} /> If the wrong parts appear, the columns are matched wrongly rather
            than missing.
          </p>
          <button className="icon-btn" data-testid="address-open-match" onClick={onOpenMatchFields}>
            Match Fields…
          </button>
        </div>
      </div>

      <ActionRow
        onCancel={onClose}
        onConfirm={() => {
          onInsert(options);
          onClose();
        }}
        confirmLabel="OK"
        testId="address-block-insert"
      />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Greeting Line
 * ------------------------------------------------------------------ */

export function GreetingLineDialog({
  open,
  source,
  mapping,
  onInsert,
  onOpenMatchFields,
  onClose,
}: {
  open: boolean;
  source: MergeDataSource | null;
  mapping: FieldMapping;
  onInsert: (options: GreetingLineOptions) => void;
  onOpenMatchFields: () => void;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<GreetingLineOptions>(DEFAULT_GREETING_LINE);

  useEffect(() => {
    if (open) setOptions(DEFAULT_GREETING_LINE);
  }, [open]);

  if (!open) return null;

  const sample = previewRecipient(source);
  const set = <K extends keyof GreetingLineOptions>(key: K, value: GreetingLineOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  return (
    <FormDialog title="Insert Greeting Line" testId="greeting-line-dialog" wide onClose={onClose}>
      <div className="dialog-grid">
        <label>
          Greeting
          <select
            value={options.salutation}
            aria-label="Greeting"
            data-testid="greeting-salutation"
            onChange={(event) => set('salutation', event.target.value)}
          >
            {GREETING_SALUTATIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name format
          <select
            value={options.nameFormat}
            aria-label="Name format"
            data-testid="greeting-name-format"
            onChange={(event) => set('nameFormat', event.target.value as GreetingNameFormatId)}
          >
            {GREETING_NAME_FORMATS.map((format) => (
              <option key={format.id} value={format.id}>
                {format.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Punctuation
          <select
            value={options.punctuation}
            aria-label="Punctuation"
            data-testid="greeting-punctuation"
            onChange={(event) => set('punctuation', event.target.value)}
          >
            {GREETING_PUNCTUATION.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label>
          When a row has no name
          <input
            value={options.invalidGreeting}
            aria-label="Greeting for invalid recipient names"
            data-testid="greeting-invalid"
            onChange={(event) => set('invalidGreeting', event.target.value)}
          />
        </label>
      </div>

      <h3>Preview</h3>
      <div className="merge-preview-card" data-testid="greeting-line-preview">
        {sample ? (
          buildGreetingLine(sample, mapping, options)
        ) : (
          <span className="muted">Attach a recipient list to preview a real greeting.</span>
        )}
      </div>
      <button className="icon-btn" data-testid="greeting-open-match" onClick={onOpenMatchFields}>
        Match Fields…
      </button>

      <ActionRow
        onCancel={onClose}
        onConfirm={() => {
          onInsert(options);
          onClose();
        }}
        confirmLabel="OK"
        testId="greeting-line-insert"
      />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Match Fields
 * ------------------------------------------------------------------ */

export function MatchFieldsDialog({
  open,
  source,
  mapping,
  onApply,
  onClose,
}: {
  open: boolean;
  source: MergeDataSource | null;
  mapping: FieldMapping;
  onApply: (mapping: FieldMapping) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FieldMapping>(mapping);

  useEffect(() => {
    if (open) setDraft(mapping);
  }, [open, mapping]);

  if (!open) return null;
  const columns = source?.fields ?? [];
  const sample = previewRecipient(source);

  return (
    <FormDialog title="Match Fields" testId="match-fields-dialog" wide onClose={onClose}>
      <p className="muted">
        Address Block and Greeting Line read these standard fields. Point each one at the column in{' '}
        {source?.name || 'your list'} that holds it.
      </p>

      <div className="recipient-table-wrap">
        <table className="recipient-table" data-testid="match-fields-table">
          <thead>
            <tr>
              <th scope="col">Standard field</th>
              <th scope="col">Column in your list</th>
              <th scope="col">First recipient</th>
            </tr>
          </thead>
          <tbody>
            {MERGE_ADDRESS_FIELDS.map((field) => {
              const column = draft[field] ?? '';
              return (
                <tr key={field}>
                  <th scope="row">{field}</th>
                  <td>
                    <select
                      value={column ?? ''}
                      aria-label={`Column for ${field}`}
                      data-testid={`match-${field.replace(/\s+/g, '-').toLowerCase()}`}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          [field]: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">(not matched)</option>
                      {columns.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="muted">
                    {column && sample ? sample.values[column] || '(blank)' : '(not matched)'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ActionRow
        onCancel={onClose}
        onConfirm={() => {
          onApply(draft);
          onClose();
        }}
        confirmLabel="OK"
        testId="match-fields-apply"
      >
        <button
          className="icon-btn"
          data-testid="match-fields-auto"
          onClick={() => setDraft(autoMatchFields(columns))}
        >
          Match automatically
        </button>
      </ActionRow>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Rules
 * ------------------------------------------------------------------ */

/**
 * The six rules that need configuring, behind one dialog.
 *
 * They share a shape - a comparison, or a name and a default - so six near
 * identical dialogs would be six places to fix the same bug. The fields shown
 * are chosen by rule, which is what separate dialogs would amount to.
 */
export function MergeRuleDialog({
  open,
  rule,
  source,
  onInsert,
  onClose,
}: {
  open: boolean;
  rule: MergeRuleKind | null;
  source: MergeDataSource | null;
  onInsert: (attrs: Partial<MergeFieldAttrs>) => void;
  onClose: () => void;
}) {
  const columns = source?.fields ?? [];
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [defaultText, setDefaultText] = useState('');
  const [compareField, setCompareField] = useState('');
  const [comparison, setComparison] = useState<MergeComparison>('equal');
  const [compareTo, setCompareTo] = useState('');
  const [trueText, setTrueText] = useState('');
  const [falseText, setFalseText] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setPrompt('');
    setDefaultText('');
    setCompareField(columns[0] ?? '');
    setComparison('equal');
    setCompareTo('');
    setTrueText('');
    setFalseText('');
    // columns is derived from source; re-running on a list change is correct.
  }, [open, rule, source]);

  if (!open || !rule) return null;

  const needsComparison =
    rule === 'ifThenElse' || rule === 'nextRecordIf' || rule === 'skipRecordIf';
  const needsName = rule === 'ask' || rule === 'setBookmark';
  const needsPrompt = rule === 'ask' || rule === 'fillIn';

  const valid =
    (!needsComparison || Boolean(compareField)) &&
    (!needsName || Boolean(name.trim())) &&
    (!needsPrompt || rule === 'ask' || Boolean(prompt.trim()));

  return (
    <FormDialog title={MERGE_RULE_LABELS[rule].replace(/…$/, '')} testId="merge-rule-dialog" onClose={onClose}>
      {needsName && (
        <label>
          Bookmark name
          <input
            value={name}
            placeholder="e.g. OrderRef"
            aria-label="Bookmark name"
            data-testid="rule-name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      )}
      {needsPrompt && (
        <label>
          Prompt
          <input
            value={prompt}
            placeholder="What should the app ask you?"
            aria-label="Prompt"
            data-testid="rule-prompt"
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>
      )}
      {(needsName || needsPrompt) && (
        <label>
          {rule === 'setBookmark' ? 'Value' : 'Default answer'}
          <input
            value={defaultText}
            aria-label={rule === 'setBookmark' ? 'Value' : 'Default answer'}
            data-testid="rule-default"
            onChange={(event) => setDefaultText(event.target.value)}
          />
        </label>
      )}

      {needsComparison && (
        <>
          <div className="dialog-grid">
            <label>
              Field name
              <select
                value={compareField}
                aria-label="Field name"
                data-testid="rule-compare-field"
                onChange={(event) => setCompareField(event.target.value)}
              >
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comparison
              <select
                value={comparison}
                aria-label="Comparison"
                data-testid="rule-comparison"
                onChange={(event) => setComparison(event.target.value as MergeComparison)}
              >
                {(Object.keys(MERGE_COMPARISON_LABELS) as MergeComparison[]).map((option) => (
                  <option key={option} value={option}>
                    {MERGE_COMPARISON_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compare to
              <input
                value={compareTo}
                disabled={!comparisonNeedsValue(comparison)}
                aria-label="Compare to"
                data-testid="rule-compare-to"
                onChange={(event) => setCompareTo(event.target.value)}
              />
            </label>
          </div>

          {rule === 'ifThenElse' && (
            <div className="dialog-grid">
              <label>
                Insert this text
                <textarea
                  rows={2}
                  value={trueText}
                  aria-label="Insert this text"
                  data-testid="rule-true-text"
                  onChange={(event) => setTrueText(event.target.value)}
                />
              </label>
              <label>
                Otherwise insert this text
                <textarea
                  rows={2}
                  value={falseText}
                  aria-label="Otherwise insert this text"
                  data-testid="rule-false-text"
                  onChange={(event) => setFalseText(event.target.value)}
                />
              </label>
            </div>
          )}
        </>
      )}

      <ActionRow
        onCancel={onClose}
        onConfirm={() => {
          onInsert({
            kind: 'rule',
            rule,
            name: name.trim(),
            prompt: prompt.trim(),
            defaultText,
            compareField,
            comparison,
            compareTo,
            trueText,
            falseText,
          });
          onClose();
        }}
        confirmLabel="OK"
        confirmDisabled={!valid}
        testId="merge-rule-insert"
      />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Find Recipient
 * ------------------------------------------------------------------ */

export function FindRecipientDialog({
  open,
  source,
  onGoTo,
  onClose,
}: {
  open: boolean;
  source: MergeDataSource | null;
  /** 1-based position among the ticked recipients. */
  onGoTo: (index: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [field, setField] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
      setField('');
    }
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    // Positions are over the ticked rows, because that is what the record
    // navigator counts - jumping to row 40 of a list with 12 ticked is not a
    // place the preview can go.
    return includedRecipients(source)
      .map((recipient, index) => ({ recipient, position: index + 1 }))
      .filter(({ recipient }) => {
        const searched = field ? [recipient.values[field] ?? ''] : Object.values(recipient.values);
        return searched.some((value) => value.toLowerCase().includes(needle));
      });
  }, [query, field, source]);

  if (!open) return null;

  return (
    <FormDialog title="Find Entry" testId="find-recipient-dialog" onClose={onClose}>
      <div className="dialog-grid">
        <label>
          Find
          <input
            type="search"
            value={query}
            autoFocus
            aria-label="Find"
            data-testid="find-recipient-query"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Look in
          <select
            value={field}
            aria-label="Look in"
            data-testid="find-recipient-field"
            onChange={(event) => setField(event.target.value)}
          >
            <option value="">All fields</option>
            {(source?.fields ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="merge-preview-card" data-testid="find-recipient-results">
        {!query.trim() ? (
          <span className="muted">Type something to search the ticked recipients.</span>
        ) : matches.length === 0 ? (
          <span className="muted">Nothing in the list matches “{query}”.</span>
        ) : (
          matches.slice(0, 30).map(({ recipient, position }) => (
            <button
              key={recipient.id}
              type="button"
              className="icon-btn find-recipient-hit"
              data-testid={`find-recipient-hit-${recipient.id}`}
              onClick={() => {
                onGoTo(position);
                onClose();
              }}
            >
              #{recipient.id}: {(source?.fields ?? [])
                .map((f) => recipient.values[f])
                .filter(Boolean)
                .slice(0, 3)
                .join(' · ')}
            </button>
          ))
        )}
      </div>

      <div className="dialog-actions">
        <button className="icon-btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Check for Errors
 * ------------------------------------------------------------------ */

export function CheckMergeErrorsDialog({
  open,
  problems,
  onClose,
}: {
  open: boolean;
  problems: MergeProblem[];
  onClose: () => void;
}) {
  if (!open) return null;

  const errors = problems.filter((problem) => problem.severity === 'error');

  return (
    <Dialog title="Check for Errors" testId="check-merge-errors-dialog" onClose={onClose} wide>
      {problems.length === 0 ? (
        <p data-testid="merge-errors-clean">
          <Check size={15} /> No problems found. Every field has a column behind it and the ticked
          rows all carry data.
        </p>
      ) : (
        <>
          <p className="muted">
            {errors.length} problem(s) would break the merge; the rest are worth a look.
          </p>
          <ul className="merge-problem-list" data-testid="merge-errors-list">
            {problems.map((problem, index) => (
              <li key={index} className={problem.severity}>
                <AlertTriangle size={14} aria-hidden />
                <span>{problem.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 * Finish & Merge
 * ------------------------------------------------------------------ */

export interface FinishMergeRequest {
  from: number;
  to: number;
  answers: Record<string, string>;
}

/** Merge to New Document / Merge to Printer: pick the record range. */
export function FinishMergeDialog({
  open,
  destination,
  recordCount,
  prompts,
  onConfirm,
  onClose,
}: {
  open: boolean;
  destination: 'documents' | 'print' | 'email';
  recordCount: number;
  prompts: Array<{ rule: 'ask' | 'fillIn'; key: string; prompt: string; defaultText: string }>;
  onConfirm: (request: FinishMergeRequest) => void;
  onClose: () => void;
}) {
  const [all, setAll] = useState(true);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(recordCount);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  /**
   * The form resets when the dialog opens, and only then.
   *
   * Read through a ref rather than from the effect's dependency list, because
   * `prompts` is derived from the document and so arrives as a fresh array on
   * every render of the app. Depending on it re-ran this effect while the dialog
   * was open - which snapped the range picker back to "All" the moment anything
   * upstream re-rendered, so typing a range and pressing OK silently merged
   * everybody.
   */
  const latest = useRef({ recordCount, prompts });
  latest.current = { recordCount, prompts };

  useEffect(() => {
    if (!open) return;
    setAll(true);
    setFrom(1);
    setTo(latest.current.recordCount);
    // Pre-fill with each rule's default, so a merge with prompts still runs on
    // one click when the defaults are what you wanted.
    const seeded: Record<string, string> = {};
    for (const entry of latest.current.prompts) seeded[entry.key] = entry.defaultText;
    setAnswers(seeded);
  }, [open]);

  if (!open) return null;

  const titles = {
    documents: 'Merge to New Document',
    print: 'Merge to Printer',
    email: 'Merge to E-mail Messages',
  } as const;

  return (
    <FormDialog title={titles[destination]} testId="finish-merge-dialog" onClose={onClose}>
      <fieldset className="merge-range">
        <legend>Merge records</legend>
        <label className="checkbox-row">
          <input
            type="radio"
            name="merge-range"
            checked={all}
            data-testid="merge-range-all"
            onChange={() => setAll(true)}
          />
          All {recordCount} ticked recipients
        </label>
        <label className="checkbox-row">
          <input
            type="radio"
            name="merge-range"
            checked={!all}
            data-testid="merge-range-some"
            onChange={() => setAll(false)}
          />
          From
          <input
            type="number"
            min={1}
            max={recordCount}
            value={from}
            disabled={all}
            aria-label="From record"
            data-testid="merge-range-from"
            onChange={(event) => setFrom(Number(event.target.value))}
          />
          to
          <input
            type="number"
            min={1}
            max={recordCount}
            value={to}
            disabled={all}
            aria-label="To record"
            data-testid="merge-range-to"
            onChange={(event) => setTo(Number(event.target.value))}
          />
        </label>
      </fieldset>

      {prompts.length > 0 && (
        <>
          <h3>Answers this merge needs</h3>
          {prompts.map((entry) => (
            <label key={`${entry.rule}:${entry.key}`}>
              {entry.prompt}
              <input
                value={answers[entry.key] ?? ''}
                aria-label={entry.prompt}
                data-testid={`merge-answer-${entry.key}`}
                onChange={(event) =>
                  setAnswers((prev) => ({ ...prev, [entry.key]: event.target.value }))
                }
              />
            </label>
          ))}
        </>
      )}

      {destination === 'email' && (
        <p className="muted">
          <Info size={13} /> Officewrite makes no network requests, so it writes one document per
          recipient for you to attach rather than sending mail itself.
        </p>
      )}

      <ActionRow
        onCancel={onClose}
        onConfirm={() =>
          onConfirm({
            from: all ? 1 : Math.max(1, Math.min(from, to)),
            to: all ? recordCount : Math.min(recordCount, Math.max(from, to)),
            answers,
          })
        }
        confirmLabel="OK"
        confirmDisabled={recordCount === 0}
        testId="finish-merge-confirm"
      />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ *
 * Step-by-Step Mail Merge Wizard
 * ------------------------------------------------------------------ */

const WIZARD_STEPS = [
  'Select document type',
  'Starting document',
  'Select recipients',
  'Write your letter',
  'Preview your letters',
  'Complete the merge',
] as const;

/**
 * The six-step wizard, as a task pane.
 *
 * It does not reimplement the dialogs: each step hands off to the same commands
 * the ribbon buttons use. The wizard's value is the ordering and the "what have
 * I not done yet" readout, which is exactly what a first-time merge needs.
 */
export function MailMergeWizard({
  open,
  step,
  mergeType,
  source,
  fieldCount,
  recordCount,
  previewActive,
  onSetStep,
  onSetMergeType,
  onSelectRecipients,
  onEditRecipients,
  onInsertAddressBlock,
  onInsertGreetingLine,
  onInsertMergeField,
  onTogglePreview,
  onStepRecord,
  onFinish,
  onClose,
}: {
  open: boolean;
  step: number;
  mergeType: MergeType;
  source: MergeDataSource | null;
  fieldCount: number;
  recordCount: number;
  previewActive: boolean;
  onSetStep: (step: number) => void;
  onSetMergeType: (type: MergeType) => void;
  onSelectRecipients: () => void;
  onEditRecipients: () => void;
  onInsertAddressBlock: () => void;
  onInsertGreetingLine: () => void;
  onInsertMergeField: () => void;
  onTogglePreview: () => void;
  onStepRecord: (direction: 'previous' | 'next') => void;
  onFinish: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const hasSource = Boolean(source && source.fields.length > 0);

  return (
    <aside className="merge-wizard" data-testid="merge-wizard" aria-label="Mail Merge wizard">
      <header className="merge-wizard-head">
        <h2>Mail Merge</h2>
        <button className="dialog-close" aria-label="Close" data-testid="merge-wizard-close" onClick={onClose}>
          ×
        </button>
      </header>

      <ol className="merge-wizard-steps">
        {WIZARD_STEPS.map((label, index) => (
          <li key={label} className={index + 1 === step ? 'active' : index + 1 < step ? 'done' : ''}>
            <button
              type="button"
              data-testid={`merge-wizard-step-${index + 1}`}
              onClick={() => onSetStep(index + 1)}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="merge-wizard-body" data-testid="merge-wizard-body">
        {step === 1 && (
          <>
            <p>What kind of document are you making?</p>
            {(Object.keys(MERGE_TYPE_LABELS) as MergeType[]).map((type) => (
              <label key={type} className="checkbox-row">
                <input
                  type="radio"
                  name="wizard-type"
                  checked={mergeType === type}
                  data-testid={`merge-wizard-type-${type}`}
                  onChange={() => onSetMergeType(type)}
                />
                {MERGE_TYPE_LABELS[type]}
              </label>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <p>
              This merge uses the document that is open. Write it as you want every copy to read,
              then add the fields that change per recipient in step 4.
            </p>
            <p className="muted">Document type: {MERGE_TYPE_LABELS[mergeType]}.</p>
          </>
        )}

        {step === 3 && (
          <>
            <p>Choose the list of recipients.</p>
            <button className="icon-btn primary" data-testid="merge-wizard-select" onClick={onSelectRecipients}>
              Browse for a list…
            </button>
            {hasSource ? (
              <>
                <p className="muted">
                  {source!.name}: {source!.recipients.length} row(s), {recordCount} ticked.
                </p>
                <button className="icon-btn" data-testid="merge-wizard-edit" onClick={onEditRecipients}>
                  Edit recipient list…
                </button>
              </>
            ) : (
              <p className="muted">No list attached yet.</p>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <p>Put the fields where the letter should change per recipient.</p>
            <button
              className="icon-btn"
              disabled={!hasSource}
              data-testid="merge-wizard-address"
              onClick={onInsertAddressBlock}
            >
              Address block…
            </button>
            <button
              className="icon-btn"
              disabled={!hasSource}
              data-testid="merge-wizard-greeting"
              onClick={onInsertGreetingLine}
            >
              Greeting line…
            </button>
            <button
              className="icon-btn"
              disabled={!hasSource}
              data-testid="merge-wizard-field"
              onClick={onInsertMergeField}
            >
              More items…
            </button>
            <p className="muted">
              {fieldCount === 0
                ? 'No merge fields in the document yet.'
                : `${fieldCount} merge field(s) in the document.`}
            </p>
          </>
        )}

        {step === 5 && (
          <>
            <p>Check how the letters read with real values in them.</p>
            <button
              className="icon-btn primary"
              disabled={recordCount === 0}
              data-testid="merge-wizard-preview"
              onClick={onTogglePreview}
            >
              {previewActive ? 'Stop previewing' : 'Preview the letters'}
            </button>
            <div className="merge-wizard-nav">
              <button
                className="icon-btn"
                disabled={!previewActive}
                data-testid="merge-wizard-prev-record"
                onClick={() => onStepRecord('previous')}
              >
                ‹ Previous
              </button>
              <button
                className="icon-btn"
                disabled={!previewActive}
                data-testid="merge-wizard-next-record"
                onClick={() => onStepRecord('next')}
              >
                Next ›
              </button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <p>
              {recordCount === 0
                ? 'There are no ticked recipients, so there is nothing to merge yet.'
                : `Ready to merge ${recordCount} recipient(s).`}
            </p>
            <button
              className="icon-btn primary"
              disabled={recordCount === 0}
              data-testid="merge-wizard-finish"
              onClick={onFinish}
            >
              Merge to a new document…
            </button>
          </>
        )}
      </div>

      <footer className="merge-wizard-foot">
        <button
          className="icon-btn"
          disabled={step === 1}
          data-testid="merge-wizard-back"
          onClick={() => onSetStep(step - 1)}
        >
          ‹ Previous
        </button>
        <span className="muted">
          Step {step} of {WIZARD_STEPS.length}
        </span>
        <button
          className="icon-btn"
          disabled={step === WIZARD_STEPS.length}
          data-testid="merge-wizard-next"
          onClick={() => onSetStep(step + 1)}
        >
          Next ›
        </button>
      </footer>
    </aside>
  );
}
