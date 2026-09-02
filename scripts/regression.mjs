#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function run(label, command, args) {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function has(command) {
  return spawnSync(command, ['--help'], { stdio: 'ignore', shell: true }).status === 0;
}

/**
 * Electron needs a display. On a headless Linux box - a container, a CI runner,
 * an SSH session - the step used to abort the whole suite with an X error
 * partway through, so nothing after it ran either.
 */
function runElectronTests() {
  const headless = process.platform === 'linux' && !process.env.DISPLAY;
  if (!headless) {
    run('Electron tests', 'npm', ['run', 'test:electron']);
    return;
  }
  if (has('xvfb-run')) {
    run('Electron tests (xvfb)', 'xvfb-run', ['-a', 'npm', 'run', 'test:electron']);
    return;
  }
  console.log('\n=== Electron tests ===\n');
  console.log('Skipped: no DISPLAY and xvfb-run is not installed.');
  console.log('Install it (apt-get install xvfb) or run with a display attached.\n');
}

// Cheap and first: a punctuation slip should not wait behind a full build.
run('Em dash check', 'npm', ['run', 'check:em-dashes']);
run('Typecheck', 'npm', ['run', 'typecheck']);
run('Build', 'npm', ['run', 'build']);
run('Unit tests', 'npm', ['run', 'test:unit']);
run('End-to-end tests', 'npm', ['run', 'test:e2e']);
runElectronTests();
run('Visual regression tests', 'npm', ['run', 'test:visual']);

console.log('\nRegression suite completed successfully.\n');
