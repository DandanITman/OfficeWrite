import { describe, expect, it } from 'vitest';
import type { RibbonTab } from '@officewrite/core';
import { buildCommands, searchCommands, RIBBON_GROUPS } from './commands';

/**
 * The registry is hand-written, which is a deliberate trade (see commands.ts).
 * These tests cover the ways that choice rots: a duplicated id silently
 * shadowing an entry, and a tab or group name that no longer exists after the
 * ribbon is restructured.
 */
const LIVE_TABS = new Set<RibbonTab>([
  'file',
  'home',
  'insert',
  'pageLayout',
  'references',
  'mailings',
  'review',
  'view',
  'help',
  'draw',
  'pictureFormat',
  'tableLayout',
]);

describe('command registry', () => {
  const commands = buildCommands();

  it('has no duplicate ids', () => {
    const seen = new Map<string, number>();
    for (const command of commands) {
      seen.set(command.id, (seen.get(command.id) ?? 0) + 1);
    }
    expect([...seen.entries()].filter(([, count]) => count > 1)).toEqual([]);
  });

  it('only references tabs that exist', () => {
    const strays = commands.filter((command) => !LIVE_TABS.has(command.tab));
    expect(strays.map((command) => `${command.id} -> ${command.tab}`)).toEqual([]);
  });

  /**
   * Breadcrumbs used to rot unnoticed: restructuring the ribbon in 0.2.1 and
   * 0.2.2 deleted five groups that Alt+Q went on advertising, because only the
   * tab was ever checked.
   */
  it('only references groups that exist on that tab', () => {
    const strays = commands.filter(
      (command) => !RIBBON_GROUPS[command.tab]?.includes(command.group),
    );
    expect(strays.map((command) => `${command.id} -> ${command.tab} > ${command.group}`)).toEqual(
      [],
    );
  });

  it('gives every command something to run and something to show', () => {
    for (const command of commands) {
      expect(typeof command.run, command.id).toBe('function');
      expect(command.label.trim(), command.id).not.toBe('');
      expect(command.group.trim(), command.id).not.toBe('');
    }
  });

  it('covers every tab, so no tab is unreachable from the search box', () => {
    const covered = new Set(commands.map((command) => command.tab));
    expect([...LIVE_TABS].filter((tab) => !covered.has(tab))).toEqual([]);
  });
});

describe('searchCommands', () => {
  const commands = buildCommands();

  it('returns nothing for an empty query', () => {
    expect(searchCommands(commands, '   ')).toEqual([]);
  });

  it('ranks an exact label above a substring match', () => {
    const results = searchCommands(commands, 'bold');
    expect(results[0].command.label).toBe('Bold');
  });

  it('finds a command by keyword rather than by label', () => {
    // "spell check" appears in no label - only in the Spelling & Grammar keywords.
    const labels = searchCommands(commands, 'spell check').map((r) => r.command.label);
    expect(labels).toContain('Spelling & Grammar');
  });

  it('matches the breadcrumb, so browsing by group works', () => {
    const results = searchCommands(commands, 'Page Background');
    expect(results.map((r) => r.command.label)).toContain('Watermark');
  });

  it('is case insensitive', () => {
    expect(searchCommands(commands, 'ITALIC')[0].command.label).toBe('Italic');
  });

  it('treats a regex metacharacter as literal text', () => {
    // The word-start test builds a RegExp from the query; an unescaped "(" here
    // would throw rather than simply matching nothing.
    expect(() => searchCommands(commands, 'a (b')).not.toThrow();
  });
});
