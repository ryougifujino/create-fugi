import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

type ProjectNamePromptModule = typeof import('../src/prompts/project-name.js');

const require = createRequire(import.meta.url);
const {
  PROJECT_NAME_PLACEHOLDER,
  createProjectNamePromptState,
  getProjectNamePromptValue,
  reduceProjectNamePromptState,
  renderProjectNameInput,
} = require('../dist/prompts/project-name.js') as Pick<
  ProjectNamePromptModule,
  | 'PROJECT_NAME_PLACEHOLDER'
  | 'createProjectNamePromptState'
  | 'getProjectNamePromptValue'
  | 'reduceProjectNamePromptState'
  | 'renderProjectNameInput'
>;

test('renderProjectNameInput shows a dim kebab-case placeholder for empty input', () => {
  assert.equal(
    renderProjectNameInput('', false),
    `\u001B[2m${PROJECT_NAME_PLACEHOLDER}\u001B[0m`,
  );
});

test('renderProjectNameInput preserves entered values and clears on final empty submit', () => {
  assert.equal(renderProjectNameInput('demo-app', false), 'demo-app');
  assert.equal(renderProjectNameInput('', true), '');
});

test('project name prompt state starts with a visible placeholder and empty submitted value', () => {
  const state = createProjectNamePromptState();

  assert.equal(state.value, PROJECT_NAME_PLACEHOLDER);
  assert.equal(state.cursor, 0);
  assert.equal(state.showPlaceholder, true);
  assert.equal(getProjectNamePromptValue(state), '');
});

test('project name prompt replaces the placeholder on first input', () => {
  const state = reduceProjectNamePromptState(createProjectNamePromptState(), {
    type: 'input',
    text: 'demo-app',
  });

  assert.equal(state.value, 'demo-app');
  assert.equal(state.cursor, 'demo-app'.length);
  assert.equal(state.showPlaceholder, false);
  assert.equal(getProjectNamePromptValue(state), 'demo-app');
});

test('project name prompt edits typed values around the cursor', () => {
  const afterInput = reduceProjectNamePromptState(createProjectNamePromptState(), {
    type: 'input',
    text: 'demoapp',
  });
  const afterLeft = reduceProjectNamePromptState(afterInput, { type: 'left' });
  const afterInsert = reduceProjectNamePromptState(afterLeft, {
    type: 'input',
    text: '-',
  });
  const afterBackspace = reduceProjectNamePromptState(afterInsert, {
    type: 'backspace',
  });

  assert.equal(afterInsert.value, 'demoap-p');
  assert.equal(afterInsert.cursor, 7);
  assert.equal(afterBackspace.value, 'demoapp');
  assert.equal(afterBackspace.cursor, 6);
});

test('project name prompt shows the placeholder again after deleting all content', () => {
  const afterInput = reduceProjectNamePromptState(createProjectNamePromptState(), {
    type: 'input',
    text: 'a',
  });
  const afterBackspace = reduceProjectNamePromptState(afterInput, {
    type: 'backspace',
  });

  assert.equal(afterBackspace.value, PROJECT_NAME_PLACEHOLDER);
  assert.equal(afterBackspace.cursor, 0);
  assert.equal(afterBackspace.showPlaceholder, true);
  assert.equal(getProjectNamePromptValue(afterBackspace), '');
});
