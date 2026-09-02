import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import type { RibbonTab } from '@officewrite/core';
import { buildCommands, searchCommands, type CommandContext } from '../ribbon/commands';

const TAB_LABELS: Record<RibbonTab, string> = {
  file: 'File',
  home: 'Home',
  insert: 'Insert',
  pageLayout: 'Layout',
  references: 'References',
  mailings: 'Mailings',
  review: 'Review',
  view: 'View',
  help: 'Help',
  draw: 'Draw',
  pictureFormat: 'Picture Format',
  tableLayout: 'Table Layout',
};

const MAX_RESULTS = 12;

interface Result {
  key: string;
  label: string;
  breadcrumb: string;
  shortcut?: string;
  disabled: boolean;
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  context: CommandContext;
}

/**
 * The header's "Search for tools, help, and more" box (Alt+Q).
 *
 * Searches the ribbon command registry and runs the result, and also offers
 * "Go to the Insert tab"-style navigation so the box can be used to reach a tab
 * whose name you remember but whose position you do not.
 */
export function CommandPalette({ open, onClose, context }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rebuilt per render is cheap (one array literal) and always sees fresh state.
  const commands = useMemo(() => buildCommands(), []);

  const results = useMemo<Result[]>(() => {
    const matched = searchCommands(commands, query)
      .slice(0, MAX_RESULTS)
      .map<Result>(({ command }) => ({
        key: command.id,
        label: command.label,
        breadcrumb: `${TAB_LABELS[command.tab]} › ${command.group}`,
        shortcut: command.shortcut,
        disabled: command.enabled ? !command.enabled(context) : false,
        run: () => command.run(context),
      }));

    const needle = query.trim().toLowerCase();
    const navigation: Result[] = needle
      ? (Object.entries(TAB_LABELS) as Array<[RibbonTab, string]>)
          .filter(([id, label]) => id !== 'file' && label.toLowerCase().startsWith(needle))
          .map(([id, label]) => ({
            key: `goto.${id}`,
            label: `Go to the ${label} tab`,
            breadcrumb: 'Navigate',
            disabled: false,
            run: () => context.goToTab(id),
          }))
      : [];

    return [...matched, ...navigation].slice(0, MAX_RESULTS);
  }, [commands, context, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    // The input mounts with the portal, so focus on the next frame.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  if (!open) return null;

  const usable = results.filter((result) => !result.disabled);

  const runAt = (index: number) => {
    const result = results[index];
    if (!result || result.disabled) return;
    onClose();
    result.run();
  };

  const move = (delta: number) => {
    if (!results.length) return;
    let next = highlight;
    // Step over disabled entries rather than landing on one.
    for (let attempt = 0; attempt < results.length; attempt += 1) {
      next = (next + delta + results.length) % results.length;
      if (!results[next].disabled) break;
    }
    setHighlight(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      runAt(highlight);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div className="backdrop command-backdrop" onClick={onClose}>
      <div
        className="command-palette"
        role="dialog"
        aria-label="Search for tools"
        data-testid="command-palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="command-input-row">
          <Search size={16} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search for tools, help, and more"
            aria-label="Search for tools, help, and more"
            data-testid="command-input"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>

        {query.trim() && (
          <ul className="command-results" role="listbox">
            {results.length === 0 && <li className="command-empty">No matching command.</li>}
            {results.map((result, index) => (
              <li key={result.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={`command-result${index === highlight ? ' is-active' : ''}${
                    result.disabled ? ' is-disabled' : ''
                  }`}
                  disabled={result.disabled}
                  data-testid={`command-result-${result.key}`}
                  onMouseEnter={() => !result.disabled && setHighlight(index)}
                  onClick={() => runAt(index)}
                >
                  <span className="command-result-label">{result.label}</span>
                  <span className="command-result-meta">
                    {result.shortcut && <kbd>{result.shortcut}</kbd>}
                    <span className="command-result-breadcrumb">{result.breadcrumb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="command-hint">
          <CornerDownLeft size={12} /> to run · ↑↓ to choose · Esc to close
          {usable.length > 0 && <span>{usable.length} available</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
