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
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-create-'));

  try {
    const templatesRootDir = path.join(tempRootDir, 'templates');
    const gitignoresRootDir = path.join(tempRootDir, 'gitignores');
    const reactTemplateDir = path.join(templatesRootDir, 'react');
    const cwd = path.join(tempRootDir, 'workspace');

    await mkdir(path.join(reactTemplateDir, 'src'), { recursive: true });
    await mkdir(gitignoresRootDir, { recursive: true });
    await mkdir(cwd, { recursive: true });
    await writeFile(path.join(reactTemplateDir, 'README.md'), '# React');
    await writeFile(path.join(reactTemplateDir, 'src', 'main.ts'), 'main()');
    await writeFile(path.join(reactTemplateDir, '.gitignore'), '# template-only\n');
    await writeFile(path.join(gitignoresRootDir, 'react_gitignore'), 'node_modules\n');
    await writeFile(
      path.join(reactTemplateDir, 'package.json'),
      JSON.stringify({ name: 'react' }, null, 2),
    );
    await writeFile(
      path.join(reactTemplateDir, 'index.html'),
      '<!doctype html><html><head><title>react</title></head></html>',
    );

    await runCreateCommand({
      cwd,
      promptTemplate: async () => 'react',
      promptProjectName: async () => 'demo-app',
      templatesRootDir,
      gitignoresRootDir,
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
    const packageJson = await readFile(
      path.join(cwd, 'demo-app', 'package.json'),
      'utf-8',
    );
    const indexHtml = await readFile(
      path.join(cwd, 'demo-app', 'index.html'),
      'utf-8',
    );
    const gitignore = await readFile(
      path.join(cwd, 'demo-app', '.gitignore'),
      'utf-8',
    );

    assert.equal(readme, '# React');
    assert.equal(mainTs, 'main()');
    assert.match(packageJson, /"name": "demo-app"/);
    assert.match(indexHtml, /<title>demo-app<\/title>/);
    assert.equal(gitignore, 'node_modules\n');
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('runCreateCommand rewrites scoped package references to the project name', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-create-'));

  try {
    const templatesRootDir = path.join(tempRootDir, 'templates');
    const gitignoresRootDir = path.join(tempRootDir, 'gitignores');
    const monoTemplateDir = path.join(templatesRootDir, 'mono-electron-solid');
    const desktopDir = path.join(monoTemplateDir, 'apps', 'desktop');
    const cwd = path.join(tempRootDir, 'workspace');

    await mkdir(desktopDir, { recursive: true });
    await mkdir(gitignoresRootDir, { recursive: true });
    await mkdir(cwd, { recursive: true });
    await writeFile(path.join(gitignoresRootDir, 'mono-electron-solid_gitignore'), 'node_modules\n');
    await writeFile(
      path.join(monoTemplateDir, 'package.json'),
      JSON.stringify(
        {
          name: 'mono-electron-solid',
          scripts: {
            dev: 'pnpm --filter @mono-electron-solid/desktop dev',
          },
        },
        null,
        2,
      ),
    );
    await writeFile(
      path.join(desktopDir, 'package.json'),
      JSON.stringify({ name: '@mono-electron-solid/desktop' }, null, 2),
    );
    await writeFile(
      path.join(desktopDir, 'README.md'),
      'pnpm --filter @mono-electron-solid/desktop dev:renderer',
    );

    await runCreateCommand({
      cwd,
      promptTemplate: async () => 'mono-electron-solid',
      promptProjectName: async () => 'demo-app',
      templatesRootDir,
      gitignoresRootDir,
      log: () => {},
    });

    const workspacePackageJson = await readFile(
      path.join(cwd, 'demo-app', 'package.json'),
      'utf-8',
    );
    const desktopPackageJson = await readFile(
      path.join(cwd, 'demo-app', 'apps', 'desktop', 'package.json'),
      'utf-8',
    );
    const desktopReadme = await readFile(
      path.join(cwd, 'demo-app', 'apps', 'desktop', 'README.md'),
      'utf-8',
    );

    assert.match(workspacePackageJson, /"name": "demo-app"/);
    assert.match(workspacePackageJson, /@demo-app\/desktop/);
    assert.match(desktopPackageJson, /"name": "@demo-app\/desktop"/);
    assert.match(desktopReadme, /@demo-app\/desktop/);
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('runCreateCommand fails when generated template gitignore is missing', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-create-'));

  try {
    const templatesRootDir = path.join(tempRootDir, 'templates');
    const gitignoresRootDir = path.join(tempRootDir, 'gitignores');
    const reactTemplateDir = path.join(templatesRootDir, 'react');
    const cwd = path.join(tempRootDir, 'workspace');

    await mkdir(reactTemplateDir, { recursive: true });
    await mkdir(gitignoresRootDir, { recursive: true });
    await mkdir(cwd, { recursive: true });
    await writeFile(
      path.join(reactTemplateDir, 'package.json'),
      JSON.stringify({ name: 'react' }, null, 2),
    );

    await assert.rejects(
      runCreateCommand({
        cwd,
        promptTemplate: async () => 'react',
        promptProjectName: async () => 'demo-app',
        templatesRootDir,
        gitignoresRootDir,
        log: () => {},
      }),
      /Missing generated gitignore for template "react"/,
    );
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('runCreateCommand fails when target project directory already exists', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-create-'));

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
        templatesRootDir,
        log: () => {},
      }),
      /Target directory already exists/,
    );
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});
