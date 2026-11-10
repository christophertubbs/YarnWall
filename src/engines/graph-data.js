/**
 * Copies a prepared graph for a mutating force simulation, retaining linked nodes.
 * Referenced but undeclared nodes receive the same unknown-node fallback in every engine.
 * @param {import('../graph-controller.js').GraphRenderOptions['preparedData']} preparedData
 *   Application-owned graph with string link endpoints.
 * @returns {{nodes: import('../graph-controller.js').GraphNode[], links: import('../graph-controller.js').GraphLink[]}}
 *   Independent node/link objects for the engine to mutate.
 */
export function copyGraphData(preparedData) {
  const links = [];
  const linkedIds = new Set();
  for (const link of preparedData.links) {
    links.push({...link});
    linkedIds.add(link.source);
    linkedIds.add(link.target);
  }
  const nodes = [];
  const knownIds = new Set();
  for (const node of preparedData.nodes) {
    if (!linkedIds.has(node.id)) continue;
    nodes.push({...node});
    knownIds.add(node.id);
  }
  for (const id of linkedIds) {
    if (knownIds.has(id)) continue;
    nodes.push({id, type: 'unknown', name: id});
    knownIds.add(id);
  }
  return {nodes, links};
}

/**
 * Copies an interaction flag into simulation data without replacing coordinates/endpoints.
 * @param {{nodes: Object[], links: Object[]}} graphData - Mutable simulation graph.
 * @param {{nodes: Object[], links: Object[]}} preparedData - Current application graph.
 * @param {'impacted'|'hovered'} flag - State to synchronize.
 * @returns {void}
 */
export function syncGraphFlag(graphData, preparedData, flag) {
  const byId = new Map();
  for (const node of preparedData.nodes) byId.set(node.id, node);
  for (const node of graphData.nodes) node[flag] = !!byId.get(node.id)?.[flag];
  for (const [index, link] of graphData.links.entries()) link[flag] = !!preparedData.links[index]?.[flag];
}

/**
 * Chooses a link's force strength consistently across the 2D and 3D engines.
 * @param {import('../graph-controller.js').GraphLink} link - Link to evaluate.
 * @returns {number} Link force strength.
 */
export function linkStrength(link) {
  if (link.impacted || link.type === 'runson') return 1;
  return link.type === 'indirect' ? 0.01 : 0.1;
}

/**
 * Keeps hosting relationships close while allowing other links more layout space.
 * @param {import('../graph-controller.js').GraphLink} link - Link to evaluate.
 * @returns {number} Preferred link distance in scene units.
 */
export function linkDistance(link) {
  return link.type === 'runson' ? 5 : 50;
}
