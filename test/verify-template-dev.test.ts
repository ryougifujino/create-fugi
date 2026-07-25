import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderDashboard,
  sanitizeLogChunk,
  stripAnsi,
} from '../scripts/verify-template-dev.js';

const dashboardState = {
  templates: [
    {
      name: 'react',
      absolutePath: '/repo/templates/react',
      devCommand: 'vite',
      status: 'running',
      detail: 'pnpm dev',
    },
    {
      name: 'mono-node',
      absolutePath: '/repo/templates/mono-node',
      devCommand: 'pnpm --filter @mono-node/node dev',
      status: 'pending',
      detail: 'waiting',
    },
  ],
  currentIndex: 0,
  phase: 'Starting dev server…',
  logs: [
    {
      text: 'VITE ready in 120 ms',
      source: 'stdout',
    },
  ],
};

test('renderDashboard renders a full dashboard within the terminal dimensions', () => {
  const output = stripAnsi(
    renderDashboard(dashboardState, {
      columns: 80,
      rows: 24,
      frame: 0,
    }),
  );
  const lines = output.split('\n');

  assert.ok(lines.length <= 24);
  assert.ok(lines.every((line) => [...line].length <= 80));
  assert.match(output, /Template Dev Review/);
  assert.match(output, /react/);
  assert.match(output, /VITE ready in 120 ms/);
  assert.match(output, /c continue \/ stop current/);
});

test('renderDashboard switches to a compact layout for narrow terminals', () => {
  const output = stripAnsi(
    renderDashboard(dashboardState, {
      columns: 40,
      rows: 12,
      frame: 1,
    }),
  );
  const lines = output.split('\n');

  assert.ok(lines.length <= 12);
  assert.ok(lines.every((line) => [...line].length <= 40));
  assert.match(output, /react/);
  assert.match(output, /c continue/);
});

test('sanitizeLogChunk removes terminal control sequences and splits carriage returns', () => {
  assert.deepEqual(sanitizeLogChunk('\u001B[32mready\u001B[0m\rbuilding 50%\r\n'), [
    'ready',
    'building 50%',
  ]);
});
