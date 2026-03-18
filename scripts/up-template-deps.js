import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { glob, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const templatesDir = path.join(repoRoot, 'templates');
const logFilePath = path.join(repoRoot, 'up-template-deps-report.log');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const pnpmReporterArgs = ['--reporter=append-only'];
const verboseConsoleOutput = process.env.UP_TEMPLATE_DEPS_VERBOSE === '1';
const depsValidationScriptWhitelist = [
  'typecheck',
  'lint',
  'stylelint',
  'format:check',
  'fmt:check',
  'test',
  'build',
];

const logStream = createWriteStream(logFilePath, { flags: 'w' });

function writeConsole(chunk, useStderr = false) {
  if (useStderr) {
    process.stderr.write(chunk);
  } else {
    process.stdout.write(chunk);
  }
}

function writeLog(chunk) {
  logStream.write(chunk);
}

function logLine(message = '', useStderr = false) {
  const line = `${message}\n`;
  writeConsole(line, useStderr);
  writeLog(line);
}

function logFileLine(message = '') {
  writeLog(`${message}\n`);
}

function logBufferedOutputToConsole(output, useStderr = false) {
  if (output === '') {
    return;
  }

  writeConsole(output, useStderr);

  if (!output.endsWith('\n')) {
    writeConsole('\n', useStderr);
  }
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function relativeToRepo(targetPath) {
  return path.relative(repoRoot, targetPath) || '.';
}

async function listTemplateDirs() {
  const entries = await readdir(templatesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(templatesDir, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

function parseWorkspacePackagePatterns(workspaceContent) {
  const patterns = [];
  let inPackagesSection = false;

  for (const line of workspaceContent.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!inPackagesSection) {
      if (trimmedLine === 'packages:') {
        inPackagesSection = true;
      }

      continue;
    }

    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const match = line.match(/^\s*-\s*(.+?)\s*$/);
    if (!match) {
      continue;
    }

    let pattern = match[1].replace(/\s+#.*$/, '').trim();

    if (
      (pattern.startsWith("'") && pattern.endsWith("'")) ||
      (pattern.startsWith('"') && pattern.endsWith('"'))
    ) {
      pattern = pattern.slice(1, -1);
    }

    if (pattern !== '') {
      patterns.push(pattern);
    }
  }

  return patterns;
}

function readScriptCommands(packageJson) {
  const packageScripts = packageJson?.scripts;

  if (packageScripts === null || typeof packageScripts !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(packageScripts)
      .filter(([, command]) => typeof command === 'string' && command.trim() !== '')
      .map(([scriptName, command]) => [scriptName, command.trim()]),
  );
}

function readAvailableScripts(scriptCommands) {
  return Object.keys(scriptCommands).sort((left, right) => left.localeCompare(right));
}

function selectValidationScripts(availableScripts) {
  const availableScriptSet = new Set(availableScripts);

  return depsValidationScriptWhitelist.filter((scriptName) => availableScriptSet.has(scriptName));
}

function addScriptLabels(scriptMap, scriptNames, label) {
  for (const scriptName of scriptNames) {
    const labels = scriptMap.get(scriptName);

    if (labels) {
      labels.add(label);
      continue;
    }

    scriptMap.set(scriptName, new Set([label]));
  }
}

function addWarnings(warningSet, warnings) {
  for (const warning of warnings) {
    warningSet.add(warning);
  }
}

function sortScriptMapEntries(scriptMap) {
  return [...scriptMap.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function formatList(items) {
  return items.length === 0 ? 'none' : items.join(', ');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function normalizeWarningLine(line) {
  return stripAnsi(line).replace(/\s+/g, ' ').trim();
}

function normalizePackageWarningLine(line) {
  return normalizeWarningLine(line).replace(/^[.\s│└├─┬]+/, '').trim();
}

function stripWarnPrefix(line) {
  return line.replace(/^WARN\s*/i, '').trim();
}

function extractCommandWarnings(output) {
  const warnings = [];
  const seenWarnings = new Set();
  const lines = output.split(/\r?\n/);
  let previousNonEmptyLine = '';
  let sawPeerDependencyBanner = false;

  function pushWarning(message) {
    if (message === '' || seenWarnings.has(message)) {
      return;
    }

    seenWarnings.add(message);
    warnings.push(message);
  }

  for (const rawLine of lines) {
    const line = normalizeWarningLine(rawLine);
    if (line === '') {
      continue;
    }

    if (line.includes('Issues with peer dependencies found')) {
      sawPeerDependencyBanner = true;
    } else if (line.includes('deprecated subdependencies found')) {
      pushWarning(stripWarnPrefix(line));
    } else if (/unmet peer/i.test(line)) {
      const packageLine = normalizePackageWarningLine(previousNonEmptyLine);
      const normalizedLine = normalizePackageWarningLine(line);

      if (packageLine !== '' && packageLine !== normalizedLine) {
        pushWarning(`${packageLine} -> ${normalizedLine}`);
      } else {
        pushWarning(normalizedLine);
      }
    }

    previousNonEmptyLine = line;
  }

  if (warnings.length === 0 && sawPeerDependencyBanner) {
    pushWarning('peer dependency issues found');
  }

  return warnings;
}

function isRecursivePnpmScript(command, scriptName) {
  if (typeof command !== 'string') {
    return false;
  }

  if (!/\bpnpm\b/.test(command) || !/(^|\s)(-r|--recursive)(?=\s|$)/.test(command)) {
    return false;
  }

  const scriptPattern = new RegExp(`(?:^|\\s|["'])${escapeRegExp(scriptName)}(?:$|\\s|["'])`);
  return scriptPattern.test(command);
}

function deduplicateValidationTargets(targets) {
  if (targets.length <= 1) {
    return targets;
  }

  const [rootTarget, ...childTargets] = targets;
  const recursiveRootScripts = new Set(
    rootTarget.validationScripts.filter((scriptName) =>
      isRecursivePnpmScript(rootTarget.scriptCommands[scriptName], scriptName),
    ),
  );

  if (recursiveRootScripts.size === 0) {
    return targets;
  }

  return [
    rootTarget,
    ...childTargets.map((target) => {
      const skippedValidationScripts = target.validationScripts.filter((scriptName) =>
        recursiveRootScripts.has(scriptName),
      );

      if (skippedValidationScripts.length === 0) {
        return target;
      }

      return {
        ...target,
        validationScripts: target.validationScripts.filter(
          (scriptName) => !recursiveRootScripts.has(scriptName),
        ),
        skippedValidationScripts,
      };
    }),
  ];
}

function formatTargetValidationPlan(target) {
  const planParts = [];
  planParts.push(`selected: ${formatList(target.validationScripts)}`);

  if (target.skippedValidationScripts.length > 0) {
    planParts.push(
      `skipped as covered by recursive root script: ${target.skippedValidationScripts.join(', ')}`,
    );
  }

  return `${target.label} -> ${planParts.join(' | ')}`;
}

async function readPackageJsonIfExists(packageJsonPath) {
  try {
    const raw = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function readValidationTargetForDir(targetDir) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = await readPackageJsonIfExists(packageJsonPath);

  if (packageJson === null) {
    return null;
  }

  const scriptCommands = readScriptCommands(packageJson);
  const availableScripts = readAvailableScripts(scriptCommands);
  const validationScripts = selectValidationScripts(availableScripts);
  const relativeDir = relativeToRepo(targetDir);

  return {
    cwd: targetDir,
    label: packageJson.name ? `${packageJson.name} (${relativeDir})` : relativeDir,
    availableScripts,
    scriptCommands,
    validationScripts,
    skippedValidationScripts: [],
  };
}

async function readValidationPlan(templateDir) {
  const workspacePath = path.join(templateDir, 'pnpm-workspace.yaml');
  const rootTarget = await readValidationTargetForDir(templateDir);

  try {
    const rawWorkspaceContent = await readFile(workspacePath, 'utf8');
    const packagePatterns = parseWorkspacePackagePatterns(rawWorkspaceContent);
    const matchedDirs = new Set();

    for (const packagePattern of packagePatterns) {
      for await (const match of glob(packagePattern, { cwd: templateDir })) {
        matchedDirs.add(path.resolve(templateDir, match));
      }
    }

    const targets = [];
    if (rootTarget) {
      targets.push(rootTarget);
    }

    const sortedDirs = [...matchedDirs].sort((left, right) => left.localeCompare(right));

    for (const targetDir of sortedDirs) {
      if (targetDir === templateDir) {
        continue;
      }

      const target = await readValidationTargetForDir(targetDir);

      if (target) {
        targets.push(target);
      }
    }

    return {
      strategy:
        packagePatterns.length === 0
          ? 'workspace packages from pnpm-workspace.yaml (no package patterns found)'
          : `workspace packages from pnpm-workspace.yaml (${packagePatterns.join(', ')})`,
      targets: deduplicateValidationTargets(targets),
    };
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  return {
    strategy: 'single-package root package.json',
    targets: rootTarget ? [rootTarget] : [],
  };
}

function runCommand({ cwd, title, args }) {
  return new Promise((resolve) => {
    const commandArgs = [...pnpmReporterArgs, ...args];

    logLine();
    logLine(`>>> ${title}`);
    if (verboseConsoleOutput) {
      logLine(`cwd: ${relativeToRepo(cwd)}`);
      logLine(`cmd: ${pnpmCommand} ${commandArgs.join(' ')}`);
    } else {
      logFileLine(`cwd: ${relativeToRepo(cwd)}`);
      logFileLine(`cmd: ${pnpmCommand} ${commandArgs.join(' ')}`);
    }

    const startedAt = Date.now();
    const outputEvents = [];
    const child = spawn(pnpmCommand, commandArgs, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      outputEvents.push(text);
      writeLog(text);
      if (verboseConsoleOutput) {
        writeConsole(text, false);
      }
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      outputEvents.push(text);
      writeLog(text);
      if (verboseConsoleOutput) {
        writeConsole(text, true);
      }
    });

    child.on('error', (error) => {
      logLine(`<<< ${title} failed to start: ${error.message}`, true);
      resolve({
        ok: false,
        durationMs: Date.now() - startedAt,
        error,
        warnings: [],
      });
    });

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;
      const ok = code === 0;
      const output = outputEvents.join('');
      const warnings = extractCommandWarnings(output);
      const warningSuffix =
        warnings.length === 0 ? '' : ` (${warnings.length} high-signal warning${warnings.length === 1 ? '' : 's'})`;

      if (signal) {
        logLine(`<<< ${title} interrupted by signal ${signal} after ${formatDuration(durationMs)}`, true);
      } else if (ok) {
        logLine(`<<< ${title} succeeded in ${formatDuration(durationMs)}${warningSuffix}`);
      } else {
        logLine(
          `<<< ${title} failed with exit code ${code} in ${formatDuration(durationMs)}${warningSuffix}`,
          true,
        );
      }

      if (!verboseConsoleOutput && warnings.length > 0) {
        for (const warning of warnings) {
          logLine(`warning: ${warning}`);
        }
      }

      if (!verboseConsoleOutput && !ok && output.trim() !== '') {
        logLine(`command context: ${relativeToRepo(cwd)} -> pnpm ${commandArgs.join(' ')}`, true);
        logBufferedOutputToConsole(output, true);
      }

      resolve({
        ok,
        code,
        signal,
        durationMs,
        warnings,
      });
    });
  });
}

async function closeLogStream() {
  await new Promise((resolve, reject) => {
    logStream.end((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function main() {
  const startedAt = Date.now();
  const templateDirs = await listTemplateDirs();
  const summary = {
    totalTemplates: templateDirs.length,
    updateSucceeded: 0,
    updateFailed: [],
    totalValidationTargets: 0,
    totalValidationTasksSelected: 0,
    totalValidationTasksExecuted: 0,
    validationSucceeded: 0,
    validationFailed: [],
    validationSkipped: [],
    discoveredScripts: new Map(),
    selectedValidationScripts: new Map(),
    executedValidationScripts: new Map(),
    warningsByTemplate: new Map(),
  };

  logLine('=== up-template-deps start ===');
  logLine(`repo: ${repoRoot}`);
  logLine(`log: ${logFilePath}`);
  logLine(`startedAt: ${new Date().toISOString()}`);
  logLine(`console mode: ${verboseConsoleOutput ? 'verbose' : 'concise'}`);
  logLine(`deps validation whitelist: ${depsValidationScriptWhitelist.join(', ')}`);

  if (templateDirs.length === 0) {
    logLine();
    logLine('Conclusion: no template directories were found under templates, nothing to update.');
    return 0;
  }

  for (const templateDir of templateDirs) {
    const templateLabel = relativeToRepo(templateDir);
    const templateName = path.basename(templateDir);
    const validationPlan = await readValidationPlan(templateDir);
    const templateWarnings = new Set();
    let templateValidationSucceeded = 0;
    let templateValidationFailed = 0;

    summary.totalValidationTargets += validationPlan.targets.length;
    summary.totalValidationTasksSelected += validationPlan.targets.reduce(
      (count, target) => count + target.validationScripts.length,
      0,
    );

    for (const target of validationPlan.targets) {
      addScriptLabels(summary.discoveredScripts, target.availableScripts, target.label);
      addScriptLabels(summary.selectedValidationScripts, target.validationScripts, target.label);
    }

    logLine();
    logLine(`=== Template: ${templateLabel} ===`);
    logLine(`strategy: ${validationPlan.strategy}`);
    logLine(`targets: ${validationPlan.targets.length}`);
    logLine(
      `validation tasks selected: ${validationPlan.targets.reduce(
        (count, target) => count + target.validationScripts.length,
        0,
      )}`,
    );
    if (validationPlan.targets.length === 0) {
      logLine('selected validation scripts: none');
    } else {
      logLine('selected validation scripts:');
      for (const target of validationPlan.targets) {
        logLine(`- ${formatTargetValidationPlan(target)}`);
      }
    }

    const updateResult = await runCommand({
      cwd: templateDir,
      title: `[update] ${templateName}`,
      args: ['update', '!@types/node', '--latest', '-r'],
    });
    addWarnings(templateWarnings, updateResult.warnings);

    if (!updateResult.ok) {
      summary.updateFailed.push(templateLabel);
      summary.validationSkipped.push(
        ...validationPlan.targets.flatMap((target) =>
          target.validationScripts.map((scriptName) => `${target.label} -> ${scriptName}`),
        ),
      );

      if (templateWarnings.size > 0) {
        summary.warningsByTemplate.set(templateLabel, new Set(templateWarnings));
      }

      logLine(
        `template summary: update failed; validation tasks skipped: ${validationPlan.targets.reduce(
          (count, target) => count + target.validationScripts.length,
          0,
        )}; warnings: ${templateWarnings.size}`,
        true,
      );
      continue;
    }

    summary.updateSucceeded += 1;

    for (const target of validationPlan.targets) {
      if (target.validationScripts.length === 0) {
        logLine(`skip: ${target.label} has no selected validation scripts after deduplication.`);
        continue;
      }

      for (const scriptName of target.validationScripts) {
        summary.totalValidationTasksExecuted += 1;
        addScriptLabels(summary.executedValidationScripts, [scriptName], target.label);

        const validationResult = await runCommand({
          cwd: target.cwd,
          title: `[validate] ${scriptName} -> ${target.label}`,
          args: [scriptName],
        });
        addWarnings(templateWarnings, validationResult.warnings);

        if (validationResult.ok) {
          summary.validationSucceeded += 1;
          templateValidationSucceeded += 1;
        } else {
          const failureLabel = `${target.label} -> ${scriptName}`;
          summary.validationFailed.push(failureLabel);
          templateValidationFailed += 1;
        }
      }
    }

    if (templateWarnings.size > 0) {
      summary.warningsByTemplate.set(templateLabel, new Set(templateWarnings));
    }

    logLine(
      `template summary: update ok; validation tasks passed ${templateValidationSucceeded}/${validationPlan.targets.reduce(
        (count, target) => count + target.validationScripts.length,
        0,
      )}; failed ${templateValidationFailed}; warnings: ${templateWarnings.size}`,
      templateValidationFailed > 0,
    );
  }

  const finishedAt = new Date().toISOString();
  const duration = formatDuration(Date.now() - startedAt);
  const hasFailure = summary.updateFailed.length > 0 || summary.validationFailed.length > 0;
  const discoveredScriptEntries = sortScriptMapEntries(summary.discoveredScripts);
  const selectedValidationScriptEntries = sortScriptMapEntries(summary.selectedValidationScripts);
  const executedValidationScriptEntries = sortScriptMapEntries(summary.executedValidationScripts);
  const discoveredScriptNames = discoveredScriptEntries.map(([scriptName]) => scriptName);
  const selectedValidationScriptNames = selectedValidationScriptEntries.map(([scriptName]) => scriptName);
  const executedValidationScriptNames = executedValidationScriptEntries.map(([scriptName]) => scriptName);
  const discoveredButNotWhitelisted = discoveredScriptNames.filter(
    (scriptName) => !depsValidationScriptWhitelist.includes(scriptName),
  );
  const whitelistedButNotFound = depsValidationScriptWhitelist.filter(
    (scriptName) => !summary.selectedValidationScripts.has(scriptName),
  );
  const warningEntries = [...summary.warningsByTemplate.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  );

  logLine();
  logLine('=== Run Summary ===');
  logLine(`templates: ${summary.totalTemplates}`);
  logLine(`updates: ${summary.updateSucceeded} succeeded, ${summary.updateFailed.length} failed`);
  if (summary.updateFailed.length > 0) {
    logLine(`failed update templates: ${summary.updateFailed.join(', ')}`, true);
  }
  logLine(`validation targets: ${summary.totalValidationTargets}`);
  logLine(`validation tasks selected: ${summary.totalValidationTasksSelected}`);
  logLine(`validation tasks executed: ${summary.totalValidationTasksExecuted}`);
  logLine(`validation tasks succeeded: ${summary.validationSucceeded}`);
  logLine(`validation tasks failed: ${summary.validationFailed.length}`);
  if (summary.validationFailed.length > 0) {
    logLine(`failed validation tasks: ${summary.validationFailed.join(', ')}`, true);
  }
  logLine(`validation tasks skipped: ${summary.validationSkipped.length}`);
  if (summary.validationSkipped.length > 0) {
    logLine(`skipped validation tasks: ${summary.validationSkipped.join(', ')}`);
  }
  logLine(`templates with high-signal warnings: ${warningEntries.length}`);

  if (warningEntries.length > 0) {
    logLine();
    logLine('=== Warning Summary ===');
    for (const [templateLabel, warnings] of warningEntries) {
      logLine(`${templateLabel}:`);
      for (const warning of [...warnings].sort((left, right) => left.localeCompare(right))) {
        logLine(`- ${warning}`);
      }
    }
  }

  logLine();
  logLine('=== Script Coverage Summary ===');
  logLine(`unique discovered script names: ${discoveredScriptNames.length}`);
  logLine(`discovered script names: ${formatList(discoveredScriptNames)}`);
  logLine(`unique validation script names selected: ${selectedValidationScriptNames.length}`);
  logLine(`selected validation script names: ${formatList(selectedValidationScriptNames)}`);
  logLine(`unique validation script names executed: ${executedValidationScriptNames.length}`);
  logLine(`executed validation script names: ${formatList(executedValidationScriptNames)}`);
  for (const [scriptName, labels] of executedValidationScriptEntries) {
    const sortedLabels = [...labels].sort((left, right) => left.localeCompare(right));
    logLine(`validation coverage: ${scriptName} -> ${sortedLabels.length} package(s): ${sortedLabels.join(', ')}`);
  }
  logLine(`non-whitelisted discovered script names: ${formatList(discoveredButNotWhitelisted)}`);
  logLine(`whitelisted but absent script names: ${formatList(whitelistedButNotFound)}`);
  logLine(`full raw log: ${logFilePath}`);
  logLine(`finishedAt: ${finishedAt}`);
  logLine(`duration: ${duration}`);
  logLine();

  if (hasFailure) {
    logLine(
      `Conclusion: template dependency updates finished with failures. ${summary.updateFailed.length} update(s) failed and ${summary.validationFailed.length} validation task(s) failed. See ${path.basename(logFilePath)} for details.`,
      true,
    );
    return 1;
  }

  logLine(
    `Conclusion: dependency updates for ${summary.totalTemplates} template(s) and ${summary.totalValidationTasksExecuted} executed validation task(s) completed successfully.`,
  );
  return 0;
}

let exitCode = 1;

try {
  exitCode = await main();
} catch (error) {
  logLine();
  logLine(
    `Conclusion: an unhandled error occurred during execution: ${error instanceof Error ? error.stack ?? error.message : String(error)}`,
    true,
  );
  exitCode = 1;
}

await closeLogStream();
process.exitCode = exitCode;
