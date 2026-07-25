import { spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..');
const templatesDir = path.join(repoRoot, 'templates');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const continueKey = 'c';
const quitKey = 'q';
const stopTimeoutMs = 5_000;
const killTimeoutMs = 2_000;
const dryRunEnabled = process.argv.includes('--dry-run');
const renderIntervalMs = 80;
const maximumBufferedLogLines = 2_000;

const ansiPattern =
  // oxlint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

const color = {
  accent: chalk.cyan,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  muted: chalk.gray,
  active: chalk.bold.white,
};

async function main() {
  const templates = await listTemplates();
  const runnableTemplates = [];
  const skippedTemplates = [];

  for (const template of templates) {
    const packageJsonPath = path.join(template.absolutePath, 'package.json');
    const packageJson = await readPackageJson(packageJsonPath);
    const devCommand = readDevCommand(packageJson);

    if (devCommand === null) {
      skippedTemplates.push(template.name);
      continue;
    }

    runnableTemplates.push({
      ...template,
      devCommand,
    });
  }

  if (runnableTemplates.length === 0) {
    throw new Error(
      `No template package.json with a dev script was found under ${relativeToRepo(templatesDir)}.`,
    );
  }

  if (dryRunEnabled) {
    renderDryRun(runnableTemplates, skippedTemplates);
    return;
  }

  const restoreKeyboard = setupKeyboard();
  const dashboard = createDashboard(runnableTemplates);
  const reviewedTemplates = [];

  dashboard.start();

  try {
    for (const [index, template] of runnableTemplates.entries()) {
      const result = await reviewTemplate(
        template,
        index,
        runnableTemplates.length,
        dashboard,
      );
      reviewedTemplates.push(result);

      if (result.status === 'quit') {
        break;
      }
    }
  } finally {
    dashboard.stop();
    restoreKeyboard();
  }

  renderSummary(reviewedTemplates, skippedTemplates);
}

async function listTemplates() {
  const entries = await readdir(templatesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(templatesDir, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function readPackageJson(packageJsonPath) {
  const packageJsonContent = await readFile(packageJsonPath, 'utf-8');

  return JSON.parse(packageJsonContent);
}

function readDevCommand(packageJson) {
  const scripts = packageJson?.scripts;

  if (scripts === null || typeof scripts !== 'object') {
    return null;
  }

  return typeof scripts.dev === 'string' && scripts.dev.trim() !== ''
    ? scripts.dev.trim()
    : null;
}

function setupKeyboard() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'verify-template-dev requires an interactive TTY so it can display the dashboard and listen for key presses.',
    );
  }

  readline.emitKeypressEvents(process.stdin);

  const wasRaw = process.stdin.isRaw === true;

  process.stdin.setRawMode(true);
  process.stdin.resume();

  return () => {
    if (!wasRaw) {
      process.stdin.setRawMode(false);
    }

    process.stdin.pause();
  };
}

function createDashboard(templates) {
  const state = {
    templates: templates.map((template) => ({
      ...template,
      status: 'pending',
      detail: 'waiting',
    })),
    currentIndex: 0,
    phase: 'Starting dev server…',
    logs: [],
  };
  let renderTimer = null;
  let frame = 0;
  let active = false;

  const render = () => {
    if (!active) {
      return;
    }

    const output = renderDashboard(state, {
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
      frame,
    });
    frame += 1;
    process.stdout.write(`\u001B[H${output}\u001B[J`);
  };

  const restoreTerminal = () => {
    if (!active) {
      return;
    }

    active = false;
    process.stdout.write('\u001B[?25h\u001B[?1049l');
  };

  return {
    start() {
      active = true;
      process.stdout.write('\u001B[?1049h\u001B[?25l\u001B[2J\u001B[H');
      process.once('exit', restoreTerminal);
      process.stdout.on('resize', render);
      render();
      renderTimer = setInterval(render, renderIntervalMs);
      renderTimer.unref();
    },
    stop() {
      if (renderTimer !== null) {
        clearInterval(renderTimer);
        renderTimer = null;
      }

      process.stdout.off('resize', render);
      process.off('exit', restoreTerminal);
      restoreTerminal();
    },
    setCurrent(index, phase = 'Starting dev server…') {
      state.currentIndex = index;
      state.phase = phase;
      state.templates[index].status = 'running';
      state.templates[index].detail = 'pnpm dev';
      state.logs = [];
      render();
    },
    setPhase(phase) {
      state.phase = phase;
      render();
    },
    setTemplateResult(index, status, detail) {
      state.templates[index].status = status;
      state.templates[index].detail = detail;
      render();
    },
    appendLog(chunk, source = 'stdout') {
      const lines = sanitizeLogChunk(chunk);

      for (const line of lines) {
        state.logs.push({
          text: line,
          source,
        });
      }

      if (state.logs.length > maximumBufferedLogLines) {
        state.logs.splice(0, state.logs.length - maximumBufferedLogLines);
      }

      render();
    },
  };
}

async function reviewTemplate(template, index, total, dashboard) {
  dashboard.setCurrent(index);
  dashboard.appendLog(`$ pnpm dev  # ${relativeToRepo(template.absolutePath)}`, 'system');

  const childProcess = spawn(pnpmCommand, ['dev'], {
    cwd: template.absolutePath,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  dashboard.setPhase('Dev server running. Inspect it, then press c to continue.');

  childProcess.stdout?.on('data', (chunk) => {
    dashboard.appendLog(chunk.toString(), 'stdout');
  });

  childProcess.stderr?.on('data', (chunk) => {
    dashboard.appendLog(chunk.toString(), 'stderr');
  });

  const exitPromise = waitForChildExit(childProcess);
  const actionWaiter = createActionWaiter();
  let firstResult;

  try {
    firstResult = await Promise.race([
      exitPromise.then((exit) => ({ type: 'exit', exit })),
      actionWaiter.promise.then((action) => ({ type: 'action', action })),
    ]);
  } finally {
    actionWaiter.cancel();
  }

  if (firstResult.type === 'action') {
    if (firstResult.action === 'abort') {
      dashboard.setPhase('Stopping dev server…');
      await stopChildProcess(childProcess, exitPromise, dashboard);
      throw createAbortError();
    }

    if (firstResult.action === 'quit') {
      dashboard.setPhase('Stopping dev server…');
      await stopChildProcess(childProcess, exitPromise, dashboard);
      dashboard.setTemplateResult(index, 'quit', 'quit by user');

      return {
        templateName: template.name,
        status: 'quit',
        statusLabel: 'quit by user',
      };
    }

    dashboard.setPhase(index + 1 < total ? 'Stopping, then moving to next…' : 'Finishing review…');
    await stopChildProcess(childProcess, exitPromise, dashboard);
    dashboard.setTemplateResult(index, 'continued', 'reviewed');

    return {
      templateName: template.name,
      status: 'continued',
      statusLabel: 'reviewed and stopped',
    };
  }

  const exitLabel = formatExit(firstResult.exit);
  const exitStatus = firstResult.exit.code === 0 ? 'exited' : 'failed';
  dashboard.setTemplateResult(index, exitStatus, exitLabel);
  dashboard.setPhase(`Dev server exited ${exitLabel}. Press c to continue or q to quit.`);

  const nextActionWaiter = createActionWaiter();
  const nextAction = await nextActionWaiter.promise;
  nextActionWaiter.cancel();

  if (nextAction === 'abort') {
    throw createAbortError();
  }

  if (nextAction === 'quit') {
    dashboard.setTemplateResult(index, 'quit', `${exitLabel}; user quit`);

    return {
      templateName: template.name,
      status: 'quit',
      statusLabel: `process exited ${exitLabel}, then user quit`,
    };
  }

  return {
    templateName: template.name,
    status: 'exited',
    statusLabel: `process exited ${exitLabel}, then continued`,
  };
}

function createActionWaiter() {
  let active = true;
  let onKeypress = null;

  const promise = new Promise((resolve) => {
    onKeypress = (str, key) => {
      if (!active) {
        return;
      }

      if (key?.ctrl === true && key.name === 'c') {
        active = false;
        process.stdin.off('keypress', onKeypress);
        resolve('abort');
        return;
      }

      const pressedKey =
        typeof key?.name === 'string' && key.name !== ''
          ? key.name
          : typeof str === 'string'
            ? str
            : '';
      const normalizedKey = pressedKey.toLowerCase();

      if (normalizedKey === continueKey) {
        active = false;
        process.stdin.off('keypress', onKeypress);
        resolve('continue');
        return;
      }

      if (normalizedKey === quitKey) {
        active = false;
        process.stdin.off('keypress', onKeypress);
        resolve('quit');
      }
    };

    process.stdin.on('keypress', onKeypress);
  });

  return {
    promise,
    cancel() {
      active = false;

      if (onKeypress !== null) {
        process.stdin.off('keypress', onKeypress);
      }
    },
  };
}

function waitForChildExit(childProcess) {
  return new Promise((resolve, reject) => {
    childProcess.once('error', reject);
    childProcess.once('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function stopChildProcess(childProcess, exitPromise, dashboard) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return exitPromise;
  }

  sendSignal(childProcess, 'SIGINT');

  const gracefulExit = await raceWithTimeout(exitPromise, stopTimeoutMs);
  if (gracefulExit !== null) {
    return gracefulExit;
  }

  dashboard.appendLog(
    `Process did not exit within ${stopTimeoutMs / 1000}s. Sending SIGKILL…`,
    'system',
  );
  sendSignal(childProcess, 'SIGKILL');

  const forcedExit = await raceWithTimeout(exitPromise, killTimeoutMs);
  if (forcedExit !== null) {
    return forcedExit;
  }

  throw new Error('Failed to stop pnpm dev after SIGINT and SIGKILL.');
}

function sendSignal(childProcess, signal) {
  try {
    if (process.platform !== 'win32' && typeof childProcess.pid === 'number') {
      process.kill(-childProcess.pid, signal);
      return;
    }

    childProcess.kill(signal);
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error;
    }
  }
}

async function raceWithTimeout(promise, timeoutMs) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function renderDashboard(state, { columns, rows, frame = 0 }) {
  const width = Math.max(24, Math.min(columns, 110));
  const height = Math.max(8, rows);
  const compact = width < 52 || height < 16;

  return compact
    ? renderCompactDashboard(state, width, height, frame)
    : renderFullDashboard(state, width, height, frame);
}

function renderFullDashboard(state, width, height, frame) {
  const contentWidth = width - 4;
  const currentTemplate = state.templates[state.currentIndex];
  const maximumStatusRows = Math.max(1, height - 14);
  const visibleTemplates = state.templates.slice(0, maximumStatusRows);
  const hiddenTemplateCount = state.templates.length - visibleTemplates.length;
  const statusRowCount = visibleTemplates.length + (hiddenTemplateCount > 0 ? 1 : 0);
  const logRowCount = Math.max(1, height - statusRowCount - 10);
  const completedCount = state.templates.filter((template) =>
    ['continued', 'exited', 'failed', 'quit'].includes(template.status),
  ).length;
  const lines = [
    topBorder('create-fugi · Template Dev Review', width),
    boxRow(
      `${color.muted('Progress')}  ${formatProgressBar(completedCount, state.templates.length, 22)}  ${color.active(
        `${completedCount}/${state.templates.length}`,
      )}`,
      width,
    ),
    divider('Templates', width),
  ];

  for (const [index, template] of visibleTemplates.entries()) {
    lines.push(boxRow(formatTemplateStatus(template, index === state.currentIndex, frame), width));
  }

  if (hiddenTemplateCount > 0) {
    lines.push(boxRow(color.muted(`  … ${hiddenTemplateCount} more templates`), width));
  }

  lines.push(
    divider('Current', width),
    boxRow(
      `${color.active(currentTemplate.name)} ${color.muted(
        `· ${relativeToRepo(currentTemplate.absolutePath)}`,
      )}`,
      width,
    ),
    boxRow(
      `${color.muted('Command')}  pnpm dev  ${color.muted('·')}  ${formatPhase(state.phase, frame)}`,
      width,
    ),
    divider('Logs', width),
  );

  const visibleLogs = state.logs.slice(-logRowCount);
  const emptyLogRows = logRowCount - visibleLogs.length;

  for (let index = 0; index < emptyLogRows; index += 1) {
    lines.push(boxRow(color.muted(index === emptyLogRows - 1 ? 'Waiting for output…' : ''), width));
  }

  for (const log of visibleLogs) {
    lines.push(boxRow(formatLogLine(log, contentWidth), width));
  }

  lines.push(
    bottomBorder(width),
    fitText(
      `  ${color.accent('c')} continue / stop current    ${color.accent(
        'q',
      )} quit review    ${color.accent('Ctrl+C')} abort`,
      width,
    ),
  );

  return lines.slice(0, height).join('\n');
}

function renderCompactDashboard(state, width, height, frame) {
  const currentTemplate = state.templates[state.currentIndex];
  const completedCount = state.templates.filter((template) =>
    ['continued', 'exited', 'failed', 'quit'].includes(template.status),
  ).length;
  const logRowCount = Math.max(1, height - 7);
  const visibleLogs = state.logs.slice(-logRowCount);
  const lines = [
    topBorder('Template Dev Review', width),
    boxRow(
      `${formatProgressBar(completedCount, state.templates.length, Math.max(6, width - 18))} ${completedCount}/${
        state.templates.length
      }`,
      width,
    ),
    boxRow(`${spinner(frame)} ${color.active(currentTemplate.name)}`, width),
    boxRow(formatPhase(state.phase, frame), width),
    divider('Logs', width),
  ];

  for (const log of visibleLogs) {
    lines.push(boxRow(formatLogLine(log, width - 4), width));
  }

  while (lines.length < height - 2) {
    lines.push(boxRow('', width));
  }

  lines.push(
    bottomBorder(width),
    fitText(
      ` ${color.accent('c')} continue  ${color.accent('q')} quit  ${color.accent('Ctrl+C')} abort`,
      width,
    ),
  );

  return lines.slice(0, height).join('\n');
}

function formatTemplateStatus(template, isCurrent, frame) {
  const statusPresentation = {
    pending: {
      icon: color.muted('○'),
      label: color.muted('waiting'),
    },
    running: {
      icon: color.accent(spinner(frame)),
      label: color.accent('running'),
    },
    continued: {
      icon: color.success('✓'),
      label: color.success(template.detail),
    },
    exited: {
      icon: color.success('✓'),
      label: color.success(template.detail),
    },
    failed: {
      icon: color.error('✗'),
      label: color.error(template.detail),
    },
    quit: {
      icon: color.warning('■'),
      label: color.warning(template.detail),
    },
  }[template.status];
  const name = isCurrent ? color.active(template.name) : template.name;

  return `${statusPresentation.icon} ${padText(name, 28)} ${statusPresentation.label}`;
}

function formatPhase(phase, frame) {
  if (
    phase.startsWith('Starting') ||
    phase.startsWith('Stopping') ||
    phase.startsWith('Finishing')
  ) {
    return `${color.accent(spinner(frame))} ${phase}`;
  }

  return phase;
}

function formatLogLine(log, width) {
  if (log.source === 'stderr') {
    return color.error(fitText(log.text, width));
  }

  if (log.source === 'system') {
    return color.muted(fitText(log.text, width));
  }

  return fitText(log.text, width);
}

function renderDryRun(runnableTemplates, skippedTemplates) {
  const rows = runnableTemplates.map(
    (template, index) =>
      `${color.muted(`${String(index + 1).padStart(2)}.`)} ${color.active(
        template.name,
      )} ${color.muted('·')} ${template.devCommand}`,
  );

  if (skippedTemplates.length > 0) {
    rows.push(
      '',
      color.warning(`Skipped (no root dev script): ${skippedTemplates.join(', ')}`),
    );
  }

  renderStaticPanel('verify-template-dev · dry run', rows);
  process.stdout.write(
    `${color.muted(`Found ${runnableTemplates.length} runnable templates. No dev server was started.`)}\n`,
  );
}

function renderSummary(reviewedTemplates, skippedTemplates) {
  const rows = reviewedTemplates.map((item) => {
    const successful = item.status === 'continued' || item.status === 'exited';
    const icon = successful ? color.success('✓') : color.warning('■');
    const label = successful ? color.success(item.statusLabel) : color.warning(item.statusLabel);

    return `${icon} ${padText(item.templateName, 28)} ${label}`;
  });

  if (skippedTemplates.length > 0) {
    rows.push(
      `${color.muted('○')} ${padText('Skipped', 28)} ${color.muted(skippedTemplates.join(', '))}`,
    );
  }

  process.stdout.write('\n');
  renderStaticPanel('Template Dev Review · Summary', rows);
}

function renderStaticPanel(title, rows) {
  const availableWidth = Math.max(36, (process.stdout.columns ?? 80) - 1);
  const desiredWidth = Math.max(
    48,
    visibleLength(title) + 4,
    ...rows.map((row) => visibleLength(row) + 4),
  );
  const width = Math.min(availableWidth, desiredWidth);

  process.stdout.write(`${topBorder(title, width)}\n`);
  for (const row of rows) {
    process.stdout.write(`${boxRow(row, width)}\n`);
  }
  process.stdout.write(`${bottomBorder(width)}\n`);
}

function formatProgressBar(completed, total, width) {
  const safeTotal = Math.max(total, 1);
  const filledWidth = Math.round((completed / safeTotal) * width);
  const emptyWidth = Math.max(0, width - filledWidth);

  return `${color.accent('━'.repeat(filledWidth))}${color.muted('─'.repeat(emptyWidth))}`;
}

function topBorder(title, width) {
  const fittedTitle = fitText(` ${title} `, width - 4);
  const ruleWidth = Math.max(0, width - visibleLength(fittedTitle) - 2);

  return color.accent(`╭${fittedTitle}${'─'.repeat(ruleWidth)}╮`);
}

function divider(title, width) {
  const fittedTitle = fitText(` ${title} `, width - 4);
  const ruleWidth = Math.max(0, width - visibleLength(fittedTitle) - 2);

  return `${color.accent('├')}${color.muted(fittedTitle)}${color.accent(
    `${'─'.repeat(ruleWidth)}┤`,
  )}`;
}

function bottomBorder(width) {
  return color.accent(`╰${'─'.repeat(Math.max(0, width - 2))}╯`);
}

function boxRow(content, width) {
  return `${color.accent('│')} ${padText(content, Math.max(0, width - 4))} ${color.accent('│')}`;
}

function padText(text, width) {
  const fittedText = fitText(text, width);

  return `${fittedText}${' '.repeat(Math.max(0, width - visibleLength(fittedText)))}`;
}

function fitText(text, width) {
  if (width <= 0) {
    return '';
  }

  if (visibleLength(text) <= width) {
    return text;
  }

  return `${stripAnsi(text).slice(0, Math.max(0, width - 1))}…`;
}

function visibleLength(text) {
  return [...stripAnsi(text)].length;
}

function sanitizeLogChunk(chunk) {
  return stripAnsi(chunk)
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) =>
      // oxlint-disable-next-line no-control-regex
      line.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trimEnd(),
    )
    .filter((line) => line !== '');
}

function stripAnsi(text) {
  return String(text).replace(ansiPattern, '');
}

function spinner(frame) {
  return ['◐', '◓', '◑', '◒'][frame % 4];
}

function formatExit(exit) {
  if (exit.signal !== null) {
    return `with signal ${exit.signal}`;
  }

  return `with exit code ${exit.code ?? 0}`;
}

function relativeToRepo(targetPath) {
  return path.relative(repoRoot, targetPath) || '.';
}

function createAbortError() {
  const error = new Error('Template dev review aborted by user.');
  error.name = 'AbortError';
  return error;
}

const isDirectRun =
  typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === scriptPath;

if (isDirectRun) {
  try {
    await main();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      process.exitCode = 130;
    } else {
      process.exitCode = 1;
    }

    if (error instanceof Error) {
      process.stderr.write(`${error.message}\n`);
    } else {
      process.stderr.write(`Unexpected error: ${String(error)}\n`);
    }
  }
}

export { renderDashboard, sanitizeLogChunk, stripAnsi };
