import { getEffectiveStyle, applyAttributes } from './styles.js';

/**
 * Draws a node legend into the given SVG selection. Each node type gets a circle rendered with
 * its full effective style (fill, stroke, stroke-width, r), followed by the type name.
 *
 * Rows are clickable when onToggle is given; hidden types are drawn dimmed with a struck-through label.
 * Replaces any previous legend in the selection.
 *
 * @param {d3.Selection} svg - The SVG (or group) selection to draw the legend into.
 * @param {string[]} nodeTypes - The node types to include.
 * @param {Object} styleData - User style data (as in prepared_data.style).
 * @param {Object} [options]
 * @param {Set<string>} [options.hiddenTypes] - Types currently filtered out.
 * @param {(type: string) => void} [options.onToggle] - Called with the type when a row is clicked.
 * @param {number} [options.x=10] - Left offset of the legend.
 * @param {number} [options.y=10] - Top offset of the legend.
 * @param {number} [options.rowPadding=8] - Vertical gap between rows.
 * @param {number} [options.labelGap=10] - Horizontal gap between the circle and its label.
 * @returns {d3.Selection} The legend group.
 */
export function createLegend(svg, nodeTypes, styleData, options = {}) {
  const {hiddenTypes = new Set(), onToggle, x = 10, y = 10, rowPadding = 8, labelGap = 10} = options;

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
    const hidden = hiddenTypes.has(type);
    const row = legend.append("g")
      .attr("class", "legend-row")
      .attr("transform", `translate(0,${offset + extent})`)
      .attr("opacity", hidden ? 0.5 : 1)
      .style("cursor", onToggle ? "pointer" : null)
      .style("pointer-events", "all");
    // Transparent hit area spanning the whole row, so clicks aren't limited to the glyphs.
    const hit = row.append("rect")
      .attr("x", 0)
      .attr("y", -extent - rowPadding / 2)
      .attr("height", extent * 2 + rowPadding)
      .attr("fill", "transparent");
    applyAttributes(row.append("circle").attr("cx", cx).attr("cy", 0), style);
    const label = row.append("text")
      .attr("x", cx * 2 + labelGap)
      .attr("y", 0)
      .attr("dominant-baseline", "central")
      .attr("fill", "currentColor")
      .attr("text-decoration", hidden ? "line-through" : null)
      .text(type);
    hit.attr("width", cx * 2 + labelGap + (label.node().getComputedTextLength?.() || 0));
    if (onToggle) row.on("click", () => onToggle(type));
    offset += extent * 2 + rowPadding;
  }

  return legend;
}
