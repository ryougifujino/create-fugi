import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const tarball = process.argv[2]
assert.ok(tarball, 'Usage: node scripts/verify-npm-package.js <tarball>')

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const templates = new Map()
const trackedFiles = execFileSync('git', ['ls-files', '-z', '--', 'templates/'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
for (const file of trackedFiles.split('\0').filter(Boolean)) {
  const [, template, ...segments] = file.split('/')
  if (segments.length === 0) continue
  if (!templates.has(template)) templates.set(template, [])
  templates.get(template).push(segments.join('/'))
}
assert.ok(templates.size > 0, 'No tracked templates found.')

const tempDir = mkdtempSync(path.join(tmpdir(), 'create-fugi-package-'))
try {
  const installDir = path.join(tempDir, 'install')
  const projectsDir = path.join(tempDir, 'projects')
  mkdirSync(installDir)
  mkdirSync(projectsDir)
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      path.join(tempDir, 'npm-cache'),
      path.resolve(tarball),
    ],
    { cwd: installDir, stdio: 'inherit' },
  )
  const cli = path.join(installDir, 'node_modules', '.bin', 'create-fugi')
  const { version } = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  assert.equal(execFileSync(cli, ['--version'], { cwd: projectsDir, encoding: 'utf8' }).trim(), version)

  for (const [template, files] of templates) {
    const projectName = `smoke-${template}`
    const projectDir = path.join(projectsDir, projectName)
    execFileSync(cli, [projectName, '--template', template], { cwd: projectsDir, stdio: 'inherit' })

    for (const file of files) {
      const info = statSync(path.join(projectDir, file), { throwIfNoEntry: false })
      assert.ok(info?.isFile(), `${template}: missing ${file}`)
    }
    const manifest = JSON.parse(readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
    assert.equal(manifest.name, projectName, `${template}: incorrect package name`)
    assert.deepEqual(
      readFileSync(path.join(projectDir, '.gitignore')),
      readFileSync(path.join(repoRoot, 'templates', template, '.gitignore')),
      `${template}: .gitignore differs from the template`,
    )
  }
  console.log(`Verified ${templates.size} templates from ${path.basename(tarball)}.`)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
