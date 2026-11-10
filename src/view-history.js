/**
 * @typedef {Object} GraphView
 * @property {string} anchor - Selected node ID from the URL hash, or an empty string.
 * @property {string} filterExpression - Last successfully applied expression, not a draft.
 * @property {string[]} hiddenTypes - Node types hidden through the legend.
 *
 * @typedef {Object} ViewHistory
 * @property {(view: GraphView) => boolean} visit - Record a distinct content view.
 * @property {() => GraphView|null} back - Restore a previous view without recording another step.
 * @property {() => boolean} canGoBack - Whether a prior content view exists.
 */

/**
 * Copies a view and normalizes legend order without retaining mutable caller state.
 * @param {GraphView} view - Content selection to copy.
 * @returns {GraphView} Independent, consistently ordered snapshot.
 */
function copyView(view) {
  return {
    anchor: view.anchor,
    filterExpression: view.filterExpression,
    hiddenTypes: [...new Set(view.hiddenTypes)].sort()
  };
}

/**
 * Tracks content selection within this app without navigating away from the page.
 * Engine changes, layout updates, and identical selections do not add history entries.
 * @returns {ViewHistory} Content history operations.
 */
export function createViewHistory() {
  let current = null;
  const previous = [];

  /**
   * Records a distinct selection; the first view establishes the starting point.
   * @param {GraphView} view - Successfully applied content selection.
   * @returns {boolean} Whether the current view changed.
   */
  function visit(view) {
    const next = copyView(view);
    if (JSON.stringify(next) === JSON.stringify(current)) return false;
    if (current) previous.push(current);
    current = next;
    return true;
  }

  /**
   * Pops the most recent view and makes it current, returning an isolated copy.
   * @returns {GraphView|null} Previous selection, or null when already at the start.
   */
  function back() {
    if (previous.length === 0) return null;
    current = previous.pop();
    return copyView(current);
  }

  /**
   * Reports whether the Back control should be enabled.
   * @returns {boolean} Whether a prior content view is available.
   */
  function canGoBack() {
    return previous.length > 0;
  }

  return {visit, back, canGoBack};
}
