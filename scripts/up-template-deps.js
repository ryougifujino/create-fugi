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

function writeOutput(chunk, useStderr = false) {
  if (useStderr) {
    process.stderr.write(chunk);
  } else {
    process.stdout.write(chunk);
  }

  logStream.write(chunk);
}

function logLine(message = '', useStderr = false) {
  writeOutput(`${message}\n`, useStderr);
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

function readAvailableScripts(packageJson) {
  const packageScripts = packageJson?.scripts;

  if (packageScripts === null || typeof packageScripts !== 'object') {
    return [];
  }

  return Object.entries(packageScripts)
    .filter(([, command]) => typeof command === 'string' && command.trim() !== '')
    .map(([scriptName]) => scriptName)
    .sort((left, right) => left.localeCompare(right));
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

function sortScriptMapEntries(scriptMap) {
  return [...scriptMap.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function formatList(items) {
  return items.length === 0 ? 'none' : items.join(', ');
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

  const availableScripts = readAvailableScripts(packageJson);
  const validationScripts = selectValidationScripts(availableScripts);
  const relativeDir = relativeToRepo(targetDir);

  return {
    cwd: targetDir,
    label: packageJson.name ? `${packageJson.name} (${relativeDir})` : relativeDir,
    availableScripts,
    validationScripts,
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
      targets,
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
    logLine();
    logLine(`>>> ${title}`);
    logLine(`cwd: ${relativeToRepo(cwd)}`);
    logLine(`cmd: ${pnpmCommand} ${args.join(' ')}`);

    const startedAt = Date.now();
    const child = spawn(pnpmCommand, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      writeOutput(chunk, false);
    });

    child.stderr.on('data', (chunk) => {
      writeOutput(chunk, true);
    });

    child.on('error', (error) => {
      logLine(`Command failed to start: ${error.message}`, true);
      resolve({
        ok: false,
        durationMs: Date.now() - startedAt,
        error,
      });
    });

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt;
      const ok = code === 0;

      if (signal) {
        logLine(`<<< ${title} interrupted by signal ${signal} after ${formatDuration(durationMs)}`, true);
      } else if (ok) {
        logLine(`<<< ${title} succeeded in ${formatDuration(durationMs)}`);
      } else {
        logLine(`<<< ${title} failed with exit code ${code} in ${formatDuration(durationMs)}`, true);
      }

      resolve({
        ok,
        code,
        signal,
        durationMs,
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
    totalValidationTasks: 0,
    validationSucceeded: 0,
    validationFailed: [],
    validationSkipped: [],
    discoveredScripts: new Map(),
    selectedValidationScripts: new Map(),
    executedValidationScripts: new Map(),
  };

  logLine('=== up-template-deps start ===');
  logLine(`repo: ${repoRoot}`);
  logLine(`log: ${logFilePath}`);
  logLine(`startedAt: ${new Date().toISOString()}`);

  if (templateDirs.length === 0) {
    logLine();
    logLine('Conclusion: no template directories were found under templates, nothing to update.');
    return 0;
  }

  for (const templateDir of templateDirs) {
    const templateName = path.basename(templateDir);
    const validationPlan = await readValidationPlan(templateDir);
    summary.totalValidationTargets += validationPlan.targets.length;
    summary.totalValidationTasks += validationPlan.targets.reduce(
      (count, target) => count + target.validationScripts.length,
      0,
    );

    for (const target of validationPlan.targets) {
      addScriptLabels(summary.discoveredScripts, target.availableScripts, target.label);
      addScriptLabels(summary.selectedValidationScripts, target.validationScripts, target.label);
    }

    logLine();
    logLine(`=== Template: ${relativeToRepo(templateDir)} ===`);
    logLine(`validation strategy: ${validationPlan.strategy}`);
    logLine(`deps validation whitelist: ${depsValidationScriptWhitelist.join(', ')}`);
    logLine(
      validationPlan.targets.length === 0
        ? 'validation targets: none'
        : `validation targets: ${validationPlan.targets
            .map((target) => `${target.label} [${formatList(target.validationScripts)}]`)
            .join('; ')}`,
    );

    const updateResult = await runCommand({
      cwd: templateDir,
      title: `Update dependencies for ${templateName}`,
      args: ['update', '!@types/node', '--latest', '-r'],
    });

    if (!updateResult.ok) {
      summary.updateFailed.push(templateName);
      summary.validationSkipped.push(
        ...validationPlan.targets.flatMap((target) =>
          target.validationScripts.map((scriptName) => `${target.label} -> ${scriptName}`),
        ),
      );
      logLine(`Skip deps validation for ${templateName} because dependency update failed.`, true);
      continue;
    }

    summary.updateSucceeded += 1;

    for (const target of validationPlan.targets) {
      if (target.validationScripts.length === 0) {
        logLine(`No whitelisted deps validation scripts found for ${target.label}.`);
        continue;
      }

      for (const scriptName of target.validationScripts) {
        addScriptLabels(summary.executedValidationScripts, [scriptName], target.label);

        const validationResult = await runCommand({
          cwd: target.cwd,
          title: `Run ${scriptName} for ${target.label}`,
          args: [scriptName],
        });

        if (validationResult.ok) {
          summary.validationSucceeded += 1;
        } else {
          summary.validationFailed.push(`${target.label} -> ${scriptName}`);
        }
      }
    }
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

  logLine();
  logLine('=== Summary ===');
  logLine(`templates: ${summary.totalTemplates}`);
  logLine(`updates succeeded: ${summary.updateSucceeded}`);
  logLine(`updates failed: ${summary.updateFailed.length}`);
  if (summary.updateFailed.length > 0) {
    logLine(`failed updates: ${summary.updateFailed.join(', ')}`, true);
  }
  logLine(`validation targets: ${summary.totalValidationTargets}`);
  logLine(`validation tasks: ${summary.totalValidationTasks}`);
  logLine(`validations succeeded: ${summary.validationSucceeded}`);
  logLine(`validations failed: ${summary.validationFailed.length}`);
  if (summary.validationFailed.length > 0) {
    logLine(`failed validations: ${summary.validationFailed.join(', ')}`, true);
  }
  logLine(`validations skipped: ${summary.validationSkipped.length}`);
  if (summary.validationSkipped.length > 0) {
    logLine(`skipped validations: ${summary.validationSkipped.join(', ')}`);
  }
  logLine();
  logLine('=== Script Summary ===');
  logLine(`deps validation whitelist: ${depsValidationScriptWhitelist.join(', ')}`);
  logLine(`discovered scripts: ${discoveredScriptNames.length}`);
  logLine(`all discovered script names: ${formatList(discoveredScriptNames)}`);
  for (const [scriptName, labels] of discoveredScriptEntries) {
    const sortedLabels = [...labels].sort((left, right) => left.localeCompare(right));
    logLine(`script "${scriptName}" found in ${sortedLabels.length} package(s): ${sortedLabels.join(', ')}`);
  }
  logLine(`deps validation scripts selected by whitelist: ${selectedValidationScriptNames.length}`);
  logLine(`validation script names selected: ${formatList(selectedValidationScriptNames)}`);
  for (const [scriptName, labels] of selectedValidationScriptEntries) {
    const sortedLabels = [...labels].sort((left, right) => left.localeCompare(right));
    logLine(
      `script "${scriptName}" selected for deps validation in ${sortedLabels.length} package(s): ${sortedLabels.join(', ')}`,
    );
  }
  logLine(`deps validation scripts executed: ${executedValidationScriptNames.length}`);
  logLine(`validation script names executed: ${formatList(executedValidationScriptNames)}`);
  for (const [scriptName, labels] of executedValidationScriptEntries) {
    const sortedLabels = [...labels].sort((left, right) => left.localeCompare(right));
    logLine(
      `script "${scriptName}" executed for deps validation in ${sortedLabels.length} package(s): ${sortedLabels.join(', ')}`,
    );
  }
  logLine(
    `discovered but not whitelisted scripts: ${formatList(discoveredButNotWhitelisted)}`,
  );
  logLine(`whitelisted but not found scripts: ${formatList(whitelistedButNotFound)}`);
  logLine(`finishedAt: ${finishedAt}`);
  logLine(`duration: ${duration}`);
  logLine();

  if (hasFailure) {
    logLine(
      `Conclusion: template dependency updates finished with failures. ${summary.updateFailed.length} update(s) failed and ${summary.validationFailed.length} deps validation task(s) failed. See ${path.basename(logFilePath)} for details.`,
      true,
    );
    return 1;
  }

  logLine(
    `Conclusion: dependency updates for ${summary.totalTemplates} template(s) and ${summary.totalValidationTasks} deps validation task(s) completed sequentially, all succeeded.`,
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
