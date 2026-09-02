---
name: officewrite-deploy
description: >-
  Deploy Officewrite to GitHub Pages or create a Windows release. Respect Daniel's
  current-turn testing preference. Generate detailed GitHub release notes for
  accountability.
---

# Deploy Officewrite

Use when the user asks to **deploy**, **release**, **publish**, **push to GitHub Pages**, or **ship a build**.

## Non-negotiable rule

Never deploy a Windows release without passing QA unless the user's message explicitly contains `OVERRIDE` (for example, "release with OVERRIDE"). For GitHub Pages docs deploys, verify Pages site files and rely on the separate Regression workflow for app QA.

Do not run local tests, browser QA, visual checks, screenshots, builds, or other automated verification unless Daniel explicitly asks for it in the current turn.

| User says | Agent must |
|-----------|------------|
| "publish site" / "deploy Pages" | Verify Pages files if Daniel asked for verification; otherwise explain the GitHub workflow check |
| "release" | Ask Daniel to run or explicitly authorize QA before release |
| "release OVERRIDE" | Warn about skipped QA and release only if Daniel insists |
| QA fails | Stop. List failures and fixes. Do not release. |

## QA expectations

Local QA commands are Daniel-run unless he explicitly asks the agent to run them:

```bash
cd c:\src\Officewrite
npm install
npx playwright install chromium
npm run pre-deploy
```

`npm run pre-deploy` runs:

1. `npm run verify:pages` - site files exist
2. `npm run regression` - catalog audit, typecheck, build, unit, e2e, visual

### If QA fails

1. Do not `git push`, tag, create a release, or trigger release workflows.
2. Report which step failed and the concrete fix target.
3. Offer to fix the failures, then tell Daniel which focused command to run.

### If user explicitly said OVERRIDE

```bash
# PowerShell
$env:DEPLOY_OVERRIDE="true"; npm run pre-deploy
```

Warn the user that tests were skipped and list what was not verified.

## GitHub Pages

URL: https://dandanitman.github.io/Officewrite/

One-time setup: Repo -> Settings -> Pages -> Source -> GitHub Actions.

Workflow: `.github/workflows/pages.yml`.

The Pages workflow checks docs-site files and deploys `docs/`. App QA is handled by `.github/workflows/regression.yml`.

## Windows release

After QA passes:

1. Bump version in root `package.json` and `apps/desktop/package.json` if needed.
2. Generate release notes:

```bash
node scripts/generate-release-notes.mjs v0.2.0 --output release-notes.md
```

3. Commit, tag, and push:

```bash
git add -A
git commit -m "Release v0.2.0."
git tag v0.2.0
git push origin main
git push origin v0.2.0
```

4. Workflow `.github/workflows/release.yml` runs QA gates, builds the Windows installer, and publishes the release.

## Commands reference

Suggest these for Daniel as needed:

| Command | Purpose |
|---------|---------|
| `npm run pre-deploy` | Full release gate |
| `npm run regression` | Full local suite |
| `npm run verify:pages` | Pages file check only |
| `node scripts/generate-release-notes.mjs vX.Y.Z --output release-notes.md` | Release changelog |

## Do not

- Deploy a Windows release on failing tests without explicit user `OVERRIDE`
- Skip release notes on version tags
- Commit PATs or secrets
- Force-push to `main`

## Related

- Testing: `docs/testing.md`, skill `officewrite-add-regression-test`
- CI: `.github/workflows/regression.yml`, `pages.yml`, `release.yml`
