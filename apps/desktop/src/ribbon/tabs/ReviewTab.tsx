import {
  Accessibility,
  BookOpenCheck,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Hash,
  Languages,
  MessageSquare,
  MessageSquarePlus,
  PanelRight,
  SpellCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  acceptAllTrackChanges,
  acceptTrackChangeInSelection,
  rejectAllTrackChanges,
  rejectTrackChangeInSelection,
} from '../../utils/trackChanges';
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
import type { MarkupView, RibbonTabProps } from '../types';
import { PROOFING_LANGUAGES } from '../../constants/languages';

const MARKUP_VIEWS: Array<{ id: MarkupView; label: string; hint: string }> = [
  { id: 'simple', label: 'Simple Markup', hint: 'Show the result, with a bar where changes are' },
  { id: 'all', label: 'All Markup', hint: 'Show every insertion and deletion' },
  { id: 'none', label: 'No Markup', hint: 'Show the document as if every change were accepted' },
  { id: 'original', label: 'Original', hint: 'Show the document before the changes' },
];

export function ReviewTab({ editor, actions, flags }: RibbonTabProps) {
  const { pendingInsertions, pendingDeletions } = flags;
  const pending = pendingInsertions + pendingDeletions;

  return (
    <>
      <RibbonGroup label="Proofing">
        <RibbonStack>
          <RibbonButton
            icon={<SpellCheck size={20} />}
            label="Spelling &amp; Grammar"
            title="Check spelling and grammar (F7)"
            size="large"
            onClick={actions.onOpenProofing}
            testId="ribbon-spelling"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonButton
            icon={<BookOpenCheck size={14} />}
            label="Thesaurus"
            title="Find synonyms for the selected word (Shift+F7)"
            onClick={actions.onOpenThesaurus}
            testId="ribbon-thesaurus"
          />
          <RibbonButton
            icon={<Hash size={14} />}
            label="Word Count"
            title="Word count and readability"
            onClick={actions.onOpenWordCount}
            testId="ribbon-word-count"
          />
          <span className="rb-status-note" data-testid="ribbon-proofing-status">
            {flags.proofingIssues === 0
              ? 'No proofing errors'
              : `${flags.proofingIssues} proofing ${flags.proofingIssues === 1 ? 'issue' : 'issues'}`}
          </span>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Accessibility">
        <RibbonButton
          icon={<Accessibility size={20} />}
          label="Check Accessibility"
          title="Find problems that make the document hard to read with assistive technology"
          size="large"
          active={flags.accessibilityOpen}
          onClick={actions.onCheckAccessibility}
          testId="review-check-accessibility"
        />
      </RibbonGroup>

      <RibbonGroup label="Language">
        <RibbonMenuButton
          icon={<Languages size={20} />}
          label="Language"
          title="Set the proofing language"
          size="large"
          testId="ribbon-language"
          menuWidth={250}
        >
          <RibbonMenuHeader label="Set proofing language" />
          {PROOFING_LANGUAGES.map((language) => (
            <RibbonMenuItem
              key={language.id}
              label={language.label}
              checked={flags.language === language.id}
              onClick={() => actions.onSetLanguage(language.id)}
              testId={`language-${language.id}`}
            />
          ))}
          <RibbonMenuSeparator />
          <RibbonMenuItem
            label="Check spelling as you type"
            checked={flags.spellCheckEnabled}
            keepOpen
            onClick={actions.onToggleSpellCheck}
          />
          <RibbonMenuItem
            label="Mark grammar errors as you type"
            checked={flags.grammarCheckEnabled}
            keepOpen
            onClick={actions.onToggleGrammarCheck}
          />
        </RibbonMenuButton>
      </RibbonGroup>

      <RibbonGroup label="Comments">
        <RibbonStack>
          <RibbonButton
            icon={<MessageSquarePlus size={20} />}
            label="New Comment"
            title="New Comment (Ctrl+Alt+M)"
            size="large"
            onClick={actions.onNewComment}
            testId="ribbon-new-comment"
          />
        </RibbonStack>
        <RibbonStack>
          <RibbonLine>
            <RibbonMenuButton
              icon={<Trash2 size={14} />}
              label="Delete"
              title="Delete comments"
              disabled={flags.commentCount === 0}
              testId="ribbon-delete-comment"
            >
              <RibbonMenuItem label="Delete Comment" onClick={() => actions.onDeleteComment('current')} />
              <RibbonMenuItem label="Delete All Resolved Comments" onClick={() => actions.onDeleteComment('resolved')} />
              <RibbonMenuItem label="Delete All Comments in Document" onClick={() => actions.onDeleteComment('all')} />
            </RibbonMenuButton>
            <RibbonButton
              icon={<ChevronLeft size={14} />}
              label="Previous"
              title="Previous comment"
              disabled={flags.commentCount === 0}
              onClick={() => actions.onGoToComment(-1)}
              testId="ribbon-previous-comment"
            />
            <RibbonButton
              icon={<ChevronRight size={14} />}
              label="Next"
              title="Next comment"
              disabled={flags.commentCount === 0}
              onClick={() => actions.onGoToComment(1)}
              testId="ribbon-next-comment"
            />
          </RibbonLine>
          <RibbonButton
            icon={<MessageSquare size={14} />}
            label="Comments"
            title="Show the comments pane"
            active={flags.commentsOpen}
            onClick={actions.onToggleComments}
            testId="ribbon-comments"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Tracking">
        <RibbonStack>
          <RibbonSplitButton
            icon={<GitCompare size={20} />}
            label="Track Changes"
            title="Track Changes (Ctrl+Shift+E)"
            active={flags.trackChangesEnabled}
            onClick={actions.onToggleTrackChanges}
            testId="ribbon-track-changes"
          >
            {/* The chevron used to open a menu holding one item that ran the
                same command as the button face. Restrict Editing has no
                ribbon control of its own and belongs in this group in a word processor,
                and costs no ribbon width inside a menu. */}
            <RibbonMenuItem
              label="Track Changes"
              checked={flags.trackChangesEnabled}
              onClick={actions.onToggleTrackChanges}
            />
            <RibbonMenuSeparator />
            <RibbonMenuItem
              label="Restrict Editing"
              hint="Make the document read-only"
              checked={flags.restrictEditing}
              onClick={actions.onToggleRestrictEditing}
              testId="ribbon-restrict-editing"
            />
          </RibbonSplitButton>
        </RibbonStack>
        <RibbonStack>
          <RibbonMenuButton
            icon={<span className="rb-glyph">◧</span>}
            label={MARKUP_VIEWS.find((v) => v.id === flags.markupView)?.label ?? 'Display for Review'}
            title="Choose how the changes are shown"
            testId="ribbon-markup-view"
            menuWidth={280}
          >
            {MARKUP_VIEWS.map((view) => (
              <RibbonMenuItem
                key={view.id}
                label={view.label}
                hint={view.hint}
                checked={flags.markupView === view.id}
                onClick={() => actions.onSetMarkupView(view.id)}
                testId={`markup-view-${view.id}`}
              />
            ))}
          </RibbonMenuButton>
          <RibbonMenuButton
            icon={<span className="rb-glyph">☰</span>}
            label="Show Markup"
            title="Choose which markup is shown"
            testId="ribbon-show-markup"
          >
            <RibbonMenuItem
              label="Insertions and Deletions"
              checked={flags.markupOptions.insertionsAndDeletions}
              keepOpen
              onClick={() => actions.onToggleMarkupOption('insertionsAndDeletions')}
            />
            <RibbonMenuItem
              label="Formatting"
              checked={flags.markupOptions.formatting}
              keepOpen
              onClick={() => actions.onToggleMarkupOption('formatting')}
            />
            <RibbonMenuItem
              label="Comments"
              checked={flags.markupOptions.comments}
              keepOpen
              onClick={() => actions.onToggleMarkupOption('comments')}
            />
          </RibbonMenuButton>
          <RibbonButton
            icon={<PanelRight size={14} />}
            label="Reviewing Pane"
            title="List every revision and comment"
            active={flags.reviewingPaneOpen}
            onClick={actions.onToggleReviewingPane}
            testId="ribbon-reviewing-pane"
          />
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Changes">
        <RibbonLine>
          <RibbonSplitButton
            icon={<Check size={20} />}
            label="Accept"
            title="Accept the change at the caret"
            onClick={() => editor && void acceptTrackChangeInSelection(editor)}
            testId="ribbon-accept"
          >
            <RibbonMenuItem
              label="Accept and Move to Next"
              onClick={() => {
                if (!editor) return;
                void acceptTrackChangeInSelection(editor).then(() => actions.onGoToChange(1));
              }}
            />
            <RibbonMenuItem
              label="Accept All Changes"
              icon={<CheckCheck size={13} />}
              onClick={() => editor && acceptAllTrackChanges(editor)}
              testId="ribbon-accept-all"
            />
          </RibbonSplitButton>
          <RibbonSplitButton
            icon={<X size={20} />}
            label="Reject"
            title="Reject the change at the caret"
            onClick={() => editor && void rejectTrackChangeInSelection(editor)}
            testId="ribbon-reject"
          >
            <RibbonMenuItem
              label="Reject and Move to Next"
              onClick={() => {
                if (!editor) return;
                void rejectTrackChangeInSelection(editor).then(() => actions.onGoToChange(1));
              }}
            />
            <RibbonMenuItem
              label="Reject All Changes"
              icon={<XCircle size={13} />}
              onClick={() => editor && rejectAllTrackChanges(editor)}
              testId="ribbon-reject-all"
            />
          </RibbonSplitButton>
        </RibbonLine>
        <RibbonStack>
          <RibbonButton
            icon={<ChevronLeft size={14} />}
            label="Previous"
            title="Previous change"
            disabled={pending === 0}
            onClick={() => actions.onGoToChange(-1)}
            testId="ribbon-previous-change"
          />
          <RibbonButton
            icon={<ChevronRight size={14} />}
            label="Next"
            title="Next change"
            disabled={pending === 0}
            onClick={() => actions.onGoToChange(1)}
            testId="ribbon-next-change"
          />
          {/* Accept and Reject act on changes that nothing in the UI could count:
              countTrackChanges existed but was only ever called by tests. */}
          <span className="rb-status-note" data-testid="ribbon-change-summary">
            {pending === 0 ? (
              <span className="ribbon-change-none">No pending changes</span>
            ) : (
              <>
                <span data-testid="ribbon-pending-insertions">{pendingInsertions} inserted</span>
                {', '}
                <span data-testid="ribbon-pending-deletions">{pendingDeletions} deleted</span>
              </>
            )}
          </span>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Compare">
        {/* A chevron whose menu held a single item running the same command
            costs a click and delivers nothing. */}
        <RibbonButton
          icon={<GitCompare size={20} />}
          label="Compare"
          title="Compare this document with another. The differences arrive as tracked changes"
          size="large"
          onClick={actions.onCompareDocuments}
          testId="ribbon-compare"
        />
      </RibbonGroup>

      {/* Restrict Editing used to have its own Protect group here. The tab
          strip's Editing / Reviewing / Viewing picker sets exactly the same
          flag and is far easier to find, so keeping both was duplication -
          and the eighth group pushed the tab past the window at 1280px. */}
    </>
  );
}
