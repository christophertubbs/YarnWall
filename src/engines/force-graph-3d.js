import ForceGraph3D from '3d-force-graph';
import { BackSide, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import SpriteText from 'three-spritetext';

import { getEffectiveStyle } from '../styles.js';
import { copyGraphData, syncGraphFlag, linkStrength, linkDistance } from './graph-data.js';

/**
 * @typedef {Object} NodeVisual
 * @property {Group} group - Rendered sphere, outline, and label.
 * @property {Mesh} sphere - Type-colored node body.
 * @property {Mesh} outline - Back-facing shell providing the stroke/impact cue.
 * @property {SpriteText} label - Camera-facing text label.
 */

/**
 * Mounts a WebGL force graph with the shared graph interaction and cleanup contract.
 * The library owns simulation copies and disposes scene objects through its destructor.
 * @param {import('../graph-controller.js').GraphRenderOptions} options - Shared engine inputs.
 * @returns {import('../graph-controller.js').GraphInstance} Updates and resource cleanup.
 */
export function renderForceGraph3D({container, preparedData, anchor, onNodeClick}) {
  const host = document.createElement('div');
  host.id = 'force-graph';
  host.className = 'force-graph-3d';
  host.setAttribute('aria-label', '3D force graph');
  container.appendChild(host);
  const graphData = copyGraphData(preparedData);
  /** @type {Map<string, NodeVisual>} */
  const visuals = new Map();
  let graph;
  let resizeObserver;
  let destroyed = false;
  let cameraFitted = false;
  let layoutTicks = 0;

  /**
   * Updates an existing node's size, colors, outline, and anchor label.
   * @param {import('../graph-controller.js').GraphNode} node - Current simulation node.
   * @param {NodeVisual} visual - Scene objects to update in place.
   * @returns {void}
   */
  function styleNode(node, visual) {
    const style = getEffectiveStyle(preparedData.style, 'node', node.type);
    const radius = Math.max(0, Number(node.hovered ? 6 : style.r) || 0);
    const strokeWidth = Math.max(0, Number(node.impacted ? 3 : style['stroke-width']) || 0);
    visual.sphere.scale.setScalar(radius);
    visual.sphere.visible = style.fill !== 'none' && radius > 0;
    if (visual.sphere.visible) visual.sphere.material.color.set(style.fill);
    visual.outline.scale.setScalar(radius + strokeWidth / 2);
    const stroke = node.impacted ? 'red' : style.stroke;
    visual.outline.visible = stroke !== 'none' && strokeWidth > 0;
    if (visual.outline.visible) visual.outline.material.color.set(stroke);
    visual.label.position.set(radius + strokeWidth + 3, 0, 0);
  }

  /**
   * Creates a labeled sphere with an outline, preserving plain-text graph labels.
   * @param {import('../graph-controller.js').GraphNode} node - Simulation node to draw.
   * @returns {Group} Custom node object used for rendering and pointer picking.
   */
  function createNodeObject(node) {
    const existing = visuals.get(node.id);
    if (existing) return existing.group;
    const group = new Group();
    const geometry = new SphereGeometry(1, 16, 12);
    const sphere = new Mesh(geometry, new MeshBasicMaterial());
    const outline = new Mesh(geometry, new MeshBasicMaterial({side: BackSide}));
    const label = new SpriteText(node.name, node.id === anchor ? 7 : 5, '#333333');
    label.fontFace = 'sans-serif';
    label.fontWeight = node.id === anchor ? 'bold' : 'normal';
    label.center.set(0, 0.5);
    // Labels must not intercept clicks intended for nearby node spheres.
    label.raycast = ignoreLabelRaycast;
    group.add(sphere, outline, label);
    const visual = {group, sphere, outline, label};
    styleNode(node, visual);
    visuals.set(node.id, visual);
    return group;
  }

  /**
   * Excludes decorative text from Three.js pointer picking.
   * @returns {void}
   */
  function ignoreLabelRaycast() {}

  /**
   * Produces a tooltip element so graph labels cannot be interpreted as HTML.
   * @param {import('../graph-controller.js').GraphNode} node - Hovered node.
   * @returns {HTMLElement} Plain-text tooltip.
   */
  function nodeLabel(node) {
    const label = document.createElement('span');
    label.textContent = node.name;
    return label;
  }

  /**
   * Maps the shared stroke style and impact state to a Three.js link color.
   * @param {import('../graph-controller.js').GraphLink} link - Link to style.
   * @returns {string} Link and arrow color.
   */
  function linkColor(link) {
    if (link.impacted) return 'red';
    return getEffectiveStyle(preparedData.style, 'link', link.type).stroke;
  }

  /**
   * Maps shared line thickness and hover emphasis to a 3D cylinder width.
   * @param {import('../graph-controller.js').GraphLink} link - Link to style.
   * @returns {number} Nonnegative link width in scene units.
   */
  function linkWidth(link) {
    const style = getEffectiveStyle(preparedData.style, 'link', link.type);
    return Math.max(0, Number(link.hovered ? 3 : style['stroke-width']) || 0);
  }

  /**
   * Hides links whose shared SVG stroke requests no visible line.
   * @param {import('../graph-controller.js').GraphLink} link - Link to evaluate.
   * @returns {boolean} Whether to draw the link.
   */
  function linkVisible(link) {
    return linkColor(link) !== 'none' && linkWidth(link) > 0;
  }

  /**
   * Converts the shared marker-end toggle to a directional cone length.
   * @param {import('../graph-controller.js').GraphLink} link - Link to evaluate.
   * @returns {number} Arrow length, or zero to omit it.
   */
  function arrowLength(link) {
    return getEffectiveStyle(preparedData.style, 'link', link.type)['marker-end'] ? 5 : 0;
  }

  /**
   * Translates the library's node-first callback to the application event-first contract.
   * @param {import('../graph-controller.js').GraphNode} node - Clicked simulation node.
   * @param {MouseEvent} event - Native click event.
   * @returns {void}
   */
  function handleNodeClick(node, event) {
    onNodeClick(event, node);
  }

  /**
   * Keeps the canvas matched to its graph area as the browser is resized.
   * @returns {void}
   */
  function resize() {
    if (destroyed) return;
    graph.width(Math.max(1, host.clientWidth)).height(Math.max(1, host.clientHeight));
  }

  /**
   * Frames the initial layout once, leaving subsequent camera movement to the user.
   * @returns {void}
   */
  function fitInitialLayout() {
    if (cameraFitted || graphData.nodes.length === 0) return;
    // Tick callbacks run before scene positions are updated; allow one rendered frame first.
    layoutTicks += 1;
    if (layoutTicks < 2) return;
    graph.scene().updateMatrixWorld(true);
    cameraFitted = true;
    graph.zoomToFit(0, 70);
  }

  /**
   * Applies interaction flags without replacing scene nodes or resetting the camera.
   * @param {'impacted'|'hovered'} flag - State to copy from prepared data.
   * @returns {void}
   */
  function restyle(flag) {
    syncGraphFlag(graphData, preparedData, flag);
    for (const node of graphData.nodes) {
      const visual = visuals.get(node.id);
      if (visual) styleNode(node, visual);
    }
    graph.linkColor(linkColor).linkWidth(linkWidth).linkDirectionalArrowColor(linkColor);
  }

  /**
   * Refreshes impact and force strength while retaining camera and node positions.
   * @returns {void}
   */
  function updateImpacted() {
    restyle('impacted');
    graph.d3Force('link').strength(linkStrength);
    graph.d3ReheatSimulation();
  }

  /**
   * Refreshes sidebar hover emphasis without reheating the simulation.
   * @returns {void}
   */
  function updateHovered() {
    restyle('hovered');
  }

  /**
   * Updates the modifier cue on the graph and its interactive canvas.
   * @param {boolean} held - Whether Ctrl/Cmd is held.
   * @returns {void}
   */
  function setWillImpact(held) {
    host.classList.toggle('will-impact', held);
  }

  /**
   * Cancels animation, disconnects sizing, releases scene/GPU resources, and removes DOM.
   * @returns {void}
   */
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    resizeObserver?.disconnect();
    if (graph) {
      const renderer = graph.renderer();
      graph._destructor();
      renderer.forceContextLoss();
    }
    visuals.clear();
    host.remove();
  }

  try {
    graph = new ForceGraph3D(host, {controlType: 'orbit'});
    graph.width(Math.max(1, host.clientWidth))
      .height(Math.max(1, host.clientHeight))
      .backgroundColor('#ffffff')
      .showNavInfo(true)
      .nodeThreeObject(createNodeObject)
      .nodeLabel(nodeLabel)
      .linkColor(linkColor)
      .linkWidth(linkWidth)
      .linkVisibility(linkVisible)
      .linkOpacity(1)
      .linkDirectionalArrowLength(arrowLength)
      .linkDirectionalArrowColor(linkColor)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick(handleNodeClick)
      .warmupTicks(60)
      .onEngineTick(fitInitialLayout)
      .graphData(graphData);
    graph.d3Force('link').distance(linkDistance).strength(linkStrength);
    graph.d3Force('charge').strength(-400);
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
  } catch (error) {
    destroy();
    throw error;
  }

  return {destroy, updateImpacted, updateHovered, setWillImpact};
}
