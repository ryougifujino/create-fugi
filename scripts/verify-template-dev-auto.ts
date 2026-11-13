import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify, stripVTControlCharacters } from 'node:util';
import { chromium, type Browser, type Page } from 'playwright';
import type { RunnableTemplate, startTemplateDev } from './verify-template-dev.ts';

type StartTemplateDev = typeof startTemplateDev;

const execFileAsync = promisify(execFile);
const startupTimeoutMs = 60_000;
const actionTimeoutMs = 10_000;
const maximumLogLines = 25;
const devErrorPattern =
  /ERR_PNPM_|ELIFECYCLE|\[verify-template-dev:renderer\]|\[ERROR\]|\b(?:Error|TypeError|ReferenceError|SyntaxError|RangeError):|\b(?:panic:|error when starting dev server|Internal server error:|Pre-transform error:|failed to build)/i;

const checks = new Map([
  ['react', 'web-counter'],
  ['mono-electron-react', 'electron-counter'],
  ['mono-electron-solid', 'electron-counter'],
  ['mono-go-react', 'web-api'],
  ['mono-go-solid', 'web-api'],
  ['mono-hono-react', 'web-api'],
  ['mono-hono-electron-react', 'electron-api'],
  ['mono-hono-electron-solid', 'electron-api'],
  ['mono-node', 'node'],
]);

export async function verifyTemplates(templates: RunnableTemplate[], skipped: string[], startTemplateDev: StartTemplateDev, pnpmCommand: string) {
  const run = new AbortController();
  const interrupt = () => {
    const error = new Error('Template dev verification interrupted.');
    error.name = 'AbortError';
    run.abort(error);
  };
  const terminate = () => run.abort(new Error('Template dev verification terminated.'));
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);

  let failed = 0;
  try {
    for (const [index, template] of templates.entries()) {
      run.signal.throwIfAborted();
      console.log(`[${index + 1}/${templates.length}] ${template.name} · pnpm dev`);

      try {
        const detail = await verifyTemplate(template, startTemplateDev, pnpmCommand, run.signal);
        console.log(`  PASS ${detail}`);
      } catch (error) {
        run.signal.throwIfAborted();
        console.error(`  FAIL ${errorMessage(error)}`);
        failed += 1;
      }
    }
    run.signal.throwIfAborted();
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }

  console.log(`\n${templates.length - failed} passed, ${failed} failed, ${skipped.length} skipped`);
  if (skipped.length > 0) {
    console.log(`Skipped (no root dev script): ${skipped.join(', ')}`);
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function verifyTemplate(template: RunnableTemplate, startTemplateDev: StartTemplateDev, pnpmCommand: string, runSignal: AbortSignal) {
  const check = checks.get(template.name);
  if (check === undefined) {
    throw new Error('No automated check defined for this template.');
  }

  const electron = check.startsWith('electron-');
  const api = check.endsWith('-api');
  const port = api ? await findFreePort() : null;
  const apiOrigin = api ? `http://localhost:${port}` : null;
  const profile = electron ? await mkdtemp(path.join(tmpdir(), 'fugi-verify-electron-')) : null;
  const env = {
    ...(apiOrigin !== null ? { PORT: String(port), VITE_API_BASE_URL: apiOrigin } : {}),
    ...(profile !== null ? { FUGI_VERIFY_ELECTRON_PROFILE: profile } : {}),
  };
  const logs: string[] = [];
  const devFailure = new AbortController();
  const signal = AbortSignal.any([runSignal, devFailure.signal]);
  const startupSignal = AbortSignal.any([signal, AbortSignal.timeout(startupTimeoutMs)]);
  const ready: { webUrl?: string; cdpUrl?: string; electronUrl?: string; api?: boolean; node?: boolean } = {};
  let dev: ReturnType<StartTemplateDev> | undefined;
  let stopping = false;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let detail;
  let failure: unknown;

  function appendLog(line: string, source = 'stdout') {
    line = stripVTControlCharacters(line).trim();
    if (line === '') return;

    logs.push(`[${source}] ${line}`);
    if (logs.length > maximumLogLines) logs.shift();
    if (stopping) return;

    if (devErrorPattern.test(line)) {
      devFailure.abort(new Error(`Dev process reported an error: ${line}`));
    }
    ready.webUrl ??= line.match(/\bLocal:\s+(http:\/\/\S+)/)?.[1];
    ready.cdpUrl ??= line.match(/\bDevTools listening on (ws:\/\/(?:127\.0\.0\.1|localhost):\d+\/\S+)/)?.[1];
    ready.electronUrl ??= line.match(/\[verify-template-dev:loaded\] (http:\/\/\S+)/)?.[1];
    if (api && line.includes(`Server is running on ${apiOrigin}`)) ready.api = true;
    if (/\b(?:Rebuilt|Build complete) in \d+ms\b/.test(line)) ready.node = true;
  }

  try {
    dev = startTemplateDev(template, env);
    for (const [source, input] of [['stdout', dev.childProcess.stdout], ['stderr', dev.childProcess.stderr]] as const) {
      readline.createInterface({ input }).on('line', (line) => appendLog(line, source));
    }
    void dev.exitPromise.then(
      ({ code, signal: exitSignal }) => {
        if (!stopping) {
          devFailure.abort(new Error(`pnpm dev exited early (${exitSignal ?? `code ${code}`}).`));
        }
      },
      (error) => devFailure.abort(error),
    );

    if (check === 'node') {
      await waitUntil(() => ready.node, 'tsdown build', startupSignal);
      const { stdout, stderr } = await execFileAsync(pnpmCommand, ['start'], {
        cwd: path.join(template.absolutePath, 'apps', 'node'),
        signal,
        timeout: actionTimeoutMs,
      });
      assert.doesNotMatch(`${stdout}\n${stderr}`, devErrorPattern);
      assert.match(stdout, /^Hello Node!$/m);
      detail = 'tsdown built and start printed Hello Node!';
    } else {
      if (apiOrigin !== null) {
        await waitUntil(() => ready.api, 'API startup', startupSignal);
        await waitUntil(async () => {
          const response = await fetch(apiOrigin, {
            signal: AbortSignal.any([startupSignal, AbortSignal.timeout(1_000)]),
          }).catch(() => null);
          await response?.body?.cancel();
          return response !== null;
        }, 'API HTTP listener', startupSignal);
      }

      if (electron) {
        await waitUntil(() => ready.cdpUrl && ready.electronUrl, 'Electron window', startupSignal);
        assert.ok(ready.cdpUrl);
        browser = await chromium.connectOverCDP(ready.cdpUrl, { timeout: actionTimeoutMs });
        page = browser.contexts()[0]?.pages().find((candidate) => candidate.url() === ready.electronUrl);
        assert.ok(page, `No Electron window loaded ${ready.electronUrl}`);
        watchPageErrors(page, devFailure);
      } else {
        await waitUntil(() => ready.webUrl, 'Vite URL', startupSignal);
        browser = await chromium.launch({ timeout: actionTimeoutMs });
        page = await browser.newPage();
        watchPageErrors(page, devFailure);
        assert.ok(ready.webUrl);
        const response = await page.goto(ready.webUrl, { timeout: actionTimeoutMs });
        assert.ok(response?.ok(), `Page navigation returned HTTP ${response?.status()}`);
      }

      signal.throwIfAborted();
      page.setDefaultTimeout(actionTimeoutMs);
      detail = api ? await verifyApi(page) : await verifyCounter(page);
    }
    signal.throwIfAborted();
  } catch (error) {
    failure = signal.aborted ? signal.reason : error;
  } finally {
    stopping = true;
    try {
      await browser?.close();
    } catch (error) {
      failure ??= error;
    }
    try {
      await dev?.stop({ appendLog });
    } catch (error) {
      failure = failure
        ? new AggregateError([failure, error], `${errorMessage(failure)}\n${errorMessage(error)}`)
        : error;
    }
    if (profile !== null) {
      await rm(profile, { recursive: true, force: true });
    }
  }

  if (failure) {
    const logTail = logs.map((line) => `    ${line}`).join('\n');
    throw new Error([errorMessage(failure), logTail].filter(Boolean).join('\n'), { cause: failure });
  }
  return detail;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function waitUntil(check: () => boolean | string | undefined | Promise<boolean>, description: string, signal: AbortSignal) {
  try {
    for (;;) {
      signal.throwIfAborted();
      if (await check()) return;
      await delay(100, undefined, { signal });
    }
  } catch (error) {
    if (signal.reason?.name === 'TimeoutError') {
      throw new Error(`Timed out waiting for ${description}.`, { cause: error });
    }
    throw signal.aborted ? signal.reason : error;
  }
}

function watchPageErrors(page: Page, failure: AbortController) {
  page.on('pageerror', (error) => failure.abort(new Error(`Uncaught page exception: ${errorMessage(error)}`)));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      failure.abort(new Error(`Page console error: ${message.text()}`));
    }
  });
  page.on('crash', () => failure.abort(new Error('Page crashed.')));
}

async function verifyCounter(page: Page) {
  await page.getByRole('button', { name: /^count is 0$/i }).click();
  await page.getByRole('button', { name: /^count is 1$/i }).waitFor();
  return 'counter changed from 0 to 1';
}

async function verifyApi(page: Page) {
  const name = 'Template Smoke Test';
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => {
      const url = new URL(candidate.url());
      return url.pathname === '/api/hello' && url.searchParams.get('name') === name;
    }),
    page.getByRole('button', { name: 'Call /api/hello', exact: true }).click(),
  ]);
  assert.equal(response.status(), 200, `GET /api/hello returned HTTP ${response.status()}`);
  await page.getByText(`Hello, ${name}!`, { exact: true }).waitFor();
  return 'GET /api/hello returned 200 and rendered the greeting';
}

async function findFreePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  assert.ok(address && typeof address === 'object');
  return address.port;
}
