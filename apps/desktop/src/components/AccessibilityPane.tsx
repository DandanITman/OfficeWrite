import { AlertTriangle, CircleAlert, Info, X } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import type { AccessibilityIssue } from '@officewrite/core';

interface AccessibilityPaneProps {
  open: boolean;
  editor: Editor | null;
  issues: AccessibilityIssue[];
  onClose: () => void;
  onRecheck: () => void;
}

const SEVERITY_ICON = {
  error: CircleAlert,
  warning: AlertTriangle,
  tip: Info,
} as const;

const SEVERITY_LABEL = {
  error: 'Error',
  warning: 'Warning',
  tip: 'Tip',
} as const;

/**
 * Review > Check Accessibility.
 *
 * Follows the Spelling & Grammar pane: a list of what is wrong, and clicking an
 * entry takes the caret to it so the fix can be made straight away.
 */
export function AccessibilityPane({
  open,
  editor,
  issues,
  onClose,
  onRecheck,
}: AccessibilityPaneProps) {
  if (!open) return null;

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;

  const goTo = (issue: AccessibilityIssue) => {
    if (!editor) return;
    // The checker counts positions the same way ProseMirror does, but a stale
    // report can outrun an edit - clamp rather than throw.
    const pos = Math.min(Math.max(1, issue.pos), editor.state.doc.content.size);
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run();
  };

  return (
    <aside className="side-pane" data-testid="accessibility-pane">
      <div className="side-pane-header">
        <strong>Accessibility</strong>
        <button className="icon-btn" onClick={onClose} title="Close" aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="side-pane-body">
        <p className="a11y-summary" data-testid="accessibility-summary">
          {issues.length === 0
            ? 'No accessibility problems found.'
            : `${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${
                warnings === 1 ? 'warning' : 'warnings'
              }.`}
        </p>

        <ul className="a11y-list">
          {issues.map((issue) => {
            const Icon = SEVERITY_ICON[issue.severity];
            return (
              <li key={issue.id}>
                <button
                  type="button"
                  className={`a11y-issue is-${issue.severity}`}
                  onClick={() => goTo(issue)}
                  data-testid={`a11y-issue-${issue.rule}`}
                >
                  <span className="a11y-issue-head">
                    <Icon size={14} />
                    <span className="a11y-issue-severity">{SEVERITY_LABEL[issue.severity]}</span>
                  </span>
                  <span className="a11y-issue-title">{issue.title}</span>
                  <span className="a11y-issue-fix">{issue.fix}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <button className="icon-btn" onClick={onRecheck} data-testid="accessibility-recheck">
          Check again
        </button>
      </div>
    </aside>
  );
}
