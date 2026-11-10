import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { loadDefaultSourceData } from '../src/default-data.js';

const example = JSON.parse(readFileSync(new URL('../public/data/default_data.json', import.meta.url), 'utf8'));

test('the default action requests the public default_data.json and retains metadata', async () => {
  const data = await loadDefaultSourceData(async url => {
    assert.equal(url, './data/default_data.json');
    return {ok: true, json: async () => example};
  });
  assert.equal(data, example);
  assert.equal(data.nodes_array.length, 115);
  assert.ok(data.nodes_array[0][3].description);
  assert.ok(data.links_meta[0].metadata);
});

test('HTTP failures are reported before attempting to parse an error page', async () => {
  await assert.rejects(loadDefaultSourceData(async () => ({
    ok: false,
    status: 404,
    json: async () => assert.fail('Do not parse an HTTP error as graph data')
  })), /404/);
});

test('network and JSON failures are reported to the retryable start-screen action', async () => {
  await assert.rejects(loadDefaultSourceData(async () => { throw new Error('Network unavailable'); }), /Network unavailable/);
  await assert.rejects(loadDefaultSourceData(async () => ({
    ok: true,
    json: async () => { throw new SyntaxError('Invalid JSON'); }
  })), /Invalid JSON/);
});

test('empty or malformed graphs cannot silently replace the start screen', async () => {
  for (const data of [null, [], {}, {...example, nodes_array: []}, {...example, paths: []}]) {
    await assert.rejects(loadDefaultSourceData(async () => ({ok: true, json: async () => data})), /usable source graph/);
  }
});
