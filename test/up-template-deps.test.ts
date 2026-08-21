import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  deduplicateValidationTargets,
  extractCommandWarnings,
  isRecursivePnpmScript,
  parseStoreDirFromModulesYaml,
  parseWorkspacePackagePatterns,
  removeTemplateLockfile,
  selectValidationScripts,
} from '../scripts/up-template-deps.js';

test('removeTemplateLockfile removes a lockfile and tolerates an absent one', async (context) => {
  const templateDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-template-'));
  const lockfilePath = path.join(templateDir, 'pnpm-lock.yaml');
  context.after(() => rm(templateDir, { force: true, recursive: true }));

  await writeFile(lockfilePath, 'lockfileVersion: 9.0\n');
  await removeTemplateLockfile(templateDir);

  await assert.rejects(access(lockfilePath), { code: 'ENOENT' });
  await removeTemplateLockfile(templateDir);
});

test('parseWorkspacePackagePatterns reads patterns from the packages section only', () => {
  const workspaceContent = [
    '# workspace definition',
    'packages:',
    '  - apps/*',
    "  - 'packages/*' # scoped",
    '  - "tools/cli"',
    '',
    'catalog:',
    '  react: ^19.0.0',
  ].join('\n');

  assert.deepEqual(parseWorkspacePackagePatterns(workspaceContent), [
    'apps/*',
    'packages/*',
    'tools/cli',
  ]);
});

test('parseWorkspacePackagePatterns returns nothing without a packages section', () => {
  assert.deepEqual(parseWorkspacePackagePatterns('catalog:\n  react: ^19.0.0\n'), []);
});

test('extractCommandWarnings collects deprecated and unmet peer warnings with their package', () => {
  const output = [
    ' WARN  2 deprecated subdependencies found: abab@2.0.6, domexception@4.0.0',
    'app-a',
    ' WARN  Issues with peer dependencies found',
    'apps/desktop',
    '└─┬ some-plugin 1.0.0',
    '  └── ✕ unmet peer vite@^6: found 7.3.1',
  ].join('\n');

  assert.deepEqual(extractCommandWarnings(output), [
    '2 deprecated subdependencies found: abab@2.0.6, domexception@4.0.0',
    'some-plugin 1.0.0 -> ✕ unmet peer vite@^6: found 7.3.1',
  ]);
});

test('extractCommandWarnings reports the peer dependency banner when details are missing', () => {
  const warnings = extractCommandWarnings(' WARN  Issues with peer dependencies found\n');

  assert.deepEqual(warnings, ['peer dependency issues found']);
});

test('extractCommandWarnings returns nothing for clean output', () => {
  assert.deepEqual(extractCommandWarnings('Done in 2.1s\n'), []);
});

test('isRecursivePnpmScript detects recursive pnpm invocations of the same script', () => {
  assert.equal(isRecursivePnpmScript('pnpm -r typecheck', 'typecheck'), true);
  assert.equal(isRecursivePnpmScript('pnpm --recursive lint', 'lint'), true);
  assert.equal(isRecursivePnpmScript('pnpm -r --parallel dev', 'typecheck'), false);
  assert.equal(isRecursivePnpmScript('pnpm typecheck', 'typecheck'), false);
  assert.equal(isRecursivePnpmScript('tsc -b --noEmit', 'typecheck'), false);
  assert.equal(isRecursivePnpmScript(undefined, 'typecheck'), false);
});

test('deduplicateValidationTargets skips child scripts covered by recursive root scripts', () => {
  const rootTarget = {
    label: 'root',
    validationScripts: ['typecheck', 'lint'],
    scriptCommands: { typecheck: 'pnpm -r typecheck', lint: 'oxlint' },
    skippedValidationScripts: [],
  };
  const childTarget = {
    label: 'apps/web',
    validationScripts: ['typecheck', 'lint'],
    scriptCommands: { typecheck: 'tsc --noEmit', lint: 'oxlint' },
    skippedValidationScripts: [],
  };

  const [dedupedRoot, dedupedChild] = deduplicateValidationTargets([rootTarget, childTarget]);

  assert.deepEqual(dedupedRoot, rootTarget);
  assert.deepEqual(dedupedChild!.validationScripts, ['lint']);
  assert.deepEqual(dedupedChild!.skippedValidationScripts, ['typecheck']);
});

test('deduplicateValidationTargets keeps targets untouched without recursive root scripts', () => {
  const targets = [
    {
      label: 'root',
      validationScripts: ['typecheck'],
      scriptCommands: { typecheck: 'tsc --noEmit' },
      skippedValidationScripts: [],
    },
    {
      label: 'apps/web',
      validationScripts: ['typecheck'],
      scriptCommands: { typecheck: 'tsc --noEmit' },
      skippedValidationScripts: [],
    },
  ];

  assert.deepEqual(deduplicateValidationTargets(targets), targets);
});

test('parseStoreDirFromModulesYaml reads plain and quoted storeDir values', () => {
  assert.equal(parseStoreDirFromModulesYaml('storeDir: /Users/me/.pnpm-store/v10\n'), '/Users/me/.pnpm-store/v10');
  assert.equal(parseStoreDirFromModulesYaml("storeDir: '/Users/me/.pnpm-store/v10'\n"), '/Users/me/.pnpm-store/v10');
  assert.equal(parseStoreDirFromModulesYaml('virtualStoreDir: .pnpm\n'), null);
});

test('selectValidationScripts keeps whitelist order regardless of input order', () => {
  assert.deepEqual(selectValidationScripts(['lint', 'typecheck', 'dev', 'build']), [
    'typecheck',
    'lint',
    'build',
  ]);
  assert.deepEqual(selectValidationScripts([]), []);
});
