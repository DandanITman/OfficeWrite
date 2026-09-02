#!/usr/bin/env node
/**
 * Build detailed GitHub Release notes from git history.
 * Usage: node scripts/generate-release-notes.mjs [version] [--output path]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    return '';
  }
  return (result.stdout ?? '').trim();
}

const version = process.argv[2] ?? run('git', ['describe', '--tags', '--abbrev=0']) ?? 'v0.0.0';
const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : null;

const previousTag = run('git', ['describe', '--tags', '--abbrev=0', `${version}^`]);
const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';

const rawLog = run('git', [
  'log',
  range,
  '--pretty=format:%h|%ad|%an|%s',
  '--date=short',
  '--no-merges',
]);

const commits = rawLog
  ? rawLog.split('\n').map((line) => {
      const [hash, date, author, ...rest] = line.split('|');
      return { hash, date, author, subject: rest.join('|') };
    })
  : [];

function categorize(subject) {
  const s = subject.toLowerCase();
  if (s.startsWith('fix') || s.includes('bug')) return 'fixes';
  if (s.startsWith('test') || s.includes('regression') || s.includes('e2e')) return 'tests';
  if (s.startsWith('docs') || s.includes('readme') || s.includes('pages')) return 'docs';
  if (s.startsWith('feat') || s.startsWith('add') || s.includes('feature')) return 'features';
  if (s.includes('deploy') || s.includes('release') || s.includes('workflow') || s.includes('ci'))
    return 'infra';
  return 'other';
}

const groups = {
  features: [],
  fixes: [],
  tests: [],
  docs: [],
  infra: [],
  other: [],
};

for (const commit of commits) {
  groups[categorize(commit.subject)].push(commit);
}

function section(title, items) {
  if (!items.length) return '';
  const lines = items.map((c) => `- **${c.subject}** (\`${c.hash}\`, ${c.date}, ${c.author})`);
  return `## ${title}\n\n${lines.join('\n')}\n`;
}

/**
 * The hand-written entries for this release from CHANGELOG.md.
 *
 * The commit list below is accurate but not readable: it says a commit
 * happened, not what changed for someone using the app. The changelog is where
 * that is written, so it leads and the commits become the supporting detail.
 *
 * Every version between the previous tag and this one is included, because a release
 * that spans 0.2.1 to 0.2.8 should show all eight, not just the last.
 */
function changelogSections(tag, sinceTag) {
  let text;
  try {
    text = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  } catch {
    return '';
  }

  const lines = text.split(/\r?\n/);
  const headings = [];
  lines.forEach((line, index) => {
    const match = /^## \[([^\]]+)\]/.exec(line.trim());
    if (match) headings.push({ version: match[1], index });
  });

  const clean = (value) => String(value ?? '').replace(/^v/, '');
  const wanted = clean(tag);
  const floor = clean(sinceTag);

  const start = headings.findIndex((h) => h.version === wanted);
  if (start === -1) return '';

  const stop = floor ? headings.findIndex((h) => h.version === floor) : -1;
  const chosen = headings.slice(start, stop === -1 ? undefined : stop);
  if (!chosen.length) return '';

  const parts = chosen
    .filter((h) => h.version.toLowerCase() !== 'unreleased')
    .map((heading, position) => {
      const nextIndex =
        headings[headings.indexOf(heading) + 1]?.index ?? lines.length;
      const body = lines
        .slice(heading.index + 1, nextIndex)
        .join('\n')
        .trim();
      if (!body) return '';
      const title = position === 0 ? `What's new in ${heading.version}` : heading.version;
      return `## ${title}\n\n${body}\n`;
    })
    .filter(Boolean);

  return parts.join('\n');
}

const highlights = changelogSections(version, previousTag);

const compareUrl = previousTag
  ? `https://github.com/DandanITman/OfficeWrite/compare/${previousTag}...${version}`
  : `https://github.com/DandanITman/OfficeWrite/commits/main`;

const body = [
  `# Officewrite ${version}`,
  '',
  'Non-profit educational word processor. A free alternative to Microsoft Word, LibreOffice and OpenOffice.',
  '',
  previousTag
    ? `Changes since [${previousTag}](https://github.com/DandanITman/OfficeWrite/releases/tag/${previousTag}).`
    : 'Initial tracked release notes for this version.',
  '',
  `[Full commit compare](${compareUrl})`,
  '',
  highlights,
  highlights ? '---\n' : '',
  '<details>',
  '<summary>Every commit in this release</summary>',
  '',
  section('Features', groups.features),
  section('Bug fixes', groups.fixes),
  section('Tests & QA', groups.tests),
  section('Documentation & site', groups.docs),
  section('CI / deploy / infra', groups.infra),
  section('Other changes', groups.other),
  commits.length
    ? ''
    : '_No commits found in range. The tag may point at the same commit as the previous release._\n',
  '</details>',
  '',
  '---',
  '',
  '## QA status',
  '',
  '- Regression workflow must pass on this commit before the release job publishes assets.',
  '- Local pre-deploy gate: `npm run pre-deploy`',
  '',
  '## Downloads',
  '',
  '- Windows installer (`.exe`) attached to this release',
  '- Project site: https://dandanitman.github.io/Officewrite/',
].join('\n');

if (outputPath) {
  writeFileSync(outputPath, body, 'utf8');
  console.log(`Wrote release notes to ${outputPath}`);
} else {
  console.log(body);
}
