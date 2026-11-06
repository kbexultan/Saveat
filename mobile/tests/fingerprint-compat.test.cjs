// Compatibility coverage for the narrowly scoped @expo/fingerprint overrides.
const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { createRequire } = require('node:module');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve, sep } = require('node:path');
const fingerprintRequire = createRequire(require.resolve('@expo/fingerprint'));
const { glob } = fingerprintRequire('glob');
const paths = require('@expo/fingerprint/build/utils/Path');
const { createFingerprintAsync } = require('@expo/fingerprint');

const fixture = mkdtempSync(join(tmpdir(), 'saveat-fingerprint-'));
after(() => {
  assert.ok(resolve(fixture).startsWith(resolve(tmpdir()) + sep + 'saveat-fingerprint-'));
  rmSync(fixture, { recursive: true });
});

test('fingerprint glob preserves nested ignore-file discovery', async () => {
  for (const dir of ['android/app', 'ios', 'node_modules/ignored']) mkdirSync(join(fixture, dir), { recursive: true });
  for (const file of ['.gitignore', 'android/.gitignore', 'ios/.gitignore', 'node_modules/ignored/.gitignore']) {
    writeFileSync(join(fixture, file), 'build\n');
  }
  const found = await glob('**/.gitignore', { cwd: fixture, ignore: ['node_modules'], follow: false });
  // fingerprint passes a directory-only ignore (not node_modules/**).
  // Keep glob 13's discovery semantics; fingerprint filters those paths later.
  assert.deepEqual(found.map(p => p.replaceAll('\\', '/')).sort(), ['.gitignore', 'android/.gitignore', 'ios/.gitignore', 'node_modules/ignored/.gitignore']);
  const excluded = await glob('**/.gitignore', { cwd: fixture, ignore: ['node_modules/**'], follow: false });
  assert.equal(excluded.length, 3);
});

test('fingerprint minimatch preserves exclusions, negation, dotfiles and directory pruning', () => {
  const patterns = paths.buildPathMatchObjects(['android/build/**', '!android/build/keep.txt', '**/.cache/**']);
  assert.equal(paths.isIgnoredPathWithMatchObjects('android/build/output.apk', patterns), true);
  assert.equal(paths.isIgnoredPathWithMatchObjects('android/build/keep.txt', patterns), false);
  assert.equal(paths.isIgnoredPathWithMatchObjects('ios/.cache/native', patterns), true);
  assert.equal(paths.isIgnoredPathWithMatchObjects('android/app/src/main', patterns), false);
  const dirs = paths.buildDirMatchObjects(patterns);
  assert.equal(paths.isIgnoredPathWithMatchObjects('android/build', dirs), false);
});

test('actual Expo project fingerprint is stable on unchanged native inputs', async () => {
  const project = resolve(__dirname, '..');
  const first = await createFingerprintAsync(project, { silent: true });
  const second = await createFingerprintAsync(project, { silent: true });
  assert.ok(first.sources.length > 0);
  assert.match(first.hash, /^[0-9a-f]{40}$/);
  assert.equal(second.hash, first.hash);
  assert.deepEqual(second.sources, first.sources);
});
