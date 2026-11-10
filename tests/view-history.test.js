import assert from 'node:assert/strict';
import test from 'node:test';

import { createViewHistory } from '../src/view-history.js';

const initial = {anchor: '', filterExpression: '', hiddenTypes: []};

test('Back is unavailable until the first distinct selection after the initial view', () => {
  const history = createViewHistory();
  assert.equal(history.canGoBack(), false);
  assert.equal(history.back(), null);
  history.visit(initial);
  assert.equal(history.canGoBack(), false);
  history.visit({...initial, anchor: 'node:a'});
  assert.equal(history.canGoBack(), true);
  assert.deepEqual(history.back(), initial);
  assert.equal(history.canGoBack(), false);
});

test('successive node selections unwind to the previous node and then to all paths', () => {
  const history = createViewHistory();
  history.visit(initial);
  history.visit({...initial, anchor: 'node:a'});
  history.visit({...initial, anchor: 'node:b'});
  assert.deepEqual(history.back(), {...initial, anchor: 'node:a'});
  assert.deepEqual(history.back(), initial);
  assert.equal(history.back(), null);
});

test('legend selections and expression filters restore as complete content snapshots', () => {
  const history = createViewHistory();
  const legend = {...initial, anchor: 'node:a', hiddenTypes: ['service']};
  const expression = {...initial, anchor: 'node:a', filterExpression: "type == 'class'"};
  history.visit(initial);
  history.visit(legend);
  history.visit(expression);
  assert.deepEqual(history.back(), legend);
  assert.deepEqual(history.back(), initial);
});

test('identical views and equivalent hidden-type sets do not add redundant Back steps', () => {
  const history = createViewHistory();
  history.visit(initial);
  history.visit({...initial, hiddenTypes: ['class', 'method']});
  assert.equal(history.visit({...initial, hiddenTypes: ['method', 'class', 'class']}), false);
  assert.deepEqual(history.back(), initial);
  assert.equal(history.canGoBack(), false);
});

test('redrawing a restored view does not record another history step', () => {
  const history = createViewHistory();
  history.visit(initial);
  history.visit({...initial, anchor: 'node:a'});
  const restored = history.back();
  assert.equal(history.visit(restored), false);
  assert.equal(history.canGoBack(), false);
});

test('snapshots do not retain mutable inputs or expose internal arrays to callers', () => {
  const history = createViewHistory();
  const source = {...initial, hiddenTypes: ['class']};
  history.visit(source);
  source.hiddenTypes.push('method');
  history.visit({...initial, anchor: 'node:a'});
  const restored = history.back();
  assert.deepEqual(restored.hiddenTypes, ['class']);
  restored.hiddenTypes.push('service');
  history.visit({...initial, anchor: 'node:b'});
  assert.deepEqual(history.back().hiddenTypes, ['class']);
});

test('new navigation after Back continues from the restored view', () => {
  const history = createViewHistory();
  history.visit(initial);
  history.visit({...initial, anchor: 'node:a'});
  history.visit({...initial, anchor: 'node:b'});
  history.back();
  history.visit({...initial, anchor: 'node:c'});
  assert.equal(history.back().anchor, 'node:a');
  assert.deepEqual(history.back(), initial);
});
