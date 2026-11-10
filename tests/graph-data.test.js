import assert from 'node:assert/strict';
import test from 'node:test';

import { copyGraphData, syncGraphFlag, linkStrength, linkDistance } from '../src/engines/graph-data.js';

test('simulation copies isolate coordinates and endpoint mutation from prepared data', () => {
  const prepared = {
    nodes: [{id: 'a', type: 'app', name: 'Alpha', impacted: true}],
    links: [{source: 'a', target: 'b', type: 'runson', hovered: true}]
  };
  const original = structuredClone(prepared);
  const graph = copyGraphData(prepared);
  graph.nodes[0].x = 42;
  graph.links[0].source = graph.nodes[0];
  graph.links[0].impacted = true;
  assert.deepEqual(prepared, original);
  assert.equal(graph.nodes[0].impacted, true);
  assert.equal(graph.links[0].hovered, true);
});

test('both engines retain linked nodes and materialize each missing endpoint once', () => {
  const graph = copyGraphData({
    nodes: [{id: 'unused'}, {id: 'a', name: 'Alpha', type: 'app'}],
    links: [{source: 'a', target: 'b'}, {source: 'b', target: 'c'}, {source: 'c', target: 'b'}]
  });
  assert.deepEqual(graph.nodes, [
    {id: 'a', name: 'Alpha', type: 'app'},
    {id: 'b', name: 'b', type: 'unknown'},
    {id: 'c', name: 'c', type: 'unknown'}
  ]);
  assert.deepEqual(copyGraphData({nodes: [{id: 'unused'}], links: []}), {nodes: [], links: []});
});

test('interaction updates match nodes by ID and retain simulation positions and endpoint objects', () => {
  const source = {id: 'a', x: 10, y: 20, z: 30};
  const target = {id: 'b', x: 40, y: 50, z: 60};
  const graph = {nodes: [source, target], links: [{source, target}]};
  const prepared = {
    nodes: [{id: 'b', impacted: true}, {id: 'a', hovered: true}],
    links: [{source: 'a', target: 'b', impacted: true, hovered: true}]
  };
  syncGraphFlag(graph, prepared, 'impacted');
  syncGraphFlag(graph, prepared, 'hovered');
  assert.equal(source.impacted, false);
  assert.equal(source.hovered, true);
  assert.equal(target.impacted, true);
  assert.equal(target.hovered, false);
  assert.deepEqual([source.x, source.y, source.z], [10, 20, 30]);
  assert.equal(graph.links[0].source, source);
  assert.equal(graph.links[0].target, target);
  assert.equal(graph.links[0].impacted, true);
  assert.equal(graph.links[0].hovered, true);
  prepared.nodes[0].impacted = false;
  prepared.links[0].impacted = false;
  syncGraphFlag(graph, prepared, 'impacted');
  assert.equal(target.impacted, false);
  assert.equal(graph.links[0].impacted, false);
});

test('missing prepared entries clear stale interaction flags', () => {
  const graph = {nodes: [{id: 'missing', impacted: true}], links: [{impacted: true}]};
  syncGraphFlag(graph, {nodes: [], links: []}, 'impacted');
  assert.equal(graph.nodes[0].impacted, false);
  assert.equal(graph.links[0].impacted, false);
});

test('link force strengths preserve impact precedence and relationship types', () => {
  assert.equal(linkStrength({type: 'default'}), 0.1);
  assert.equal(linkStrength({type: 'indirect'}), 0.01);
  assert.equal(linkStrength({type: 'runson'}), 1);
  assert.equal(linkStrength({type: 'indirect', impacted: true}), 1);
  assert.equal(linkDistance({type: 'runson'}), 5);
  assert.equal(linkDistance({type: 'default'}), 50);
  assert.equal(linkDistance({type: 'indirect'}), 50);
});
