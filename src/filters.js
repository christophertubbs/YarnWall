import { Liquid } from 'liquidjs';

export const liquidEngine = new Liquid();

/**
 * Lists every node type in the source data in first-appearance order, so the legend stays stable
 * regardless of the anchor or any active filter. 'unknown' is included when requested (nodes referenced
 * by links but absent from nodes_array) or when it is currently hidden.
 */
export function getAllNodeTypes(nodes_array, includeUnknown) {
  const types = [...new Set(nodes_array.map(d => d[1]))];
  if (includeUnknown && !types.includes('unknown')) types.push('unknown');
  return types;
}

/**
 * Builds the node filter list that retains every type except the hidden ones.
 * An empty list (no filtering) is returned when nothing is hidden.
 */
export function buildTypeFilters(allTypes, hiddenTypes) {
  if (hiddenTypes.size === 0) return [];
  return [{type: allTypes.filter(t => !hiddenTypes.has(t))}];
}

/**
 * Applies the specified node filters to the prepared data. If the nodeFilters array is
 * *empty*, no filters will be applied and all nodes will be retained. If not empty, only
 * nodes matching the filters will be retained.
 * 
 * Filter objects may be a simple object whose attributes must match the target, or
 * may be a LiquidJS expression string that evaluates to a boolean.
 * 
 * If merge_links is true, links will be merged to maintain connectivity after nodes
 * after nodes are filtered out. Metadata from the original links will be merged--if
 * the same metadata key exists in multiple original links, the last one encountered
 * will take precedence.
 * 
 * Side effects: Modifies prepared_data by potentially removing nodes and links that do not match the filters!
 * 
 * @param {Object} prepared_data - The prepared data containing nodes and links.
 * @param {Array} nodeFilters - The array of node filter objects to apply.
 * @param {boolean} merge_links - Whether to merge links to heal the paths broken by dropping nodes.
 */
export function applyNodeFilters(prepared_data, nodeFilters, merge_links) {
  if(merge_links === undefined) merge_links = true;
  if(!nodeFilters) nodeFilters = [];
  if(nodeFilters.length === 0) return;

  // A node is retained if it matches any one of the filters.
  const matchesFilter = (node, filter) => {
    if (typeof filter === 'string') {
      try {
        return !!liquidEngine.evalValueSync(filter, node);
      } catch (e) {
        console.warn(`Invalid node filter expression: ${filter}`, e);
        return true; // Invalid filters are no-ops!
      }
    }
    if (filter && typeof filter === 'object') {
      return Object.entries(filter).every(([k, v]) => Array.isArray(v) ? v.includes(node[k]) : node[k] === v);
    }
    return false;
  };

  const kept = new Set();
  for (const node of prepared_data.nodes) {
    if (nodeFilters.some(f => matchesFilter(node, f))) kept.add(node.id);
  }

  const originalLinks = prepared_data.links;
  prepared_data.nodes = prepared_data.nodes.filter(n => kept.has(n.id));

  // Drop filtered-out nodes from resolved paths so the sidebar and impact computation only see retained nodes.
  for (const k in prepared_data.paths) {
    const resolved = prepared_data.paths[k].paths_resolved;
    prepared_data.paths[k].paths_resolved = resolved
      .map(p => p.filter(e => typeof e !== 'string' || kept.has(e)))
      .filter(p => p.length > 0);
  }

  const linkMeta = l => { const { source, target, ...meta } = l; return meta; };
  const newLinks = [];
  const seen = new Map();
  const addLink = (source, target, meta) => {
    const key = `${source}>${target}`;
    const existing = seen.get(key);
    if (existing) {
      // Later metadata wins, but a link stays impacted if any contributing link was.
      const impacted = existing.impacted || meta.impacted;
      Object.assign(existing, meta);
      if (impacted !== undefined) existing.impacted = impacted;
      return;
    }
    const link = {source, target, ...meta};
    seen.set(key, link);
    newLinks.push(link);
  };

  const linkId = e => (typeof e === 'object' ? e.id : e);
  for (const l of originalLinks) {
    if (kept.has(linkId(l.source)) && kept.has(linkId(l.target))) {
      addLink(linkId(l.source), linkId(l.target), linkMeta(l));
    }
  }

  if (merge_links) {
    const outgoing = new Map();
    for (const l of originalLinks) {
      const s = linkId(l.source);
      if (!outgoing.has(s)) outgoing.set(s, []);
      outgoing.get(s).push(l);
    }
    // From each kept node, walk through chains of dropped nodes to the kept nodes beyond them.
    for (const start of kept) {
      for (const first of outgoing.get(start) || []) {
        if (kept.has(linkId(first.target))) continue;
        const visited = new Set();
        const stack = [{link: first, meta: linkMeta(first)}];
        while (stack.length) {
          const {link, meta} = stack.pop();
          const target = linkId(link.target);
          if (kept.has(target)) {
            if (target !== start) addLink(start, target, meta);
            continue;
          }
          if (visited.has(target)) continue;
          visited.add(target);
          for (const next of outgoing.get(target) || []) {
            const nextMeta = linkMeta(next);
            const impacted = meta.impacted || nextMeta.impacted;
            stack.push({link: next, meta: {...meta, ...nextMeta, ...(impacted !== undefined ? {impacted} : {})}});
          }
        }
      }
    }
  }

  prepared_data.links = newLinks;
}
