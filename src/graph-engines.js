import { renderD3Graph } from './engines/d3.js';
import { renderForceGraph3D } from './engines/force-graph-3d.js';

// Register engines here using the same instance lifecycle.
/** @type {import('./graph-controller.js').GraphEngine[]} */
export const graphEngines = [
  {id: 'd3', label: 'D3 (2D)', render: renderD3Graph},
  {id: '3d-force-graph', label: '3d-force-graph (3D)', render: renderForceGraph3D}
];
