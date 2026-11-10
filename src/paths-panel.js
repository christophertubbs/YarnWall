/**
 * Connects a nonmodal overlay panel to its persistent right-edge toggle.
 * Collapsing removes controls from keyboard navigation while retaining their state.
 * @param {HTMLElement} overlay - Wrapper containing #paths-toggle and #paths_doc.
 * @returns {void}
 */
export function initializePathsPanel(overlay) {
  const toggle = overlay.querySelector('#paths-toggle');
  const panel = overlay.querySelector('#paths_doc');
  let expanded = toggle.getAttribute('aria-expanded') !== 'false';

  /**
   * Synchronizes the visual state, accessibility state, and focus on collapse.
   * @param {boolean} nextExpanded - Whether to expose the panel.
   * @returns {void}
   */
  function setExpanded(nextExpanded) {
    if (!nextExpanded && panel.contains(panel.ownerDocument.activeElement)) toggle.focus();
    expanded = nextExpanded;
    overlay.dataset.expanded = String(expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    const label = expanded ? 'Hide paths and controls' : 'Show paths and controls';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    panel.inert = !expanded;
    panel.setAttribute('aria-hidden', String(!expanded));
  }

  /**
   * Opens or retracts the panel without changing graph or control state.
   * @returns {void}
   */
  function togglePanel() {
    setExpanded(!expanded);
  }

  /**
   * Dismisses the panel with Escape when focus is within the overlay controls.
   * @param {KeyboardEvent} event - Key pressed in the panel or its toggle.
   * @returns {void}
   */
  function handleKeydown(event) {
    if (event.key !== 'Escape' || !expanded) return;
    event.preventDefault();
    setExpanded(false);
    toggle.focus();
  }

  toggle.addEventListener('click', togglePanel);
  overlay.addEventListener('keydown', handleKeydown);
  setExpanded(expanded);
}
