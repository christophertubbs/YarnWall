# Metadata-rich example data

[public/data/default_data.json](../public/data/default_data.json) models a
**fictional** Atlas Commerce system: 115 nodes, 178 directed relationships,
20 listed scenarios, and 130 unlisted supporting paths. It includes source
ownership, function calls, class dependencies, inheritance, interfaces,
databases, events, deployment, tests, and operational context. Its source files,
contacts, endpoints, test cases, and operational targets are illustrative.
It describes neither YarnWall's implementation nor a real application.

With the development server running, open:

```text
http://localhost:5173/?input=./data/default_data.json
```

Use the port printed by Vite if it differs. You can also drop the JSON file on
the page. This public sample does not replace the empty startup dataset imported
from `src/assets/default_data.json`.

## What is supported today

The sample retains the current `nodes_array`, `links_meta`, `links_implied`,
`paths`, and `style` structure. It renders through both graph engines. Node types
such as `class`, `method`, and `function` are ordinary custom types with styles;
the existing legend can toggle them, and the text filter can use
`type == 'class'` or `type == 'function' or type == 'method'` today.

Metadata inspection, grouping by arbitrary fields, saved views, and semantic
class/function projections are future features. The `_meta.planned_views` entries
are design examples, not executable configuration.

| Location | Meaning | Current handling |
| --- | --- | --- |
| `nodes_array[i][0..2]` | Stable ID, render type, display name | Used to prepare and render nodes |
| `nodes_array[i][3]` | Node metadata object | Retained in merged source data; ignored when preparing nodes |
| `links_meta[i].link` | Ordered source/target IDs | Used to match an existing rendered edge |
| `links_meta[i].type` | Visual relationship type | Used for link styling/force behavior |
| `links_meta[i].id` and `.metadata` | Stable edge identity and metadata | Retained in source data; ignored when preparing edges |
| `paths[id].metadata` | Scenario purpose, conditions, ownership, provenance | Retained with path objects; no metadata UI |
| `_meta` | Dataset description, vocabularies, planned views | Ignored by current source merging |
| `$schema` | Editor/validator reference to the companion schema | Ignored by the application |

The JSON-copy button serializes the **merged source**. Node tuple metadata,
edge metadata, and path metadata survive that operation. Top-level `_meta` and
`$schema` do not currently survive URL/drop import because `mergeSourceData`
copies only recognized top-level keys. Keep the original file as the complete
dataset artifact. A future metadata implementation should explicitly preserve
dataset metadata and join custom fields into prepared nodes/links.

## Node metadata

Each node is a four-element tuple. The fourth element is a proposed extension
convention for this sample, not a previously established public API:

```json
[
  "method:OrderService.placeOrder",
  "method",
  "OrderService.placeOrder()",
  {
    "kind": "method",
    "domain": "orders",
    "owner": "commerce",
    "service": "service:orders",
    "layer": "domain",
    "code": {
      "declaring_class": "class:OrderService",
      "module": "module:orders-domain"
    }
  }
]
```

This is a shortened excerpt; full records also include descriptions, tags,
classification, lifecycle, criticality, documentation, and provenance. Use
namespaced IDs rather than display labels for joins. For example,
`PaymentService.authorize()` and `SandboxPaymentGateway.authorize()` have
different IDs despite sharing a method name.

Common fields deliberately use the same names on nodes, edges, and paths:

- `dataset`: Stable dataset identifier.
- `kind`: Semantic record kind; node kinds match the tuple's render type.
- `description`: Human-readable context for a future inspector.
- `domain`, `owner`, `service`, `layer`, `environment`: Grouping dimensions.
  `service` is a node ID or `null`; `owner` and `domain` join `_meta` catalogs.
- `classification`, `criticality`, `lifecycle`, `tags`: Filtering and annotation
  fields with consistent vocabularies. Classification is modeled information
  sensitivity, not an access-control mechanism implemented by YarnWall.
- `provenance`: Explicit synthetic status, verification status, and confidence.
  `null` confidence means no source analysis or observation supports a score.

Code nodes add `source` and `code`. Source records contain the fictional
repository, relative path, revision, symbol, and internally coherent line ranges.
Methods point to their declaring class; symbols point to their module. Callables
include signatures, parameter descriptions/types, sensitivity hints, return
types, error contracts, purity, and side effects. Complexity measurements remain
`null` rather than fabricated.

Other node types carry their own details:

- Services/deployments: Routes, protocols, readiness checks, resource requests,
  rollout strategy, observability names, and illustrative operational targets.
- Data resources: Entities, field types/classification, retention, encryption,
  cache keys, and consistency context.
- Events/contracts: Versioned envelope fields, topic names, complete example
  envelopes, deduplication keys, and compatibility policy. Contract source paths
  describe fictional files; they are not additional schemas shipped here.
- Tests: Target node IDs, intended cases, and explicitly unexecuted status. These
  are sample graph entities, not evidence that those tests exist or passed.

## Edge metadata and direction

Every `links_meta` entry has an `id`, `link`, `type`, and `metadata`. The visual
`type` is separate from `metadata.relationship`: for example, a hosting edge
uses `type: "runson"` and `relationship: "runs_on"`. All entries have descriptions,
ownership, category, direction, evidence, and projection references.

| Relationship | Direction |
| --- | --- |
| `calls` | Caller → callee |
| `contains` / `declares` | Owner → owned module / declared symbol |
| `depends_on` | Dependent → dependency |
| `extends` / `implements` | Subclass → base / implementation → interface |
| `runs_on` | Workload → hosting resource |
| `reads`, `writes`, `accesses` | Reader/writer → data resource |
| `publishes` | Producer → event |
| `delivers` | Event → broker, or broker → subscribed callable |
| `tests` / `validates_contract` | Test or contract → subject |
| `configures` | Configuration → configured consumer |

Calls include transport, awaiting, timeouts, side effects, retry policy, and
idempotency expectations. Conditional compensation calls have explicit
conditions so a future inspector does not mistake them for the successful
checkout path. Data-access edges distinguish reads/writes, transaction scope,
and sensitive fields. Messaging edges identify event type, schema version,
routing key, exchange, subscription, delivery guarantees, and deduplication.

The renderer currently identifies an edge by its ordered endpoint pair and
collapses parallel relationships. This sample has one `links_meta` record per
pair, avoiding metadata that would silently overwrite a previous record's type.
Multiple observations or relationship meanings between the same endpoints
should be represented inside one metadata record until multigraph support is
implemented. A stable edge ID remains useful for future evidence lists and
inspector selection even though the renderer does not use it yet.

`links_meta` describes edges; when explicit paths exist, it does not independently
create every listed edge. The 130 unlisted support paths ensure that structural,
deployment, and verification edges appear alongside the listed scenarios. Their
`metadata.edge_id` points back to the relationship they expose. The single
`links_implied` entry keeps checkout configuration alongside order placement;
it adds context, not another execution step.

## Future class/function views

For a callable view, select `function` and `method` nodes and `calls` edges.
For an explicit class view, select `class` and `interface` nodes and class-level
`depends_on`, `extends`, and `implements` relationships.

For a projected class view, each call edge supplies
`metadata.projection.source_class` and `target_class`, with corresponding module
and service references. A future implementation can group method calls by
declaring-class pairs, omit intra-class calls, aggregate counts, and retain the
original edge IDs and evidence. Free functions have no declaring class and must
be handled explicitly rather than assigned a fabricated class. Keep projected
calls distinct from explicit constructor/interface dependencies.

The current node filter heals links across removed nodes. That behavior retains
connectivity but is **not** a semantic class-dependency projection: it can splice
through declarations, infrastructure, or shared brokers. Future views should
select relationship categories and ownership mappings deliberately.

Similarly, a shared event broker does not imply that every event reaches every
consumer. Use routing keys, event contracts, subscription bindings, and focused
scenario paths to preserve messaging meaning when grouping services.

## Schema and validation

[default_data.schema.json](../public/data/default_data.schema.json) uses
[JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/schema).
It documents and validates **this example's conventions**; it is not a claim that
YarnWall already enforces a universal schema. Metadata objects allow additional
fields so future experiments can add detail without changing the base shape.

The schema validates shapes, vocabularies, tuple layouts, and many typed metadata
fields. [tests/default-data.test.js](../tests/default-data.test.js) checks unique
IDs/pairs, cross references, source ranges, view ownership mappings, event
examples, path expansion/coverage, and metadata survival through the real merge
helper. Run these checks with `npm test`. Runtime schema validation is not added
to the loader by this sample.
