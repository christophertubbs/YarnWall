import * as d3 from 'd3';

import { getEffectiveStyle, applyAttributes } from '../styles.js';

/**
 * Chooses the existing force strength for a link's type and impact state.
 * @param {import('../graph-controller.js').GraphLink} link - Simulation link.
 * @returns {number} Link force strength.
 */
function linkStrength(link) {
  if (link.impacted || link.type === 'runson') return 1;
  return link.type === 'indirect' ? 0.01 : 0.1;
}

/**
 * Mounts the D3 SVG force graph. Simulation mutation is confined to copied data.
 * @param {import('../graph-controller.js').GraphRenderOptions} options - Shared engine inputs.
 * @returns {import('../graph-controller.js').GraphInstance} Updates and resource cleanup.
 */
export function renderD3Graph({container, preparedData, anchor, onNodeClick}) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const userStyles = preparedData.style || {};

  /**
   * Resolves shared styles before interaction overrides.
   * @param {string} kind - Node or link style section.
   * @param {{type: string}} datum - Typed node or link.
   * @returns {Object} Effective SVG style attributes.
   */
  function getStyle(kind, datum) {
    return getEffectiveStyle(userStyles, kind, datum.type);
  }

  /**
   * Applies link impact and hover overrides to a fresh style object.
   * @param {import('../graph-controller.js').GraphLink} datum - Link to style.
   * @returns {Object} Effective link attributes.
   */
  function getLinkStyle(datum) {
    const style = getStyle('link', datum);
    if (datum.impacted) style.stroke = 'red';
    if (datum.hovered) style['stroke-width'] = 3;
    return style;
  }

  /**
   * Resolves the renderer-specific arrow marker setting.
   * @param {import('../graph-controller.js').GraphLink} datum - Link to style.
   * @returns {string|null} Arrow URL, or no marker.
   */
  function getMarkerEnd(datum) {
    return getStyle('link', datum)['marker-end']
      ? `url(${new URL(`#arrow-${datum.type}${datum.impacted ? '-red' : ''}`, location)})`
      : null;
  }

  /**
   * Applies node impact and hover overrides to a fresh style object.
   * @param {import('../graph-controller.js').GraphNode} datum - Node to style.
   * @returns {Object} Effective node attributes.
   */
  function getNodeStyle(datum) {
    const style = getStyle('node', datum);
    if (datum.impacted) {
      style.stroke = 'red';
      style['stroke-width'] = 3;
    }
    if (datum.hovered) style.r = 6;
    return style;
  }

  const links = preparedData.links.map(d => ({...d}));
  const linkedNodeIds = new Set(links.flatMap(d => [d.source, d.target]));
  const nodes = preparedData.nodes.filter(d => linkedNodeIds.has(d.id)).map(d => ({...d}));
  const existingNodeIds = new Set(nodes.map(d => d.id));
  for (const link of links) {
    for (const id of [link.source, link.target]) {
      if (existingNodeIds.has(id)) continue;
      nodes.push({id, type: 'unknown', name: id});
      existingNodeIds.add(id);
    }
  }

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => d.type === 'runson' ? 5 : 50)
      .strength(linkStrength))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('x', d3.forceX(width * 0.375).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));

  /**
   * Pins a node and reheats the simulation when dragging starts.
   * @param {Object} event - D3 drag event.
   * @param {Object} datum - Mutable simulation node.
   * @returns {void}
   */
  function dragStarted(event, datum) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    datum.fx = datum.x;
    datum.fy = datum.y;
  }

  /**
   * Moves the pinned node with the pointer.
   * @param {Object} event - D3 drag event with graph-space coordinates.
   * @param {Object} datum - Mutable simulation node.
   * @returns {void}
   */
  function dragged(event, datum) {
    datum.fx = event.x;
    datum.fy = event.y;
  }

  /**
   * Releases a dragged node and lets the simulation cool.
   * @param {Object} event - D3 drag event.
   * @param {Object} datum - Mutable simulation node.
   * @returns {void}
   */
  function dragEnded(event, datum) {
    if (!event.active) simulation.alphaTarget(0);
    datum.fx = null;
    datum.fy = null;
  }

  for (const node of nodes) {
    node.x = Math.random() * (width - width * 0.375);
    node.y = Math.random() * height;
  }

  const svg = d3.select(container).append('svg')
    .attr('id', 'force-graph')
    .attr('viewBox', [0, 0, width, height])
    .attr('width', width)
    .attr('height', height)
    .attr('style', 'max-width: 100%; height: auto; font: 12px sans-serif;');
  const graph = svg.append('g');
  const linkTypes = [...new Set(links.map(d => d.type))];
  const markers = linkTypes.flatMap(type => [{type, red: false}, {type, red: true}]);
  svg.append('defs').selectAll('marker')
    .data(markers)
    .join('marker')
    .attr('id', d => d.red ? `arrow-${d.type}-red` : `arrow-${d.type}`)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 10)
    .attr('refY', -0.5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('markerUnits', 'strokeWidth')
    .attr('orient', 'auto')
    .append('path')
    .attr('fill', d => d.red ? 'red' : getStyle('link', d).stroke)
    .attr('d', 'M0,-5L10,0L0,5');

  const link = graph.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(links)
    .join('path');
  const node = graph.append('g')
    .attr('fill', 'currentColor')
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .call(d3.drag().on('start', dragStarted).on('drag', dragged).on('end', dragEnded))
    .on('click', onNodeClick);

  node.append('circle');
  node.append('title').text(d => d.id);
  node.append('text')
    .attr('x', 8)
    .attr('y', '0.31em')
    .text(d => d.name)
    .attr('font-weight', d => d.id === anchor ? 'bold' : 'normal')
    .attr('font-size', d => d.id === anchor ? '16px' : '12px')
    .clone(true).lower()
    .attr('fill', 'none')
    .attr('stroke', 'white')
    .attr('stroke-width', 3);

  /**
   * Updates SVG positions from the simulation's node-object endpoints.
   * @returns {void}
   */
  function tick() {
    link.attr('d', d => {
      const radius = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
      return `M${d.source.x},${d.source.y} A${radius},${radius} 0 0,1 ${d.target.x},${d.target.y}`;
    });
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  }

  /**
   * Transforms the graph while leaving the SVG viewport fixed.
   * @param {Object} event - D3 zoom event.
   * @returns {void}
   */
  function zoomed(event) {
    graph.attr('transform', event.transform);
  }

  simulation.on('tick', tick);
  svg.call(d3.zoom().scaleExtent([0.1, 10]).on('zoom', zoomed));

  /**
   * Applies the current interaction styles to existing SVG elements.
   * @returns {void}
   */
  function restyle() {
    link.each(function(d) {
      applyAttributes(d3.select(this), getLinkStyle(d));
    }).attr('marker-end', getMarkerEnd);
    node.select('circle').each(function(d) {
      applyAttributes(d3.select(this), getNodeStyle(d));
    });
  }

  /**
   * Copies an interaction flag from prepared data without leaking D3 endpoints.
   * @param {'impacted'|'hovered'} flag - Interaction state to synchronize.
   * @returns {void}
   */
  function syncFlag(flag) {
    const preparedById = new Map(preparedData.nodes.map(n => [n.id, n]));
    for (const node of nodes) node[flag] = !!preparedById.get(node.id)?.[flag];
    for (const [index, link] of links.entries()) link[flag] = !!preparedData.links[index]?.[flag];
    restyle();
  }

  /**
   * Restyles impact and refreshes link forces while retaining node positions.
   * @returns {void}
   */
  function updateImpacted() {
    syncFlag('impacted');
    simulation.force('link').strength(linkStrength);
    simulation.alpha(0.1).restart();
  }

  /**
   * Restyles hover without restarting the simulation.
   * @returns {void}
   */
  function updateHovered() {
    syncFlag('hovered');
  }

  /**
   * Signals that the next node click will toggle impact.
   * @param {boolean} held - Whether Ctrl/Cmd is held.
   * @returns {void}
   */
  function setWillImpact(held) {
    svg.classed('will-impact', held);
  }

  /**
   * Stops the simulation and removes handlers and DOM before replacement.
   * @returns {void}
   */
  function destroy() {
    simulation.stop();
    simulation.on('tick', null);
    svg.interrupt();
    svg.on('.zoom', null);
    node.on('.drag', null).on('click', null);
    svg.remove();
  }

  restyle();
  return {destroy, updateImpacted, updateHovered, setWillImpact};
}
