
# YarnWall

YarnWall is a browser-based tool for documenting and visualizing data flows at a level suitable for agile project work. It shows systems and data as a node-and-link diagram, alongside the described paths. The model is intentionally lightweight so teams can maintain it without cataloguing every system relationship.

Conceptually, a system is documented as a set of nodes and paths (sequencces of links between nodes). The intent is that paths denote the direction of data flowing through a system, and the inverse direction of the path can (usually) be inferred to be a dependency relationship--but you may find other ways to represent your system structure (whatever the representation, a consistent approach to recording relationships should be applied to the whole recorded structure). The goal is to produce a "good enough" operational picture of data flow and dependencies for high- to medium-level troubleshooting and developer familiarization. Cyclical relationships are possible, so the multi-link path is intended to represent the important proximate relationships to any node, rather than all downstream or upstream links and nodes.

YarnWall is a standalone JavaScript application built with Vite and D3.js. It is at an early prototype stage (package version 0.0.1); no production or demo instance is currently available. The data-flow model in stored in editable JSON files for rendering directly in the browser, rather than requiring a separate modeling service or database.

## Dependencies

- Node.js 20+ and npm
- D3.js and d3-svg-legend
- A modern browser with access to the internet

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

A default diagram is defined in [src/assets/default_data.json](src/assets/default_data.json). To load another dataset, pass its URL in the `input` query parameter. For example, place JSON files in `public/data/` and go to `index.html?input=./data/myfile.json`.

Each data file may contain:

- `paths`: named flow descriptions. This is the core entity in the data. Each path includes an ordered `path` array of node IDs. A path segment may be:
  - A single node ID (a string)
  - An array of node IDs, which represents a set of similar nodes at that point in the path (for example, multiple similar data artifacts generated at that point). Optional `name` and `comment` fields describe the path.
  - An object including a `path_id` (or an array of such objects), which allows referencing another path, for reusing or chaining paths.

  (See notes below on desiging and choosing paths)
- `nodes_array`: arrays of `[id, type, name]`. The display name is optional; the ID is used if it is omitted. Currently supported types are 'app', 'service', 'infrastructure', 'data', 'library', and 'host'
- `links_meta`: objects with a `link` pair of node IDs and a `type`. Currently supported types are:
  - `runson` - Denotes a tighter coupling and is currently represented by a shorter line rendering for the link
- `links_implied`: pairs of node IDs where the first item should always appear in the diagram whenever the second item in the pair is present; this is useful for critical dependencies that should always be shown for a node but do not directly appear in many/any paths.
- `files`: an array of other JSON files to combine; this allows modular recording of structures and alternative top-level aggregations of subgraphs.
  - NOTE: Relative file paths are fetched relative to the file in which they appear.

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

## Usage

The displayed diagram shows nodes and directional links derived from the configured paths and implied links. Node color indicates its type. The panel on the right lists the paths included in the data and links each path's node names to the corresponding diagram node.

- Drag nodes to adjust the layout.
- Use the scroll wheel to zoom the diagram.
- Click a node to focus the view on paths containing that node. The selected node is highlighted and only paths in which that node appears are shown.
- Ctrl+Click a node to mark it as "impacted", and downstream path segments including the node will be highlighted in red
- Use the home link in the path panel to clear the selected node.

To document a flow, add its nodes and a path to a JSON data file, then load that file using the `input` parameter. Use the example data in  `default_data.json` as a reference.

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
- [d3-svg-legend](https://github.com/susielu/d3-legend) provides the node-type legend.
- [Vite](https://vite.dev/) provides the development server and production build.
