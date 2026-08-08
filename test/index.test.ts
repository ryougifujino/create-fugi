import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CreateCliOptions } from '../src/index.ts';
import { HELP_TEXT, isExitPromptError, isMainModule, runCli } from '../src/index.ts';

test('runCli delegates create command', async () => {
  let called = false;
  const exitCode = await runCli(['create'], {
    runCreateCommand: async () => {
      called = true;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(called, true);
});

test('runCli delegates create command when invoked without arguments', async () => {
  let receivedOptions: CreateCliOptions | undefined;
  const exitCode = await runCli([], {
    runCreateCommand: async (options) => {
      receivedOptions = options;
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(receivedOptions, { projectName: undefined, templateName: undefined });
});

test('runCli forwards project name and template arguments', async () => {
  let receivedOptions: CreateCliOptions | undefined;
  const exitCode = await runCli(['my-app', '--template', 'react'], {
    runCreateCommand: async (options) => {
      receivedOptions = options;
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(receivedOptions, { projectName: 'my-app', templateName: 'react' });
});

test('runCli supports the explicit create command with short template flag', async () => {
  let receivedOptions: CreateCliOptions | undefined;
  const exitCode = await runCli(['create', 'my-app', '-t', 'react'], {
    runCreateCommand: async (options) => {
      receivedOptions = options;
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(receivedOptions, { projectName: 'my-app', templateName: 'react' });
});

test('runCli prints help and succeeds for --help', async () => {
  let output = '';
  const exitCode = await runCli(['--help'], {
    writeStdout: (message: string) => {
      output = message;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(output, HELP_TEXT);
});

test('runCli prints the version for --version', async () => {
  let output = '';
  const exitCode = await runCli(['--version'], {
    readVersion: async () => '9.9.9',
    writeStdout: (message: string) => {
      output = message;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(output, '9.9.9');
});

test('runCli prints help and fails for unknown options', async () => {
  let output = '';
  const exitCode = await runCli(['--unknown'], {
    writeStdout: (message: string) => {
      output = message;
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output, HELP_TEXT);
});

test('runCli prints help and fails for extra positional arguments', async () => {
  let output = '';
  const exitCode = await runCli(['my-app', 'other-app'], {
    writeStdout: (message: string) => {
      output = message;
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output, HELP_TEXT);
});

test('isExitPromptError recognizes prompt cancellation errors only', () => {
  const promptError = new Error('User force closed the prompt with SIGINT');
  promptError.name = 'ExitPromptError';

  assert.equal(isExitPromptError(promptError), true);
  assert.equal(isExitPromptError(new Error('boom')), false);
  assert.equal(isExitPromptError('ExitPromptError'), false);
});

test('isMainModule recognizes an entry path reached through a package bin symlink', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'create-fugi-entry-'));
  t.after(async () => rm(temporaryDirectory, { recursive: true, force: true }));

  const modulePath = fileURLToPath(new URL('../src/index.ts', import.meta.url));
  const binPath = path.join(temporaryDirectory, 'create-fugi');
  await symlink(modulePath, binPath);

  assert.equal(isMainModule(pathToFileURL(modulePath).href, binPath), true);
});
