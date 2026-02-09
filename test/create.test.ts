import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

type CreateModule = typeof import('../src/commands/create.js');

const require = createRequire(import.meta.url);
const { runCreateCommand } = require('../dist/commands/create.js') as Pick<
  CreateModule,
  'runCreateCommand'
>;

test('runCreateCommand copies selected template into new project directory', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'scaffolds-create-'));

  try {
    const templatesRootDir = path.join(tempRootDir, 'templates');
    const reactTemplateDir = path.join(templatesRootDir, 'react');
    const cwd = path.join(tempRootDir, 'workspace');

    await mkdir(path.join(reactTemplateDir, 'src'), { recursive: true });
    await mkdir(cwd, { recursive: true });
    await writeFile(path.join(reactTemplateDir, 'README.md'), '# React');
    await writeFile(path.join(reactTemplateDir, 'src', 'main.ts'), 'main()');

    await runCreateCommand({
      cwd,
      promptTemplate: async () => 'react',
      promptProjectName: async () => 'demo-app',
      downloadTemplatesDirectory: async () => ({
        branch: 'main',
        templatesRootDir,
      }),
      log: () => {},
    });

    const readme = await readFile(
      path.join(cwd, 'demo-app', 'README.md'),
      'utf-8',
    );
    const mainTs = await readFile(
      path.join(cwd, 'demo-app', 'src', 'main.ts'),
      'utf-8',
    );

    assert.equal(readme, '# React');
    assert.equal(mainTs, 'main()');
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('runCreateCommand fails when target project directory already exists', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'scaffolds-create-'));

  try {
    const templatesRootDir = path.join(tempRootDir, 'templates');
    const vueTemplateDir = path.join(templatesRootDir, 'vue');
    const cwd = path.join(tempRootDir, 'workspace');
    const existingProjectDir = path.join(cwd, 'existing-app');

    await mkdir(vueTemplateDir, { recursive: true });
    await mkdir(existingProjectDir, { recursive: true });

    await assert.rejects(
      runCreateCommand({
        cwd,
        promptTemplate: async () => 'vue',
        promptProjectName: async () => 'existing-app',
        downloadTemplatesDirectory: async () => ({
          branch: 'main',
          templatesRootDir,
        }),
        log: () => {},
      }),
      /Target directory already exists/,
    );
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});
