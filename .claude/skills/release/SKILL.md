---
name: release
description: Cut or troubleshoot an Officewrite release: bump the version, write a proper changelog entry, tag, and publish the Windows installer. Use when the user asks to release, ship, cut a version, publish a build, bump the version, or when an automatic release failed and needs repairing.
---

# Cut an Officewrite release

**Releases are already automatic.** Every push to `main` cuts one. Read the next
section before doing anything by hand. Most of the time the right answer is to
let the workflow run, or to nudge it, not to repeat its work.

## What happens on its own

| Thing | Fires on | Workflow |
|---|---|---|
| Version bump, changelog entry, `vX.Y.Z` tag | every push to `main` | `auto-release.yml` |
| Windows `.exe` + GitHub Release + release notes | that tag, dispatched by the above | `release.yml` |
| The site at officewrite.com, incl. the `/app` build | every push to `main`, and dispatched by the above | `pages.yml` |

Control the automatic bump from the merge commit subject:

- default is a **patch** (0.3.0 → 0.3.1)
- `[minor]` in the subject gives 0.3.0 → 0.4.0
- `[major]` gives 1.0.0
- `[skip release]` lands the commit without releasing anything

Never build `docs/app` locally and never commit it. It is gitignored and
produced in CI, precisely so the committed tree cannot carry a bundle that has
drifted from the source.

## When to do it by hand instead

The automatic changelog entry is a list of commit subjects. That is honest but
thin. Take over manually when:

- the release deserves a **written** changelog entry: a headline feature, a
  breaking change, anything a user needs prose to understand
- you want a specific version the commit-subject markers cannot express
- an automatic release half-failed and needs repairing

To take over, land the work with `[skip release]` in the merge subject, then
follow the steps below.

## Step 1: check the ground is solid

```bash
git checkout main && git pull && git status --short
```

Stop and tell the user if the tree is dirty or `main` is behind. Then confirm the
last release and what has landed since:

```bash
git describe --tags --abbrev=0 && git log $(git describe --tags --abbrev=0)..main --oneline
```

If there are no commits since the last tag, there is nothing to release, so say so
rather than cutting an empty version.

## Step 2: pick the version

Read the commits from step 1 and choose a semver bump. Officewrite is pre-1.0,
so the practical rule is:

- **patch** (0.3.0 → 0.3.1) - fixes and internal work only
- **minor** (0.3.0 → 0.4.0) - new features, new templates, new UI surfaces
- **major**: not yet; pre-1.0 breaking changes go in a minor and are called out
  loudly in the changelog, the way the `.dansword` → `.officewrite` change was

State the version you picked and why before you change any files.

## Step 3 - bump the version everywhere

Five places carry it. Four are package manifests, and npm can do all of them
plus the lockfile in one command:

```bash
npm version 0.4.0 --workspaces --include-workspace-root --no-git-tag-version
```

`--no-git-tag-version` matters: npm would otherwise create its own tag and
commit, and the tag must not exist until step 6.

The fifth is the JSON-LD block on the marketing page, which npm knows nothing
about. Edit `docs/index.html`:

```
"softwareVersion": "0.4.0",
```

Verify all five moved before continuing:

```bash
git diff --stat && grep -rn '"version"\|softwareVersion' package.json apps/desktop/package.json packages/core/package.json packages/openxml/package.json docs/index.html | grep -v '"version": "1'
```

## Step 4 - write the CHANGELOG entry

Add a new section at the top of `CHANGELOG.md`, directly under the preamble and
above the previous version.

**The heading must be exactly `## [0.4.0]`**: square brackets, no leading `v`.
`scripts/generate-release-notes.mjs` finds the release's hand-written notes by
matching that pattern, and `CHANGELOG.md` is also imported straight into the app
for Help > What's New. A malformed heading silently produces a release with no
notes.

Follow the existing shape: a bold one-line summary of what the release is, then
`### Added` / `### Changed` / `### Fixed` / `### Notes` as they apply. Write for
someone using the app, not someone reading the diff - "the template picker now
has 32 templates and a search box", not "refactored defaults.ts". The commit
list is appended automatically by the release notes script, so this section's
job is the part commits cannot say.

## Step 5 - get it onto main

This repo works through squash-merged PRs, so the bump goes through one too:

```bash
git checkout -b release-0.4.0 && git add -A && git commit -m "Release 0.4.0"
```

```bash
git push -u origin release-0.4.0 && gh pr create --base main --title "Release 0.4.0" --body "Version bump and changelog for 0.4.0."
```

Wait for all four checks (`regression`, `visual`, GitGuardian, Snyk) before
merging - the release workflow re-runs the same gates and a tag on a red commit
wastes a full Windows build:

```bash
gh pr checks --watch --interval 20
```

Then merge and return to main:

Merge with `[skip release]` in the subject, so `auto-release.yml` does not cut a
second version on top of the one you are cutting by hand:

```bash
gh pr merge --squash --delete-branch --subject "Release 0.4.0 [skip release]" && git checkout main && git pull
```

## Step 6 - tag, which publishes the release

Tag the squashed commit that is now on `main`:

```bash
git tag v0.4.0 && git push origin v0.4.0
```

That fires `release.yml`, which runs the QA gates again, generates the notes
from the changelog plus the commit log, builds the installer with
`electron-builder`, and attaches the `.exe` to a new GitHub Release.

## Step 7 - verify it actually shipped

Do not report success off a green tick alone. Confirm the artifact exists:

```bash
gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

```bash
gh release view v0.4.0 --json assets,url --jq '{url: .url, assets: [.assets[].name]}'
```

The asset list must contain a `.exe`. A release with notes and no installer is
the failure mode worth catching - the download button on the site resolves the
latest release through the GitHub API, so an assetless release breaks it live.

Then confirm the site deploy that the merge triggered:

```bash
gh run list --workflow=pages.yml --limit 1
```

Report the release URL, the version, and the installer filename.

## Things that will bite you

**Playwright reuses whatever is on port 5173.** If you run e2e locally and an
unrelated dev server holds that port, every test fails on timeouts that look
nothing like a port clash. The config anticipates it:

```bash
OFFICEWRITE_TEST_PORT=5199 npx playwright test tests/e2e
```

**The browser binary may be missing** (`npx playwright install chromium`). CI
always has it; a fresh clone does not.

**Never hand-edit `docs/app/`.** Gitignored, built in CI.

**The tag must point at a commit already on `main`.** Tagging a local commit you
have not pushed produces a release built from code nobody else has.

**Do not delete and re-push a tag to "redo" a release.** It leaves the published
release pointing at a commit that no longer matches. Cut the next patch version
instead.
