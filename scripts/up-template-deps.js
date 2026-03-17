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

async function readBuildTargetForDir(targetDir) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = await readPackageJsonIfExists(packageJsonPath);
  const buildScript = packageJson?.scripts?.build;

  if (typeof buildScript !== 'string' || buildScript.trim() === '') {
    return null;
  }

  const relativeDir = relativeToRepo(targetDir);

  return {
    cwd: targetDir,
    label: packageJson.name ? `${packageJson.name} (${relativeDir})` : relativeDir,
  };
}

async function readBuildPlan(templateDir) {
  const workspacePath = path.join(templateDir, 'pnpm-workspace.yaml');

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
    const sortedDirs = [...matchedDirs].sort((left, right) => left.localeCompare(right));

    for (const targetDir of sortedDirs) {
      const target = await readBuildTargetForDir(targetDir);

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

  const target = await readBuildTargetForDir(templateDir);

  return {
    strategy: 'single-package root package.json',
    targets: target ? [target] : [],
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
    totalBuildTargets: 0,
    buildSucceeded: 0,
    buildFailed: [],
    buildSkipped: [],
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
    const buildPlan = await readBuildPlan(templateDir);
    summary.totalBuildTargets += buildPlan.targets.length;

    logLine();
    logLine(`=== Template: ${relativeToRepo(templateDir)} ===`);
    logLine(`build strategy: ${buildPlan.strategy}`);
    logLine(
      buildPlan.targets.length === 0
        ? 'build targets: none'
        : `build targets: ${buildPlan.targets.map((target) => target.label).join(', ')}`,
    );

    const updateResult = await runCommand({
      cwd: templateDir,
      title: `Update dependencies for ${templateName}`,
      args: ['update', '!@types/node', '--latest', '-r'],
    });

    if (!updateResult.ok) {
      summary.updateFailed.push(templateName);
      summary.buildSkipped.push(...buildPlan.targets.map((target) => target.label));
      logLine(`Skip builds for ${templateName} because dependency update failed.`, true);
      continue;
    }

    summary.updateSucceeded += 1;

    for (const target of buildPlan.targets) {
      const buildResult = await runCommand({
        cwd: target.cwd,
        title: `Build ${target.label}`,
        args: ['build'],
      });

      if (buildResult.ok) {
        summary.buildSucceeded += 1;
      } else {
        summary.buildFailed.push(target.label);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const duration = formatDuration(Date.now() - startedAt);
  const hasFailure = summary.updateFailed.length > 0 || summary.buildFailed.length > 0;

  logLine();
  logLine('=== Summary ===');
  logLine(`templates: ${summary.totalTemplates}`);
  logLine(`updates succeeded: ${summary.updateSucceeded}`);
  logLine(`updates failed: ${summary.updateFailed.length}`);
  if (summary.updateFailed.length > 0) {
    logLine(`failed updates: ${summary.updateFailed.join(', ')}`, true);
  }
  logLine(`build targets: ${summary.totalBuildTargets}`);
  logLine(`builds succeeded: ${summary.buildSucceeded}`);
  logLine(`builds failed: ${summary.buildFailed.length}`);
  if (summary.buildFailed.length > 0) {
    logLine(`failed builds: ${summary.buildFailed.join(', ')}`, true);
  }
  logLine(`builds skipped: ${summary.buildSkipped.length}`);
  if (summary.buildSkipped.length > 0) {
    logLine(`skipped builds: ${summary.buildSkipped.join(', ')}`);
  }
  logLine(`finishedAt: ${finishedAt}`);
  logLine(`duration: ${duration}`);
  logLine();

  if (hasFailure) {
    logLine(
      `Conclusion: template dependency updates finished with failures. ${summary.updateFailed.length} update(s) failed and ${summary.buildFailed.length} build(s) failed. See ${path.basename(logFilePath)} for details.`,
      true,
    );
    return 1;
  }

  logLine(
    `Conclusion: dependency updates for ${summary.totalTemplates} template(s) and ${summary.totalBuildTargets} build task(s) completed sequentially, all succeeded.`,
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
