import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runCli } from '../src/cli.ts'

function run(args: string[]) {
  const stdout: string[] = []
  const stderr: string[] = []
  const code = runCli(args, {
    stdout: (message: string) => stdout.push(message),
    stderr: (message: string) => stderr.push(message),
  })
  return { code, stdout, stderr }
}

test('prints help and version', () => {
  assert.match(run([]).stdout[0] ?? '', /^Usage:/)
  assert.equal(run(['--help']).code, 0)
  assert.match(run(['--version']).stdout[0] ?? '', /^\d+\.\d+\.\d+/)
})

test('runs hello with a default or explicit name', () => {
  assert.deepEqual(run(['hello']), { code: 0, stdout: ['Hello, world!'], stderr: [] })
  assert.deepEqual(run(['hello', 'Ada']), { code: 0, stdout: ['Hello, Ada!'], stderr: [] })
})

test('reports invalid commands and arguments on stderr', () => {
  for (const args of [['missing'], ['--unknown'], ['hello', 'Ada', 'extra']]) {
    const result = run(args)
    assert.equal(result.code, 1)
    assert.deepEqual(result.stdout, [])
    assert.equal(result.stderr.length, 1)
  }
})
