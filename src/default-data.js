/**
 * Loads the public example relative to the current app location, including subdirectory hosting.
 * @param {typeof fetch} [fetchData=fetch] - Fetch implementation, replaceable for verification.
 * @returns {Promise<Object>} Parsed source graph with node/edge metadata intact.
 * @throws {Error} When the request fails or the response is not a usable source graph.
 */
export async function loadDefaultSourceData(fetchData = fetch) {
  const response = await fetchData('./data/default_data.json');
  if (!response.ok) throw new Error(`Default data request failed: ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.nodes_array) || data.nodes_array.length === 0
      || !Array.isArray(data.links_meta) || !Array.isArray(data.links_implied)
      || !data.paths || typeof data.paths !== 'object' || Array.isArray(data.paths)) {
    throw new Error('Default data is not a usable source graph.');
  }
  return data;
}
