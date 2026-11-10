import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createEmptySourceData, mergeSourceData } from '../src/data.js';

const data = JSON.parse(readFileSync(new URL('../public/data/default_data.json', import.meta.url), 'utf8'));
const schema = JSON.parse(readFileSync(new URL('../public/data/default_data.schema.json', import.meta.url), 'utf8'));
const nodes = new Map(data.nodes_array.map(node => [node[0], node]));
const edges = new Map(data.links_meta.map(edge => [JSON.stringify(edge.link), edge]));

/**
 * Expands the sample's supported path branches/references while checking cycles and endpoint placement.
 * @param {string} id - Path ID to inspect.
 * @param {Set<string>} [ancestors] - References on the current expansion branch.
 * @returns {string[][]} Concrete node-ID paths.
 */
function expandPath(id, ancestors = new Set()) {
  assert.ok(data.paths[id], `Unknown path: ${id}`);
  assert.ok(!ancestors.has(id), `Circular path reference: ${id}`);
  const next = new Set(ancestors).add(id);
  const path = data.paths[id].path;
  let variants = [[]];
  for (const [index, entry] of path.entries()) {
    const alternatives = Array.isArray(entry) ? entry : [entry];
    const suffixes = [];
    for (const item of alternatives) {
      if (typeof item === 'string') {
        assert.ok(nodes.has(item), `Unknown path node: ${item}`);
        suffixes.push([item]);
      } else {
        assert.ok(index === 0 || index === path.length - 1, `Interior path reference: ${id}`);
        suffixes.push(...expandPath(item.path_id, next));
      }
    }
    variants = variants.flatMap(prefix => suffixes.map(suffix => [...prefix, ...suffix]));
  }
  return variants;
}

/**
 * Checks metadata vocabularies and synthetic provenance consistently across record kinds.
 * @param {Object} metadata - Node, edge, or path metadata.
 * @returns {void}
 */
function checkMetadata(metadata) {
  assert.equal(metadata.dataset, data._meta.id);
  assert.ok(metadata.description.length > 10);
  assert.ok(data._meta.domains[metadata.domain]);
  assert.ok(data._meta.owners[metadata.owner]);
  assert.ok(data._meta.vocabularies.layers.includes(metadata.layer));
  assert.ok(data._meta.vocabularies.classifications.includes(metadata.classification));
  assert.ok(data._meta.vocabularies.criticalities.includes(metadata.criticality));
  assert.ok(data._meta.vocabularies.lifecycles.includes(metadata.lifecycle));
  assert.equal(metadata.environment, 'demo');
  assert.ok(metadata.tags.length > 0);
  assert.equal(new Set(metadata.tags).size, metadata.tags.length);
  if (metadata.service !== null) assert.equal(nodes.get(metadata.service)?.[1], 'service');
  assert.equal(metadata.provenance.synthetic, true);
  assert.equal(metadata.provenance.verified_against_source, false);
  assert.equal(metadata.provenance.confidence, null);
}

test('sample identities, counts, and schema references remain consistent', () => {
  assert.equal(nodes.size, data.nodes_array.length, 'Duplicate node ID');
  assert.equal(edges.size, data.links_meta.length, 'Parallel endpoint pair would collapse today');
  assert.equal(new Set(data.links_meta.map(edge => edge.id)).size, data.links_meta.length);
  assert.equal(nodes.size, data._meta.counts.nodes);
  assert.equal(edges.size, data._meta.counts.relationships);
  assert.equal(Object.keys(data.paths).length, data._meta.counts.paths);
  assert.equal(Object.values(data.paths).filter(path => !path.unlisted).length, data._meta.counts.listed_paths);
  const typeCounts = {};
  for (const [, type] of data.nodes_array) typeCounts[type] = (typeCounts[type] || 0) + 1;
  assert.deepEqual(typeCounts, data._meta.counts.node_types);
  assert.equal(data.$schema, './default_data.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(data._meta.synthetic, true);
});

test('node metadata supports grouping and coherent callable ownership/source navigation', () => {
  for (const [id, type, name, metadata] of data.nodes_array) {
    assert.ok(id && name);
    assert.equal(metadata.kind, type);
    assert.ok(data.style.node[type], `Missing style for ${type}`);
    checkMetadata(metadata);
    if (metadata.source?.lines) {
      assert.ok(metadata.source.lines.start > 0);
      assert.ok(metadata.source.lines.end >= metadata.source.lines.start);
    }
    if (metadata.code) {
      const module = nodes.get(metadata.code.module);
      assert.equal(module?.[1], 'module');
      assert.equal(metadata.source.path, module[3].source.path);
      assert.ok(metadata.source.lines.start >= module[3].source.lines.start);
      assert.ok(metadata.source.lines.end <= module[3].source.lines.end);
    }
    if (type === 'method') {
      const parent = nodes.get(metadata.code.declaring_class);
      assert.equal(parent?.[1], 'class');
      assert.equal(parent[3].code.module, metadata.code.module);
      assert.ok(metadata.source.lines.start >= parent[3].source.lines.start);
      assert.ok(metadata.source.lines.end <= parent[3].source.lines.end);
      assert.equal(edges.get(JSON.stringify([parent[0], id]))?.metadata.relationship, 'declares');
    }
    if (type === 'function' || type === 'method') {
      assert.ok(metadata.code.signature);
      assert.ok(metadata.code.returns.type);
      assert.ok(Array.isArray(metadata.code.parameters));
      assert.ok(Array.isArray(metadata.code.throws));
      assert.equal(metadata.code.complexity.measured, false);
    }
    if (type === 'test') assert.ok(nodes.has(metadata.verification.target));
  }
});

test('relationships have valid endpoint/projection references and meaningful typed details', () => {
  for (const {id, link: [source, target], metadata} of data.links_meta) {
    assert.ok(nodes.has(source) && nodes.has(target), id);
    assert.notEqual(source, target, id);
    checkMetadata(metadata);
    assert.equal(metadata.kind, metadata.relationship);
    assert.equal(metadata.category, data._meta.vocabularies.relationships[metadata.relationship]);
    assert.equal(metadata.directed, true);
    for (const [prefix, endpoint] of [['source', source], ['target', target]]) {
      const [, type, , nodeMetadata] = nodes.get(endpoint);
      const expectedClass = ['class', 'interface'].includes(type) ? endpoint : nodeMetadata.code?.declaring_class || null;
      assert.equal(metadata.projection[prefix + '_class'], expectedClass);
      assert.equal(metadata.projection[prefix + '_module'], nodeMetadata.code?.module || null);
      assert.equal(metadata.projection[prefix + '_service'], nodeMetadata.service);
      for (const suffix of ['class', 'module', 'service']) {
        const reference = metadata.projection[prefix + '_' + suffix];
        if (reference !== null) assert.ok(nodes.has(reference), reference);
      }
    }
    if (metadata.relationship === 'calls') {
      assert.ok(metadata.interaction.protocol);
      assert.ok(metadata.interaction.retry_policy.max_attempts >= 1);
    }
    if (metadata.messaging) {
      assert.equal(nodes.get(metadata.messaging.event_type)?.[1], 'event');
      assert.equal(nodes.get(metadata.messaging.contract)?.[1], 'contract');
      assert.ok(metadata.messaging.routing_key);
      if (source === 'broker:events') {
        assert.equal(metadata.messaging.subscription.consumer, target);
        assert.equal(metadata.messaging.subscription.binding_key, metadata.messaging.routing_key);
      }
    }
  }
});

test('all path variants are valid, finite, and expose every declared relationship and node', () => {
  const drawnPairs = new Set();
  const drawnNodes = new Set();
  for (const [id, path] of Object.entries(data.paths)) {
    checkMetadata(path.metadata);
    for (const variant of expandPath(id)) {
      for (const node of variant) drawnNodes.add(node);
      for (let i = 1; i < variant.length; i++) {
        const key = JSON.stringify([variant[i - 1], variant[i]]);
        assert.ok(edges.has(key), `Undocumented adjacency in ${id}: ${key}`);
        drawnPairs.add(key);
      }
    }
    if (path.metadata.edge_id) {
      const edge = edges.get(JSON.stringify(path.path));
      assert.equal(edge?.id, path.metadata.edge_id);
      assert.equal(path.unlisted, true);
    }
  }
  assert.equal(drawnPairs.size, edges.size);
  assert.equal(drawnNodes.size, nodes.size);
  for (const pair of data.links_implied) assert.ok(edges.has(JSON.stringify(pair)));
});

test('event examples contain their required fields and planned views reference valid vocabularies', () => {
  for (const [, type, , metadata] of data.nodes_array) {
    if (type !== 'event') continue;
    assert.equal(nodes.get(metadata.contract.schema_id)?.[1], 'contract');
    for (const field of metadata.contract.fields) {
      if (field.required) assert.ok(Object.hasOwn(metadata.contract.example, field.name), field.name);
    }
  }
  for (const view of data._meta.planned_views) {
    assert.equal(view.status, 'design-example-only');
    for (const kind of view.node_types) assert.ok(Object.hasOwn(data._meta.counts.node_types, kind));
    for (const relation of view.relationship_kinds) assert.ok(Object.hasOwn(data._meta.vocabularies.relationships, relation));
  }
});

test('the actual source merger and JSON serialization retain node, edge, and path metadata', () => {
  const merged = mergeSourceData(createEmptySourceData(), data);
  const copied = JSON.parse(JSON.stringify(merged));
  assert.deepEqual(copied.nodes_array, data.nodes_array);
  assert.deepEqual(copied.links_meta, data.links_meta);
  assert.deepEqual(copied.paths, data.paths);
  assert.deepEqual(copied.links_implied, data.links_implied);
  assert.deepEqual(copied.style, data.style);
});
