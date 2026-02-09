import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

type IndexModule = typeof import('../src/index.js');

const require = createRequire(import.meta.url);
const { HELP_TEXT, runCli } = require('../dist/index.js') as Pick<
  IndexModule,
  'HELP_TEXT' | 'runCli'
>;

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
