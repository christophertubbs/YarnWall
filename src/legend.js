import { getEffectiveStyle, applyAttributes } from './styles.js';

/**
 * Draws a node legend into the given SVG selection. Each node type gets a circle rendered with
 * its full effective style (fill, stroke, stroke-width, r), followed by the type name.
 *
 * Replaces any previous legend in the selection.
 *
 * @param {d3.Selection} svg - The SVG (or group) selection to draw the legend into.
 * @param {string[]} nodeTypes - The node types to include.
 * @param {Object} styleData - User style data (as in prepared_data.style).
 * @param {Object} [options]
 * @param {number} [options.x=10] - Left offset of the legend.
 * @param {number} [options.y=10] - Top offset of the legend.
 * @param {number} [options.rowPadding=8] - Vertical gap between rows.
 * @param {number} [options.labelGap=10] - Horizontal gap between the circle and its label.
 * @returns {d3.Selection} The legend group.
 */
export function createLegend(svg, nodeTypes, styleData, options = {}) {
  const {x = 10, y = 10, rowPadding = 8, labelGap = 10} = options;

  svg.select("g.legend").remove();
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${x},${y})`);

  const entries = nodeTypes.map(type => {
    const style = getEffectiveStyle(styleData, "node", type);
    const r = Number(style.r) || 5;
    const strokeWidth = Number(style["stroke-width"]) || 0;
    return {type, style, extent: r + strokeWidth / 2};
  });

  // Circles are centered in a column wide enough for the largest one.
  const cx = Math.max(0, ...entries.map(e => e.extent));
  let offset = 0;
  for (const {type, style, extent} of entries) {
    const row = legend.append("g")
      .attr("class", "legend-row")
      .attr("transform", `translate(0,${offset + extent})`);
    applyAttributes(row.append("circle").attr("cx", cx).attr("cy", 0), style);
    row.append("text")
      .attr("x", cx * 2 + labelGap)
      .attr("y", 0)
      .attr("dominant-baseline", "central")
      .attr("fill", "currentColor")
      .text(type);
    offset += extent * 2 + rowPadding;
  }

  return legend;
}
