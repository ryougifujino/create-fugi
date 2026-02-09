import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { c as createArchive } from 'tar';

type GithubModule = typeof import('../src/lib/github.js');
type TemplatesModule = typeof import('../src/lib/templates.js');
type FetchInput = Parameters<typeof fetch>[0];

const require = createRequire(import.meta.url);
const { downloadTemplatesDirectory } = require('../dist/lib/github.js') as Pick<
  GithubModule,
  'downloadTemplatesDirectory'
>;
const { listTemplates } = require('../dist/lib/templates.js') as Pick<
  TemplatesModule,
  'listTemplates'
>;

const REPOSITORY_API_URL = 'https://api.github.com/repos/ryougifujino/scaffolds';
const TARBALL_URL =
  'https://codeload.github.com/ryougifujino/scaffolds/tar.gz/refs/heads/main';

function toUrl(input: FetchInput): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

test('downloadTemplatesDirectory downloads archive and resolves templates folder', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'scaffolds-github-'));

  try {
    const fixtureRootDir = path.join(tempRootDir, 'fixture-repo');
    const repositoryRootDir = path.join(fixtureRootDir, 'scaffolds-main');

    await mkdir(path.join(repositoryRootDir, 'templates', 'react'), {
      recursive: true,
    });
    await mkdir(path.join(repositoryRootDir, 'templates', 'vue'), {
      recursive: true,
    });
    await writeFile(
      path.join(repositoryRootDir, 'templates', 'react', 'README.md'),
      'react',
    );
    await writeFile(
      path.join(repositoryRootDir, 'templates', 'vue', 'README.md'),
      'vue',
    );

    const archivePath = path.join(tempRootDir, 'fixture.tar.gz');
    await createArchive(
      {
        cwd: fixtureRootDir,
        file: archivePath,
        gzip: true,
      },
      ['scaffolds-main'],
    );

    const archiveBytes = await readFile(archivePath);
    const requestedUrls: string[] = [];
    const fetchMock = (async (input: FetchInput): Promise<Response> => {
      const requestUrl = toUrl(input);
      requestedUrls.push(requestUrl);

      if (requestUrl === REPOSITORY_API_URL) {
        return new Response(JSON.stringify({ default_branch: 'main' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (requestUrl === TARBALL_URL) {
        return new Response(archiveBytes, {
          status: 200,
        });
      }

      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const outputDir = path.join(tempRootDir, 'download-output');
    await mkdir(outputDir, { recursive: true });

    const { branch, templatesRootDir } = await downloadTemplatesDirectory(
      outputDir,
      fetchMock,
    );
    const templates = await listTemplates(templatesRootDir);

    assert.equal(branch, 'main');
    assert.deepEqual(
      templates.map((template) => template.name),
      ['react', 'vue'],
    );
    assert.deepEqual(requestedUrls, [REPOSITORY_API_URL, TARBALL_URL]);
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});

test('downloadTemplatesDirectory fails when templates directory is missing', async () => {
  const tempRootDir = await mkdtemp(path.join(os.tmpdir(), 'scaffolds-github-'));

  try {
    const fixtureRootDir = path.join(tempRootDir, 'fixture-repo');
    const repositoryRootDir = path.join(fixtureRootDir, 'scaffolds-main');

    await mkdir(path.join(repositoryRootDir, 'docs'), { recursive: true });
    await writeFile(path.join(repositoryRootDir, 'docs', 'README.md'), 'docs');

    const archivePath = path.join(tempRootDir, 'fixture.tar.gz');
    await createArchive(
      {
        cwd: fixtureRootDir,
        file: archivePath,
        gzip: true,
      },
      ['scaffolds-main'],
    );

    const archiveBytes = await readFile(archivePath);
    const fetchMock = (async (input: FetchInput): Promise<Response> => {
      const requestUrl = toUrl(input);

      if (requestUrl === REPOSITORY_API_URL) {
        return new Response(JSON.stringify({ default_branch: 'main' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      if (requestUrl === TARBALL_URL) {
        return new Response(archiveBytes, { status: 200 });
      }

      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const outputDir = path.join(tempRootDir, 'download-output');
    await mkdir(outputDir, { recursive: true });

    await assert.rejects(
      downloadTemplatesDirectory(outputDir, fetchMock),
      /templates directory/,
    );
  } finally {
    await rm(tempRootDir, { recursive: true, force: true });
  }
});
