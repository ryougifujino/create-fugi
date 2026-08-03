import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from '@inquirer/testing';
import {
  PROJECT_NAME_PLACEHOLDER,
  projectNamePrompt,
  resolvePlaceholderKeystroke,
} from '../src/prompts/project-name.ts';

test('resolvePlaceholderKeystroke commits inserted prefixes only', () => {
  assert.deepEqual(
    resolvePlaceholderKeystroke({ line: `d${PROJECT_NAME_PLACEHOLDER}`, cursor: 1 }, PROJECT_NAME_PLACEHOLDER),
    { type: 'commit', text: 'd' },
  );
  assert.deepEqual(
    resolvePlaceholderKeystroke({ line: PROJECT_NAME_PLACEHOLDER, cursor: 0 }, PROJECT_NAME_PLACEHOLDER),
    { type: 'noop' },
  );
  assert.deepEqual(
    resolvePlaceholderKeystroke({ line: PROJECT_NAME_PLACEHOLDER, cursor: 3 }, PROJECT_NAME_PLACEHOLDER),
    { type: 'restore' },
  );
  assert.deepEqual(
    resolvePlaceholderKeystroke({ line: PROJECT_NAME_PLACEHOLDER.slice(1), cursor: 0 }, PROJECT_NAME_PLACEHOLDER),
    { type: 'restore' },
  );
});

test('project name prompt shows the placeholder until input replaces it', async () => {
  const { answer, events, getScreen } = await render(projectNamePrompt, { message: 'Project name' });

  assert.equal(getScreen(), `? Project name ${PROJECT_NAME_PLACEHOLDER}`);

  events.type('demo-app');
  assert.equal(getScreen(), '? Project name demo-app');

  events.keypress('enter');
  assert.equal(await answer, 'demo-app');
});

test('project name prompt restores the placeholder after deleting all input', async () => {
  const { answer, events, getScreen } = await render(projectNamePrompt, { message: 'Project name' });

  events.type('hi');
  events.keypress('backspace');
  events.keypress('backspace');
  assert.equal(getScreen(), `? Project name ${PROJECT_NAME_PLACEHOLDER}`);

  events.type('demo-app');
  events.keypress('enter');
  assert.equal(await answer, 'demo-app');
});

test('project name prompt rejects an empty submit and recovers', async () => {
  const { answer, events, getScreen } = await render(projectNamePrompt, { message: 'Project name' });

  events.keypress('enter');
  assert.equal(getScreen(), `? Project name ${PROJECT_NAME_PLACEHOLDER}\n> Project name is required.`);

  events.type('demo-app');
  assert.equal(getScreen(), '? Project name demo-app');

  events.keypress('enter');
  assert.equal(await answer, 'demo-app');
});

test('project name prompt keeps invalid input for editing after a failed submit', async () => {
  const { answer, events, getScreen } = await render(projectNamePrompt, { message: 'Project name' });

  events.type('Demo');
  events.keypress('enter');
  assert.match(getScreen(), /kebab-case/);
  assert.match(getScreen(), /Demo/);

  events.keypress('backspace');
  events.keypress('backspace');
  events.keypress('backspace');
  events.keypress('backspace');
  events.type('demo-app');
  events.keypress('enter');
  assert.equal(await answer, 'demo-app');
});

test('project name prompt accepts "." for the current directory', async () => {
  const { answer, events } = await render(projectNamePrompt, { message: 'Project name' });

  events.type('.');
  events.keypress('enter');
  assert.equal(await answer, '.');
});
