export function createEmptySourceData() {
  return {
    nodes_array: [],
    links_meta: [],
    links_implied: [],
    paths: {},
    style: {
      node: {},
      link: {}
    },
  };
}

/**
 * Merges a parsed data file into source_data in place. Arrays are concatenated; paths and per-kind
 * styles are merged by key, with later data taking precedence. Missing top-level keys on source_data
 * are created, so this also works on an empty or partial data set.
 * The `files` key is not handled here, since resolving it requires a base URL.
 */
export function mergeSourceData(source_data, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return source_data;

  for (const key of ['nodes_array', 'links_meta', 'links_implied']) {
    if (Array.isArray(data[key])) {
      source_data[key] = (source_data[key] || []).concat(data[key]);
    }
  }

  if (data.paths && typeof data.paths === 'object') {
    source_data.paths = Object.assign(source_data.paths || {}, data.paths);
  }

  if (data.style && typeof data.style === 'object') {
    source_data.style ||= {};
    for (const kind of ['node', 'link']) {
      if (data.style[kind] && typeof data.style[kind] === 'object') {
        source_data.style[kind] = Object.assign(source_data.style[kind] || {}, data.style[kind]);
      }
    }
  }
  return source_data;
}
