
# YarnWall

YarnWall is a browser-based tool for documenting and visualizing data flows at a level suitable for agile project work. It shows systems and data as a node-and-link diagram, alongside the described paths. The model is intentionally lightweight so teams can maintain it without cataloguing every system relationship.

Conceptually, a system is documented as a set of nodes and paths (sequencces of links between nodes). The intent is that paths denote the direction of data flowing through a system, and the inverse direction of the path can (usually) be inferred to be a dependency relationship--but you may find other ways to represent your system structure (whatever the representation, a consistent approach to recording relationships should be applied to the whole recorded structure). The goal is to produce a "good enough" operational picture of data flow and dependencies for high- to medium-level troubleshooting and developer familiarization. Cyclical relationships are possible, so the multi-link path is intended to represent the important proximate relationships to any node, rather than all downstream or upstream links and nodes.

YarnWall is a standalone JavaScript application built with Vite and D3.js. It is at an early prototype stage (package version 0.0.1); no production or demo instance is currently available. The data-flow model in stored in editable JSON files for rendering directly in the browser, rather than requiring a separate modeling service or database.

## Usage

The displayed diagram shows nodes and directional links derived from the configured paths and implied links. Node color indicates its type. The panel on the right lists the paths included in the data and links each path's node names to the corresponding diagram node.

- Drag nodes to adjust the layout.
- Use the scroll wheel to zoom the diagram.
- Click a node to focus the view on paths containing that node. The selected node is highlighted and only paths in which that node appears are shown.
- Use the home link in the path panel to clear the selected node.
- Ctrl+Click a node to mark it as "impacted", and downstream path segments including the node will be highlighted in red.
- Click a legend entry to hide that node type (paths connected to hidden nodes are spliced together to retain connectivity). Hidden types stay in the legend, dimmed and struck through; click again to show them.
- Drag and drop one or more JSON data files onto the window to load them (see below).

To document a flow, add its nodes and a path to a JSON data file, then load that file using the `input` parameter, or drop it onto the window. Use the example data in  `default_data.json` as a reference.

### Drag-and-drop loading

Any JSON file dropped on the window is merged into the data currently displayed, as if it had been listed in a `files` array. Several files can be dropped at once. By default (with no provided `input` URL parameter), the page starts empty and allows you to drop files into it to start from scratch.

Notes:
 - Files that are not valid JSON are skipped.
 - A dropped file's own `files` entries are not followed (there is no location to resolve relative paths against)
 - Dropping the same file (or another file with the same data) twice will duplicate its node and link entries--this is the same as happens if including via `files` entries.

## Dependencies

For use:

- Any modern browser

For building self-contained YarnWall charts or for development:

- Node.js 20+ and npm
  - D3.js
  - LiquidJS

The application does not require a database or other server-side service.

## Installation

Clone the repository, install its dependencies, and start the Vite development server:

```sh
git clone https://github.com/mattw-nws/YarnWall.git
cd YarnWall
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`; the static site is written to `dist/`. To serve that build locally, run `npm run preview`.

## Configuration

An example diagram is defined in [public/data/example_data.json](public/data/example_data.json). To this dataset, when running the Vite dev server, set the `input` query parameter to './data/example_data.json'. You can place other data files in in `public/data/` and go to e.g. `index.html?input=./data/myfile.json`. You can also drag example_data.json or other properly formatted JSON documents onto the YarnWall browser window to load data into the diagram.

Each JSON data file may contain:

- `paths`: An Object (dictionary) of named flow descriptions. This is the core entity in the data. See notes below on desiging and choosing paths. Each path includes:
  - `path`: An ordered array of node IDs. A path segment may be:
    - A single node ID (a string)
    - An array of node IDs, which represents a set of similar nodes at that point in the path (for example, multiple similar data artifacts generated at that point)
    - An object including a `path_id` (or an array of such objects), which allows referencing another path, for reusing or chaining paths.
  - `name` (optional): A human-readable name for the path. The ID of the path (its key in the object) will be used if this is omitted.
  - `comment` (optional): A small text string that adds extra information about the path. Usually, this should not simply restate the information represented by the path itself, but is intended to give extra context about the path, or caveats about its behavior.
  - `unlisted` (optional): If `true` (defaults to `false`), keeps a path out of the sidebar list while its links are still drawn and still count when a node is selected or marked as impacted; this is especially useful for component supaths that are mainly meant to be included in other paths (via the `path_id` mechanism described above).

- `nodes_array`: arrays of `[id, type, name]`. The display name is optional; the ID is used if it is omitted. Built-in types with default colors are 'app', 'service', 'infrastructure', 'data', 'library', and 'host'; any other type string is allowed and can be given its own `style`.
- `links_meta`: objects with a `link` pair of node IDs and a `type`. Currently supported types are:
  - `runson` - Denotes a tighter coupling and is currently represented by a shorter, thicker line rendering for the link, with no arrowhead
  - `indirect` - Denotes a less direct relationship, drawn as a thinner line
- `links_implied`: pairs of node IDs where the first item should always appear in the diagram whenever the second item in the pair is present; this is useful for critical dependencies that should always be shown for a node but do not directly appear in many/any paths.
- `files`: an array of other JSON files to combine; this allows modular recording of structures and alternative top-level aggregations of subgraphs.
  - NOTE: Relative file paths are fetched relative to the file in which they appear.
- `style`: visual styling for nodes and links (see below).

When using multiple files, IDs used in paths must be kept consistent across files for nodes shared between data files, and node IDs must be unique across data files that may be included together.

Paths can contain node IDs that are omitted from `nodes_array`; they will be displayed with an unknown type (this is useful during drafting a graph structure, as the nodes and their metadata can be filled in later).

### On Designing Paths

Chosing what to include in `path` lists is a combination of art and science--it will depend on what you want to communicate. The combination of all paths defines the whole system "graph", but the graph as a whole has both too much and too little information to be useful--you communicate more by being deliberate about what paths are specifically defined.

Defined path lists determine:

1. Paths that are described in the sidebar for the graph
2. When a node is marked as "impacted", only links in paths that include that node are highlighted as also impacted

This means you should choose to define your paths with these things in mind. What will the user/reader want to see about data flow or dependencies for a given node? What flow or dependencies to and from the node are critical or primary, and what connections are less important or secondary? What paths get defined will depend very much on the system you are documenting.

General tips:
- A path should usually describe the flow of one piece or type of data, or of a very closely related set of data artifacts, in a single direction.
  - If dependency-centric instead of data-centric, the path should describe a specific type of end-to-end required/critical dependency or failure path
- A single defined path should probably not have a cycle (though the total combined graph probably will).
- A path should not cover a large part of the whole resulting graph unless a failure on a node in the path impacts a large part of the system.

### Styling

The optional `style` object has a `node` and a `link` section. Each section maps a type name to a set of style attributes; the special key `"*"` applies to every type. Styles are layered, later ones overriding earlier ones: built-in defaults, your `"*"`, then your type-specific entry.

```json
{
  "style": {
    "node": {
      "*": {"stroke": "black"},
      "database": {"fill": "#17becf", "r": 8}
    },
    "link": {
      "indirect": {"stroke-dasharray": "4 2"},
      "runson": {"marker-end": true}
    }
  }
}
```

Supported node attributes:

- `fill`: fill color
- `stroke`: outline color
- `stroke-width`: outline width
- `r`: circle radius

Supported link attributes:

- `stroke`: line color
- `stroke-width`: line width
- `stroke-dasharray`: SVG dash pattern, such as `"4 2"`
- `marker-end`: whether the link is drawn with an arrowhead. Any truthy value draws the arrow; a falsy value (`false`, `0`, `""`) draws none. Links default to having an arrowhead, except `runson` links.

Impacted nodes and links are drawn in red and hovered items are emphasized, regardless of these styles.

NOTE: If `style` keys are found in multiple files, the style dictionary will be merged, but exactly how this happens is currently [undefined](https://en.wikipedia.org/wiki/Nasal_demons). Best practice is currently to define styles for a domain in a single top-level file (or one included specifically for that purpose), rather than spread styles out through multiple files.

## How to test the software

**TODO**

## Known issues

- Path filtering for a selected node is intentionally limited and can omit or include related nodes in ways that may not represent full upstream and downstream connectivity--structure your path lists accordingly to make sure that the most relevant relationships are shown.
- Path references to another path are expanded only when the reference is at the beginning or end of the path.
- The data model and visualization are intended as a high-level view, not a complete representation of system relationships.

For more robust and complete data flow or system architecture documentations, look at tools like [Eclipse Capella](https://mbse-capella.org/) or [Structurizr](https://structurizr.com/).

## Getting help

For questions, bug reports, or feature requests, use the [GitHub issue tracker](https://github.com/mattw-nws/YarnWall/issues).

## Getting involved

Contributions can improve the data model, path filtering, visualization, and automated test coverage. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

----

## Open source licensing info

1. [TERMS](TERMS.md)
2. [LICENSE](LICENSE)

----

## Credits and references

- [D3.js](https://d3js.org/) is used to render and interact with the graph.
- [Vite](https://vite.dev/) provides the development server and production build.
