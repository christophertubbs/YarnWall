import { renderD3Graph } from './engines/d3.js';

// Register future engines (including 3D) here using the same instance lifecycle.
/** @type {import('./graph-controller.js').GraphEngine[]} */
export const graphEngines = [
  {id: 'd3', label: 'D3 (2D)', render: renderD3Graph}
];
