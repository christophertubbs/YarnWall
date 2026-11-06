export const applicationStyleDefaults = {
  node: {
    "*": {fill: "#7f7f7f", stroke: "white", "stroke-width": 1.5, r: 5},
    host: {fill: "#1f77b4"},
    data: {fill: "#ff7f0e"},
    app: {fill: "#2ca02c"},
    infrastructure: {fill: "#d62728"},
    service: {fill: "#9467bd"},
    library: {fill: "#8c564b"},
    unknown: {fill: "#7f7f7f"}
  },
  link: {
    "*": {stroke: "#999", "stroke-width": 1.5, "marker-end": true },
    indirect: {"stroke-width": 0.5},
    runson: {"stroke-width": 3.0, "marker-end": false }
  }
};

export const styleAttributes = {
  node: ["fill", "stroke", "stroke-width", "r"],
  link: ["stroke", "stroke-width", "stroke-dasharray", "marker-end"]
};

// Style keys that aren't plain SVG attribute values and are handled by the renderer instead.
const nonAttributeStyles = new Set(["marker-end"]);

export function getEffectiveStyle(styleData, kind, type) {
  const defaults = applicationStyleDefaults[kind];
  const userStyles = styleData?.[kind] || {};
  const styles = {
    ...defaults["*"],
    ...defaults[type],
    ...userStyles["*"],
    ...userStyles[type]
  };
  return Object.fromEntries(styleAttributes[kind]
    .filter(attribute => styles[attribute] !== undefined)
    .map(attribute => [attribute, styles[attribute]]));
}

export function applyAttributes(selection, attributes) {
  for (const [attribute, value] of Object.entries(attributes)) {
    if (nonAttributeStyles.has(attribute)) continue;
    selection.attr(attribute, value);
  }
}
