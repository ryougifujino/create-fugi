import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ensureDirectoryDoesNotExist,
  ensureDirectoryIsEmpty,
  listTemplates,
  resolveProjectTarget,
  validateProjectName,
  validateProjectNameInput,
} from '../src/lib/templates.ts';

test('validateProjectName accepts legal names', () => {
  assert.equal(validateProjectName('demo-app'), 'demo-app');
  assert.equal(validateProjectName('demo-app-1'), 'demo-app-1');
});

test('validateProjectName rejects invalid names', () => {
  assert.throws(() => validateProjectName(''), /required/);
  assert.throws(() => validateProjectName('hello/world'), /single directory/);
  assert.throws(() => validateProjectName('../parent'), /single directory/);
  assert.throws(() => validateProjectName('Demo-App'), /kebab-case/);
  assert.throws(() => validateProjectName('demo_app'), /kebab-case/);
  assert.throws(() => validateProjectName('demo.app'), /kebab-case/);
  assert.throws(() => validateProjectName('-demo-app'), /kebab-case/);
  assert.throws(() => validateProjectName('demo-app-'), /kebab-case/);
  assert.throws(() => validateProjectName('demo--app'), /kebab-case/);
  assert.throws(
    () => validateProjectName('bad name'),
    /kebab-case/,
  );
});

test('validateProjectNameInput accepts "." on top of legal names', () => {
  assert.equal(validateProjectNameInput('.'), '.');
  assert.equal(validateProjectNameInput(' . '), '.');
  assert.equal(validateProjectNameInput('demo-app'), 'demo-app');
  assert.throws(() => validateProjectNameInput('..'), /"\." or "\.\."/);
  assert.throws(() => validateProjectNameInput('Demo-App'), /kebab-case/);
});

test('resolveProjectTarget resolves a new project directory for regular names', () => {
  const target = resolveProjectTarget('/tmp/workspace', 'demo-app');

  assert.deepEqual(target, {
    projectName: 'demo-app',
    targetDir: path.join('/tmp/workspace', 'demo-app'),
    isCurrentDir: false,
  });
});

test('resolveProjectTarget uses the current directory for "."', () => {
  const target = resolveProjectTarget('/tmp/workspace/demo-app', '.');

  assert.deepEqual(target, {
    projectName: 'demo-app',
    targetDir: '/tmp/workspace/demo-app',
    isCurrentDir: true,
  });
});

test('resolveProjectTarget rejects "." when the current directory name is invalid', () => {
  assert.throws(
    () => resolveProjectTarget('/tmp/workspace/Demo App', '.'),
    /Current directory name "Demo App" cannot be used as the project name/,
  );
});

test('ensureDirectoryIsEmpty allows empty or missing directories and ignores .git', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-templates-'));

  try {
    await ensureDirectoryIsEmpty(tempRootDir);
    await ensureDirectoryIsEmpty(path.join(tempRootDir, 'missing'));

    await mkdir(path.join(tempRootDir, '.git'));
    await ensureDirectoryIsEmpty(tempRootDir);

    await writeFile(path.join(tempRootDir, 'README.md'), '# hi');
    await assert.rejects(
      ensureDirectoryIsEmpty(tempRootDir),
      /Current directory is not empty/,
    );
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('listTemplates returns only directories in lexical order', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-templates-'));

  try {
    const templatesRootDir = path.join(tempRootDir, 'templates');
    await mkdir(path.join(templatesRootDir, 'vue'), { recursive: true });
    await mkdir(path.join(templatesRootDir, 'react'), { recursive: true });

    const templates = await listTemplates(templatesRootDir);

    assert.deepEqual(
      templates.map((template) => template.name),
      ['react', 'vue'],
    );
    assert.equal(typeof templates[0]!.description, 'string');
    assert.equal(templates[1]!.description, undefined);
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('ensureDirectoryDoesNotExist throws when target exists', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-templates-'));

  try {
    await assert.rejects(
      ensureDirectoryDoesNotExist(tempRootDir),
      /Target directory already exists/,
    );
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});
