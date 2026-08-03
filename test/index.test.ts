import assert from 'node:assert/strict';
import test from 'node:test';
import { HELP_TEXT, isExitPromptError, runCli } from '../src/index.ts';

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
  let called = false;
  const exitCode = await runCli([], {
    runCreateCommand: async () => {
      called = true;
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(called, true);
});

test('isExitPromptError recognizes prompt cancellation errors only', () => {
  const promptError = new Error('User force closed the prompt with SIGINT');
  promptError.name = 'ExitPromptError';

  assert.equal(isExitPromptError(promptError), true);
  assert.equal(isExitPromptError(new Error('boom')), false);
  assert.equal(isExitPromptError('ExitPromptError'), false);
});

test('runCli prints help for unsupported command', async () => {
  let output = '';
  const exitCode = await runCli(['unknown'], {
    writeStdout: (message: string) => {
      output = message;
    },
  });

  assert.equal(exitCode, 1);
  assert.equal(output, HELP_TEXT);
});
