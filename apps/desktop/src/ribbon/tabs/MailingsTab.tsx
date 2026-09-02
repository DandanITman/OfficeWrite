import {
  AlertTriangle,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Contact,
  Eye,
  FileStack,
  Highlighter,
  Mail,
  MailCheck,
  MapPin,
  Search,
  Sparkles,
  Tags,
  UserPlus,
  Users,
  Wand2,
} from 'lucide-react';
import {
  MERGE_RULE_LABELS,
  MERGE_TYPE_LABELS,
  type MergeRuleKind,
  type MergeType,
} from '@officewrite/core';
import {
  RibbonButton,
  RibbonGroup,
  RibbonLine,
  RibbonMenuButton,
  RibbonMenuHeader,
  RibbonMenuItem,
  RibbonMenuSeparator,
  RibbonSplitButton,
  RibbonStack,
} from '../RibbonKit';
import type { RibbonTabProps } from '../types';

/**
 * The Mailings tab, group for group: Create, Start Mail Merge, Write & Insert
 * Fields, Preview Results, Finish.
 *
 * The disabled states are the part worth being careful about, because they are
 * how a word processor teaches the workflow. Everything from Edit Recipient List rightwards
 * greys out until a list is attached, so the tab itself says "pick your
 * recipients first" - which is why Officewrite reproduces it rather than letting
 * every button click through to an error.
 *
 * Envelopes and Labels are the exception, and deliberately so: conventionally they
 * print a single hand-typed address without any merge at all.
 */

/** Rules that open a dialog. The rest insert as soon as they are picked. */
const CONFIGURED_RULES: MergeRuleKind[] = [
  'ask',
  'fillIn',
  'ifThenElse',
  'nextRecordIf',
  'skipRecordIf',
  'setBookmark',
];

const PLAIN_RULES: MergeRuleKind[] = ['mergeRecord', 'mergeSequence', 'nextRecord'];

/** A word processor lists the merge types in this order, with Normal last. */
const MERGE_TYPES: MergeType[] = ['letters', 'email', 'envelopes', 'labels', 'directory', 'normal'];

export function MailingsTab({ actions, flags }: RibbonTabProps) {
  const merge = flags.mailMerge;
  const hasSource = Boolean(merge.source && merge.source.fields.length > 0);
  const hasRecords = merge.recordCount > 0;
  const fields = merge.source?.fields ?? [];

  /* Preview stepping is meaningless with nothing to step through, and a word processor
     greys the whole navigator rather than letting it count past the end. */
  const atFirst = merge.recordIndex <= 1;
  const atLast = merge.recordIndex >= merge.recordCount;

  return (
    <>
      <RibbonGroup label="Create">
        <RibbonStack>
          <RibbonButton
            icon={<Mail size={20} className="icon-envelope" />}
            label="Envelopes"
            title="Print or merge onto an envelope"
            size="large"
            onClick={actions.onOpenEnvelopes}
            testId="mailings-envelopes"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<Tags size={20} className="icon-labels" />}
            label="Labels"
            title="Print a sheet of labels, or build a label merge"
            size="large"
            onClick={actions.onOpenLabels}
            testId="mailings-labels"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Start Mail Merge">
        <RibbonStack>
          <RibbonMenuButton
            icon={<FileStack size={20} className="icon-merge-start" />}
            label="Start Mail Merge"
            title="Choose what this merge produces"
            size="large"
            testId="mailings-start-merge"
            menuWidth={300}
          >
            <RibbonMenuHeader label="Document type" />
            {MERGE_TYPES.map((type) => (
              <RibbonMenuItem
                key={type}
                label={MERGE_TYPE_LABELS[type]}
                checked={merge.type === type}
                onClick={() => actions.onSetMergeType(type)}
                testId={`mailings-merge-type-${type}`}
              />
            ))}
            <RibbonMenuSeparator />
            <RibbonMenuItem
              label="Step-by-Step Mail Merge Wizard…"
              hint="Walks the six steps in order"
              icon={<Wand2 size={13} />}
              onClick={actions.onOpenMergeWizard}
              testId="mailings-merge-wizard"
            />
          </RibbonMenuButton>
        </RibbonStack>
        <RibbonStack>
          <RibbonMenuButton
            icon={<Users size={20} className="icon-recipients" />}
            label="Select Recipients"
            title="Attach the list this merge reads"
            size="large"
            testId="mailings-select-recipients"
            menuWidth={320}
          >
            <RibbonMenuItem
              label="Type a New List…"
              hint="Build a list by hand"
              icon={<UserPlus size={13} />}
              onClick={actions.onNewRecipientList}
              testId="mailings-new-list"
            />
            <RibbonMenuItem
              label="Use an Existing List…"
              hint="Open a CSV or tab-separated file"
              icon={<Contact size={13} />}
              onClick={actions.onUseExistingRecipientList}
              testId="mailings-existing-list"
            />
            {hasSource && (
              <>
                <RibbonMenuSeparator />
                <RibbonMenuHeader label="Attached" />
                <RibbonMenuItem
                  label={merge.source!.name}
                  hint={`${merge.source!.recipients.length} row(s), ${merge.recordCount} ticked`}
                  onClick={actions.onEditRecipientList}
                />
              </>
            )}
          </RibbonMenuButton>
          <RibbonButton
            icon={<Contact size={14} />}
            label="Edit Recipient List"
            title="Tick, sort, filter and edit the recipients"
            disabled={!hasSource}
            onClick={actions.onEditRecipientList}
            testId="mailings-edit-recipients"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Write &amp; Insert Fields">
        <RibbonStack>
          <RibbonButton
            icon={<Highlighter size={20} className="icon-highlight-fields" />}
            label="Highlight Merge Fields"
            title="Shade every merge field so they are easy to find"
            size="large"
            active={merge.highlightFields}
            disabled={!hasSource}
            onClick={actions.onToggleHighlightMergeFields}
            testId="mailings-highlight-fields"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<MapPin size={20} className="icon-address-block" />}
            label="Address Block"
            title="Insert a formatted address, built from the matched fields"
            size="large"
            disabled={!hasSource}
            onClick={actions.onOpenAddressBlock}
            testId="mailings-address-block"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<MailCheck size={20} className="icon-greeting-line" />}
            label="Greeting Line"
            title="Insert a greeting, with a fallback for rows that have no name"
            size="large"
            disabled={!hasSource}
            onClick={actions.onOpenGreetingLine}
            testId="mailings-greeting-line"
          />
        </RibbonStack>
        <RibbonStack>
          {/* the split button: the face opens the full list, the chevron
              drops the columns straight in. */}
          <RibbonSplitButton
            icon={<Sparkles size={20} className="icon-merge-field" />}
            label="Insert Merge Field"
            title="Insert a field for one column of the list"
            size="large"
            disabled={!hasSource}
            onClick={actions.onOpenInsertMergeField}
            testId="mailings-insert-merge-field"
            menuWidth={280}
          >
            {fields.length === 0 ? (
              <RibbonMenuItem label="No list attached yet…" onClick={actions.onUseExistingRecipientList} />
            ) : (
              <>
                <RibbonMenuHeader label="Fields" />
                {fields.map((field) => (
                  <RibbonMenuItem
                    key={field}
                    label={field}
                    onClick={() => actions.onInsertMergeField(field)}
                    testId={`mailings-field-${field}`}
                  />
                ))}
              </>
            )}
          </RibbonSplitButton>
        </RibbonStack>
        <RibbonStack>
          <RibbonMenuButton
            icon={<FileStack size={14} />}
            label="Rules"
            title="Fields that make the merge decide, skip or number"
            disabled={!hasSource}
            testId="mailings-rules"
            menuWidth={300}
          >
            {CONFIGURED_RULES.map((rule) => (
              <RibbonMenuItem
                key={rule}
                label={MERGE_RULE_LABELS[rule]}
                onClick={() => actions.onInsertMergeRule(rule)}
                testId={`mailings-rule-${rule}`}
              />
            ))}
            <RibbonMenuSeparator />
            {PLAIN_RULES.map((rule) => (
              <RibbonMenuItem
                key={rule}
                label={MERGE_RULE_LABELS[rule]}
                onClick={() => actions.onInsertMergeRule(rule)}
                testId={`mailings-rule-${rule}`}
              />
            ))}
          </RibbonMenuButton>
          <RibbonButton
            icon={<Contact size={14} />}
            label="Match Fields"
            title="Say which column each standard address field reads"
            disabled={!hasSource}
            onClick={actions.onOpenMatchFields}
            testId="mailings-match-fields"
          />
          <RibbonButton
            icon={<Tags size={14} />}
            label="Update Labels"
            title="Copy the first label's layout across the sheet"
            disabled={!hasSource || merge.type !== 'labels'}
            onClick={actions.onUpdateLabels}
            testId="mailings-update-labels"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Preview Results">
        <RibbonStack>
          <RibbonButton
            icon={<Eye size={20} className="icon-preview-results" />}
            label="Preview Results"
            title="Swap the fields for one recipient's real values"
            size="large"
            active={merge.previewActive}
            disabled={!hasRecords}
            onClick={actions.onTogglePreviewResults}
            testId="mailings-preview-results"
          />
        </RibbonStack>
        <RibbonStack>
          {/* The record navigator, laid out as is conventional: ends outside,
              steps inside, the number in the middle. */}
          <RibbonLine className="rb-merge-nav">
            <RibbonButton
              icon={<ChevronFirst size={14} />}
              title="First record"
              size="icon"
              disabled={!hasRecords || atFirst}
              onClick={() => actions.onStepMergeRecord('first')}
              testId="mailings-record-first"
            />
            <RibbonButton
              icon={<ChevronLeft size={14} />}
              title="Previous record"
              size="icon"
              disabled={!hasRecords || atFirst}
              onClick={() => actions.onStepMergeRecord('previous')}
              testId="mailings-record-previous"
            />
            <input
              className="rb-merge-record"
              type="number"
              min={1}
              max={Math.max(1, merge.recordCount)}
              value={merge.recordIndex || ''}
              aria-label="Record number"
              disabled={!hasRecords}
              data-testid="mailings-record-number"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) actions.onGoToMergeRecord(next);
              }}
            />
            <RibbonButton
              icon={<ChevronRight size={14} />}
              title="Next record"
              size="icon"
              disabled={!hasRecords || atLast}
              onClick={() => actions.onStepMergeRecord('next')}
              testId="mailings-record-next"
            />
            <RibbonButton
              icon={<ChevronLast size={14} />}
              title="Last record"
              size="icon"
              disabled={!hasRecords || atLast}
              onClick={() => actions.onStepMergeRecord('last')}
              testId="mailings-record-last"
            />
          </RibbonLine>
          <RibbonButton
            icon={<Search size={14} />}
            label="Find Recipient"
            title="Search the list and jump to the row"
            disabled={!hasRecords}
            onClick={actions.onOpenFindRecipient}
            testId="mailings-find-recipient"
          />
          <RibbonButton
            icon={<AlertTriangle size={14} />}
            label="Check for Errors"
            title="Report fields with no column behind them, and empty rows"
            onClick={actions.onCheckMergeErrors}
            testId="mailings-check-errors"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Finish">
        <RibbonStack>
          <RibbonMenuButton
            icon={<MailCheck size={20} className="icon-finish-merge" />}
            label="Finish &amp; Merge"
            title="Write the merged documents"
            size="large"
            disabled={!hasRecords}
            testId="mailings-finish-merge"
            menuWidth={300}
          >
            <RibbonMenuItem
              label="Edit Individual Documents…"
              hint="Merge into one new document you can read through"
              onClick={() => actions.onFinishMerge('documents')}
              testId="mailings-finish-documents"
            />
            <RibbonMenuItem
              label="Print Documents…"
              hint="Merge, then send straight to the printer"
              onClick={() => actions.onFinishMerge('print')}
              testId="mailings-finish-print"
            />
            <RibbonMenuItem
              label="Send E-mail Messages…"
              hint="Write one file per recipient, ready to attach"
              onClick={() => actions.onFinishMerge('email')}
              testId="mailings-finish-email"
            />
          </RibbonMenuButton>
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
