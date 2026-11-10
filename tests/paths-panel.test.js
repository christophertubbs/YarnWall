import assert from 'node:assert/strict';
import test from 'node:test';

import { initializePathsPanel } from '../src/paths-panel.js';

/**
 * Supplies only the DOM behavior needed to check visibility, focus, and input retention.
 * @param {boolean} [expanded=true] - Initial HTML expansion state.
 * @returns {Object} Overlay fixture and its focusable controls.
 */
function createFixture(expanded = true) {
  const ownerDocument = {activeElement: null};
  const filter = {value: "type == 'class'"};

  /**
   * Creates an observable attribute/event target.
   * @returns {Object} Minimal DOM target.
   */
  function createElement() {
    const attributes = new Map();
    const listeners = new Map();
    return {
      ownerDocument,
      dataset: {},
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      addEventListener(name, listener) { listeners.set(name, listener); },
      dispatch(name, event) { listeners.get(name)?.(event); },
      focus() { ownerDocument.activeElement = this; }
    };
  }

  const toggle = createElement();
  toggle.setAttribute('aria-expanded', String(expanded));
  const panel = createElement();
  panel.contains = element => element === filter;
  const overlay = createElement();
  overlay.querySelector = selector => selector === '#paths-toggle' ? toggle : panel;
  initializePathsPanel(overlay);
  return {overlay, toggle, panel, filter, ownerDocument};
}

test('an open panel exposes its controls and announces the collapse action', () => {
  const {overlay, toggle, panel} = createFixture();
  assert.equal(overlay.dataset.expanded, 'true');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-label'), 'Hide paths and controls');
  assert.equal(panel.getAttribute('aria-hidden'), 'false');
  assert.equal(panel.inert, false);
});

test('collapse removes hidden controls from navigation and reopening retains their values', () => {
  const {overlay, toggle, panel, filter} = createFixture();
  toggle.dispatch('click');
  assert.equal(overlay.dataset.expanded, 'false');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-label'), 'Show paths and controls');
  assert.equal(panel.getAttribute('aria-hidden'), 'true');
  assert.equal(panel.inert, true);
  toggle.dispatch('click');
  assert.equal(overlay.dataset.expanded, 'true');
  assert.equal(panel.inert, false);
  assert.equal(filter.value, "type == 'class'");
});

test('Escape dismisses a focused panel and restores focus to its persistent toggle', () => {
  const {overlay, toggle, panel, filter, ownerDocument} = createFixture();
  ownerDocument.activeElement = filter;
  let prevented = false;
  overlay.dispatch('keydown', {key: 'Escape', preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(panel.inert, true);
  assert.equal(ownerDocument.activeElement, toggle);
});

test('unrelated keys and Escape on an already closed panel are left alone', () => {
  const {overlay, toggle} = createFixture();
  const preventDefault = () => assert.fail('Unrelated key should not be consumed');
  overlay.dispatch('keydown', {key: 'Enter', preventDefault});
  assert.equal(overlay.dataset.expanded, 'true');
  toggle.dispatch('click');
  overlay.dispatch('keydown', {key: 'Escape', preventDefault});
  assert.equal(overlay.dataset.expanded, 'false');
});

test('initially collapsed markup stays hidden until explicitly opened', () => {
  const {overlay, toggle, panel} = createFixture(false);
  assert.equal(panel.inert, true);
  assert.equal(overlay.dataset.expanded, 'false');
  toggle.dispatch('click');
  assert.equal(panel.inert, false);
  assert.equal(overlay.dataset.expanded, 'true');
});
