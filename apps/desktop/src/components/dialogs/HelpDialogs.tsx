import changelogSource from '../../../../../CHANGELOG.md?raw';
import { SHORTCUT_GROUPS } from '../../constants/shortcuts';
import { getPlatform } from '../../platform';
import { Dialog } from './Dialog';

/** Help > Keyboard Shortcuts, rendered from the one shortcut table. */
export function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <Dialog title="Keyboard Shortcuts" onClose={onClose} testId="shortcuts-dialog" wide closeLabel="Close">
      <div className="shortcut-columns">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className="shortcut-group">
            <h3>{group.title}</h3>
            <table className="shortcut-table">
              <tbody>
                {group.shortcuts.map((shortcut) => (
                  <tr key={shortcut.keys}>
                    <th scope="row">
                      <kbd>{shortcut.keys}</kbd>
                    </th>
                    <td>{shortcut.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * Help > What's New.
 *
 * The changelog is bundled at build time rather than fetched, so this works
 * offline and in the packaged app. Only the Markdown the file actually uses is
 * rendered - headings, bullets, bold, inline code and links. Links were missing
 * before, so the dialog showed readers raw `[text](url)` source.
 */
export function WhatsNewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <Dialog title="What's New" onClose={onClose} testId="whats-new-dialog" wide closeLabel="Close">
      <div className="changelog-body">{renderChangelog(changelogSource)}</div>
    </Dialog>
  );
}

function renderChangelog(source: string): React.ReactElement[] {
  const blocks: React.ReactElement[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      // Markdown wraps prose across source lines; one paragraph is one block.
      // Emitting a <p> per line put a margin between every wrapped line.
      blocks.push(<p key={blocks.length}>{renderInline(paragraph.join(' '))}</p>);
      paragraph = [];
    }
    if (!bullets.length) return;
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {bullets.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    if (/^\s+/.test(rawLine) && bullets.length) {
      // A wrapped continuation of the bullet above it.
      bullets[bullets.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      bullets.push(line.slice(2));
      continue;
    }
    // A blank line ends whatever block was being collected.
    if (!line.trim()) {
      flush();
      continue;
    }
    if (!line.startsWith('#')) {
      if (bullets.length) flush();
      paragraph.push(line.trim());
      continue;
    }
    flush();

    if (line.startsWith('### ')) {
      // Added / Changed / Removed: a small label above its list.
      blocks.push(
        <h4 key={blocks.length} className="changelog-section">
          {line.slice(4)}
        </h4>,
      );
    } else if (line.startsWith('## ')) {
      // "## [0.2.0] - 2026-01-01": the brackets are Keep a Changelog syntax,
      // not something a reader should see.
      const heading = line.slice(3).trim();
      const match = /^\[([^\]]+)\]\s*(?:[-–]\s*(.*))?$/.exec(heading);
      blocks.push(
        <h3 key={blocks.length} className="changelog-version">
          <span className="changelog-version-name">{match ? match[1] : heading}</span>
          {match?.[2] ? <span className="changelog-version-date">{match[2]}</span> : null}
        </h3>,
      );
    }
    // A leading "# " is the document title, already the dialog heading.
  }
  flush();

  return blocks;
}

/** Bold, inline code and links - every inline construct the changelog uses. */
function renderInline(text: string): React.ReactNode {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern).filter(Boolean);
  if (parts.length === 1 && !pattern.test(parts[0])) return text;

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      return (
        <a
          key={index}
          href={href}
          // The app window is the document; a changelog link must not navigate
          // it away, so hand the URL to the user's browser instead.
          onClick={(event) => {
            event.preventDefault();
            void getPlatform().openExternal(href);
          }}
        >
          {label}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
