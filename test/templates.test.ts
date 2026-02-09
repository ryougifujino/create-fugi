import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

type TemplatesModule = typeof import('../src/lib/templates.js');

const require = createRequire(import.meta.url);
const { ensureDirectoryDoesNotExist, listTemplates, validateProjectName } =
  require('../dist/lib/templates.js') as Pick<
    TemplatesModule,
    'ensureDirectoryDoesNotExist' | 'listTemplates' | 'validateProjectName'
  >;

test('validateProjectName accepts legal names', () => {
  assert.equal(validateProjectName('demo-app'), 'demo-app');
  assert.equal(validateProjectName('demo.app_1'), 'demo.app_1');
});

test('validateProjectName rejects invalid names', () => {
  assert.throws(() => validateProjectName(''), /required/);
  assert.throws(() => validateProjectName('hello/world'), /single directory/);
  assert.throws(() => validateProjectName('../parent'), /single directory/);
  assert.throws(
    () => validateProjectName('bad name'),
    /can only contain letters, numbers, dots, underscores, and hyphens/,
  );
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
