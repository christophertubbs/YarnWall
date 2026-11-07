import assert from 'node:assert/strict';
import test from 'node:test';

import { createGraphController } from '../src/graph-controller.js';

/**
 * Builds two observable engines without requiring a browser or simulation.
 * @returns {{engines: Object[], events: Array, options: Object}} Lifecycle test fixture.
 */
function createFixture() {
  const events = [];
  const options = {preparedData: {nodes: [], links: [], style: {}}, anchor: 'selected'};

  /**
   * Creates a renderer whose mount, cleanup, and updates are observable.
   * @param {string} id - Engine ID recorded with each event.
   * @returns {Object} Engine implementing the shared instance contract.
   */
  function createEngine(id) {
    return {
      id,
      label: id,
      render(receivedOptions) {
        events.push([id, 'render', receivedOptions]);
        return {
          destroy() { events.push([id, 'destroy']); },
          updateImpacted() { events.push([id, 'impact']); },
          updateHovered() { events.push([id, 'hover']); },
          setWillImpact(held) { events.push([id, 'modifier', held]); }
        };
      }
    };
  }

  return {engines: [createEngine('2d'), createEngine('3d')], events, options};
}

test('changing engines destroys the old graph before mounting the new graph', () => {
  const {engines, events, options} = createFixture();
  const controller = createGraphController(engines);
  controller.render(options);
  assert.equal(controller.selectEngine('3d'), true);
  assert.deepEqual(events, [
    ['2d', 'render', options],
    ['2d', 'modifier', false],
    ['2d', 'destroy']
  ]);
  controller.render(options);
  assert.deepEqual(events.slice(-2), [['3d', 'render', options], ['3d', 'modifier', false]]);
  assert.equal(events[0][2], options);
  assert.equal(events.at(-2)[2], options);
});

test('reselecting the active engine does nothing, including after a switch', () => {
  const {engines, events, options} = createFixture();
  const controller = createGraphController(engines);
  controller.render(options);
  const before = [...events];
  assert.equal(controller.selectEngine('2d'), false);
  assert.deepEqual(events, before);
  assert.equal(controller.selectEngine('3d'), true);
  controller.render(options);
  const after = [...events];
  assert.equal(controller.selectEngine('3d'), false);
  assert.deepEqual(events, after);
});

test('unknown values leave the current graph and engine intact', () => {
  const {engines, events, options} = createFixture();
  const controller = createGraphController(engines);
  controller.render(options);
  const before = [...events];
  assert.equal(controller.selectEngine('missing'), false);
  assert.deepEqual(events, before);
  controller.updateHovered();
  assert.deepEqual(events.at(-1), ['2d', 'hover']);
});

test('structural redraws destroy the previous instance and keep the selected engine', () => {
  const {engines, events, options} = createFixture();
  const controller = createGraphController(engines);
  controller.selectEngine('3d');
  controller.render(options);
  const nextOptions = {...options, anchor: 'another-node'};
  controller.render(nextOptions);
  assert.deepEqual(events.slice(-3), [
    ['3d', 'destroy'], ['3d', 'render', nextOptions], ['3d', 'modifier', false]
  ]);
});

test('interaction updates reach only the active instance without remounting', () => {
  const {engines, events, options} = createFixture();
  const controller = createGraphController(engines);
  controller.render(options);
  controller.updateImpacted();
  controller.updateHovered();
  assert.deepEqual(events.slice(-2), [['2d', 'impact'], ['2d', 'hover']]);
  controller.selectEngine('3d');
  controller.updateImpacted();
  controller.updateHovered();
  assert.deepEqual(events.at(-1), ['2d', 'destroy']);
  controller.render(options);
  controller.updateImpacted();
  controller.updateHovered();
  assert.deepEqual(events.slice(-2), [['3d', 'impact'], ['3d', 'hover']]);
});

test('clearing empty data releases resources once and retains selection and modifier state', () => {
  const {engines, events, options} = createFixture();
  const controller = createGraphController(engines);
  controller.setWillImpact(true);
  controller.selectEngine('3d');
  controller.render(options);
  assert.deepEqual(events.at(-1), ['3d', 'modifier', true]);
  controller.clear();
  controller.clear();
  controller.updateImpacted();
  controller.updateHovered();
  assert.equal(events.filter(event => event[1] === 'destroy').length, 1);
  controller.setWillImpact(false);
  controller.render(options);
  assert.deepEqual(events.slice(-2), [['3d', 'render', options], ['3d', 'modifier', false]]);
});

test('invalid registries fail before mounting a graph', () => {
  assert.throws(() => createGraphController([]), /At least one/);
  const {engines} = createFixture();
  assert.throws(() => createGraphController([engines[0], engines[0]]), /Duplicate/);
});
