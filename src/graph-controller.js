/**
 * @typedef {Object} GraphNode
 * @property {string} id - Stable node identifier.
 * @property {string} type - Node style/type key.
 * @property {string} name - Display label.
 * @property {boolean} [impacted] - Whether the user marked this node impacted.
 * @property {boolean} [hovered] - Whether the sidebar is highlighting this node.
 *
 * @typedef {Object} GraphLink
 * @property {string} source - Source node ID, before simulation.
 * @property {string} target - Target node ID, before simulation.
 * @property {string} type - Link style/type key.
 * @property {boolean} [impacted] - Whether impact reaches this link.
 * @property {boolean} [hovered] - Whether the sidebar is highlighting this link.
 *
 * @typedef {Object} GraphRenderOptions
 * @property {HTMLElement} container - Parent for the engine's graph element.
 * @property {{nodes: GraphNode[], links: GraphLink[], style: Object}} preparedData
 *   Prepared graph; engines must copy nodes/links before simulation mutation.
 * @property {string} anchor - Selected node ID, or an empty string.
 * @property {(event: MouseEvent, node: GraphNode) => void} onNodeClick
 *   Application-owned navigation and impact handling.
 *
 * @typedef {Object} GraphInstance
 * @property {() => void} destroy - Stop timers, release resources, and remove graph DOM.
 * @property {() => void} updateImpacted - Refresh impact from prepared data in place.
 * @property {() => void} updateHovered - Refresh hover from prepared data in place.
 * @property {(held: boolean) => void} setWillImpact - Update the modifier-key cue.
 *
 * @typedef {Object} GraphEngine
 * @property {string} id - Stable selector value.
 * @property {string} label - User-visible engine name.
 * @property {(options: GraphRenderOptions) => GraphInstance} render - Mount a new graph.
 *
 * @typedef {Object} GraphController
 * @property {(id: string) => boolean} selectEngine - Select an engine and clear its predecessor.
 * @property {(options: GraphRenderOptions) => void} render - Replace the active graph.
 * @property {() => void} clear - Destroy the active graph, retaining the engine selection.
 * @property {() => void} updateImpacted - Delegate impact updates to the active graph.
 * @property {() => void} updateHovered - Delegate hover updates to the active graph.
 * @property {(held: boolean) => void} setWillImpact - Retain and apply the modifier-key cue.
 */

/**
 * Owns one graph instance across renderer changes and structural redraws.
 * Engine selection is separate from rendering so an empty dataset needs no graph.
 * @param {GraphEngine[]} engines - Available engines in selector order; must be nonempty.
 * @returns {GraphController} Lifecycle and interaction operations for the active graph.
 */
export function createGraphController(engines) {
  if (engines.length === 0) throw new Error('At least one graph engine is required.');
  const registry = new Map();
  for (const engine of engines) {
    if (registry.has(engine.id)) throw new Error(`Duplicate graph engine: ${engine.id}`);
    registry.set(engine.id, engine);
  }
  let selectedEngine = engines[0];
  let activeGraph = null;
  let modifierHeld = false;

  /**
   * Releases the current instance before another renderer can mount.
   * @returns {void}
   */
  function clear() {
    activeGraph?.destroy();
    activeGraph = null;
  }

  /**
   * Changes engines only for a distinct registered value.
   * @param {string} id - Requested engine ID.
   * @returns {boolean} Whether the selection changed and needs a render.
   */
  function selectEngine(id) {
    const nextEngine = registry.get(id);
    if (!nextEngine || nextEngine === selectedEngine) return false;
    clear();
    selectedEngine = nextEngine;
    return true;
  }

  /**
   * Replaces the graph for the current data/anchor using the selected engine.
   * @param {GraphRenderOptions} options - Shared data and interaction contract.
   * @returns {void}
   */
  function render(options) {
    clear();
    activeGraph = selectedEngine.render(options);
    activeGraph.setWillImpact(modifierHeld);
  }

  /**
   * Refreshes impact styling without replacing the graph.
   * @returns {void}
   */
  function updateImpacted() {
    activeGraph?.updateImpacted();
  }

  /**
   * Refreshes hover styling without replacing the graph.
   * @returns {void}
   */
  function updateHovered() {
    activeGraph?.updateHovered();
  }

  /**
   * Retains modifier state even while no graph is mounted.
   * @param {boolean} held - Whether Ctrl/Cmd is held.
   * @returns {void}
   */
  function setWillImpact(held) {
    modifierHeld = held;
    activeGraph?.setWillImpact(held);
  }

  return {selectEngine, render, clear, updateImpacted, updateHovered, setWillImpact};
}
