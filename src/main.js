import './style.css';
import default_data from './assets/default_data.json';

import * as d3 from 'd3';
import { legendColor } from 'd3-svg-legend';

const node_type_colors = {
  "host": "#1f77b4",
  "data": "#ff7f0e",
  "app": "#2ca02c",
  "infrastructure": "#d62728",
  "service": "#9467bd",
  "library": "#8c564b",
  "unknown": "#7f7f7f"
};

// const source_data = ;


function prepareData(source_data, anchor){
  const nodes_arr = source_data.nodes_array;
  const all_paths = source_data.paths;
  const links_implied_arr = source_data.links_implied;
  const links_meta = source_data.links_meta;

  let paths = JSON.parse(JSON.stringify(all_paths));

  // Convert the implied links array into a dictionary for quick lookup, with the second element as the key, and an array of first elements as the value.
  let links_implied_dict = {};
  for (const [source, target] of links_implied_arr) {
    if (!links_implied_dict[target]) {
      links_implied_dict[target] = [];
    }
    links_implied_dict[target].push(source);
  }
  // Also create the reverse lookup dictionary for quick access from source to targets.
  let links_implied_reverse_dict = {};
  for (const [source, target] of links_implied_arr) {
    if (!links_implied_reverse_dict[source]) {
      links_implied_reverse_dict[source] = [];
    }
    links_implied_reverse_dict[source].push(target);
  }
  // console.log(links_implied_reverse_dict);

  for(let k in paths) {
    paths[k]['paths_resolved'] = [paths[k].path];

    paths[k]['paths_resolved'] = paths[k]['paths_resolved'].reduce((accumulator, path) => {
      // Each path may contain array elements, which represent multiple possible nodes at that position in the path.
      // Expand paths with array elements into multiple paths with single elements.
      function expandPath(path) {
        const result = [];
        function helper(currentPath, index) {
          if (index === path.length) {
            result.push(currentPath);
            return;
          }
          const element = path[index];
          if (Array.isArray(element)) {
            for (const e of element) {
              helper([...currentPath, e], index + 1);
            }
          } else {
            helper([...currentPath, element], index + 1);
          }
        }
        helper([], 0);
        return result;
      }
      return accumulator.concat(expandPath(path));
    }, []);
    // console.log(JSON.stringify(paths[k]['paths_resolved'], null, 2));
  }

  // For only the first or last element in a resolved path, the element may be an object with an "path_id" property--this 
  // indicates that the element is a reference to another path. All resolved paths for the path identified by that ID
  // should be appended to the beginning or end of that resolved path--this may result in multiple expanded paths.
  for (let k in paths) {
    paths[k]['paths_resolved'] = paths[k]['paths_resolved'].reduce((accumulator, path) => {
      //TODO: Implement the logic to handle paths where the first or last element is an object with an "path_id" property.
      //      This will involve appending all resolved paths for the referenced path ID to the beginning or end of the current path.
      const result = [];
      if (path.length > 0) {
        const firstElement = path[0];
        const lastElement = path[path.length - 1];

        if (firstElement && typeof firstElement === 'object' && firstElement.path_id) {
          const referencedPaths = paths[firstElement.path_id]?.paths_resolved || [];
          for (const refPath of referencedPaths) {
            result.push([...refPath, ...path.slice(1)]);
          }
        //TODO: handle path_ids in first AND last elements.
        } else if (path.length > 1 && lastElement && typeof lastElement === 'object' && lastElement.path_id) {
          const referencedPaths = paths[lastElement.path_id]?.paths_resolved || [];
          for (const refPath of referencedPaths) {
            result.push([...path.slice(0, -1), ...refPath]);
          }
        } else {
          result.push([...path]);
        }
      }
      return accumulator.concat(result);
    }, []);
    // console.log(JSON.stringify(paths[k]['paths_resolved'], null, 2));
  }


  if (anchor) {
    // Edge case: if the anchor is an implied node, relevant paths will be excluded. Recursively derive a list of possible implied nodes to include in the filtering.
    let anchors = new Set();
    function addImpliedNodes(node, resultset) {
      if (links_implied_reverse_dict[node]) {
        for (const source of links_implied_reverse_dict[node]) {
          if (!resultset.has(source)) {
            resultset.add(source);
            addImpliedNodes(source, resultset);
          }
        }
      }
    }

    anchors.add(anchor);
    addImpliedNodes(anchor, anchors);
    // console.log(anchors);

    // TODO: This is a very restrictive and incomplete way of filtering paths, but general tree traversal further below is too broad
    //       as it picks up completely unrelated paths for a given node. Need better solutions.
    // limit paths to paths that include any string IDs in the anchors set.
    for (let k in paths) {
      paths[k]['paths_resolved'] = paths[k]['paths_resolved'].filter(path => {
        return path.some(element => {
          if (Array.isArray(element)) {
            return element.some(e => anchors.has(e));
          } else {
            return anchors.has(element);
          }
        });
      });
      if (paths[k]['paths_resolved'].length === 0) {
        delete paths[k];
      }
    }
  }



  // Loop through paths and create links for each consecutive pair of elements
  // If an element in the path is an array, create links for each element in the array to the paired element.
  // If both elements in the consecutive pair are arrays, raise an error.
  // Only add the pair if it does not already exist in links_arr.
  let links_arr_filtered = [];
  for(let k in paths) {

    for (const path of paths[k]['paths_resolved']) {
      for (let i = 0; i < path.length - 1; i++) {
        const current = path[i];
        const next = path[i + 1];
        let new_links = [];
        if (Array.isArray(current) && Array.isArray(next)) {
          throw new Error("Both elements in the consecutive pair are arrays.");
        } else if (Array.isArray(current)) {
          for (const c of current) {
            new_links.push([c, next]);
          }
        } else if (Array.isArray(next)) {
          for (const n of next) {
            new_links.push([current, n]);
          }
        } else {
          new_links.push([current, next]);
        }
        for (const link of new_links) {
          if (!links_arr_filtered.some(existing => existing[0] === link[0] && existing[1] === link[1])) {
            links_arr_filtered.push(link);
          }
        }
      }
    }
  }

  // Recursively add implied links for all links in the filtered array.
  let link_nodes_filtered = new Set(links_arr_filtered.flat());
  let added;
  do {
    added = false;
    //FIXME: This is not catching implied links to the root node of the path!
    for (const target of link_nodes_filtered) {
      if (links_implied_dict[target]) {
        // console.log(`Adding implied links for target: ${target}`);
        for (const implied_source of links_implied_dict[target]) {
          const implied_link = [implied_source, target];
          if (!links_arr_filtered.some(existing => existing[0] === implied_link[0] && existing[1] === implied_link[1])) {
            links_arr_filtered.push(implied_link);
            added = true;
          }
        }
      }
    }
  } while (added);

  let nodes = nodes_arr.map(d => ({id: d[0], type: d[1], name: d[2] || d[0] }));
  let links = links_arr_filtered.map(d => ({source: d[0], target: d[1], type: d[2] || "default"}));

  // Convert the links_meta array into a dictionary for quick lookup.
  let links_meta_dict = {};
  for (const {link, type} of links_meta) {
    const key = `${link[0]}>${link[1]}`;
    links_meta_dict[key] = {type};
  }

  links = links.map(d => ({...d, type: links_meta_dict[`${d.source}>${d.target}`]?.type || d.type}));

  let data = {
    nodes: nodes,
    links: links,
    paths: paths
  };


  //TODO: This works, but produces too broad results, as crossing paths of completely unrelated nodes are included.
  // If an anchor is present, traverse the links graph in two directions (upstream and downstream) and include only
  // paths that include the anchor in the links object...
  // function filterLinksByAnchor(anchor, links) {
  //   if (!anchor) return links;
  //   const filtered = [];
  //   const visited = new Set();

  //   function traverseUp(node) {
  //     for (const link of links) {
  //       if (link.target === node && !visited.has(`${link.source}>${link.target}`)) {
  //         visited.add(`${link.source}>${link.target}`);
  //         filtered.push(link);
  //         traverseUp(link.source);
  //       }
  //     }
  //   }

  //   function traverseDown(node) {
  //     for (const link of links) {
  //       if (link.source === node && !visited.has(`${link.source}>${link.target}`)) {
  //         visited.add(`${link.source}>${link.target}`);
  //         filtered.push(link);
  //         traverseDown(link.target);
  //       }
  //     }
  //   }

  //   traverseUp(anchor);
  //   traverseDown(anchor);
  //   return filtered;
  // }
  // links = filterLinksByAnchor(anchor, links);

  return data;
}

function writeDocSidebar(prepared_data, all_paths, anchor) {
  let paths = prepared_data.paths;
  let nodes = prepared_data.nodes;
  // let node_type_colors = prepared_data.node_type_colors;
  // Write Doc sidebar

  let nodes_dict = Object.fromEntries(nodes.map(d => [d.id, d]));
  const impacted_keys = new Set(prepared_data.links.filter(l => l.impacted).map(l => `${l.source}>${l.target}`));
  const reach = prepared_data.impacted_reach || new Set();

  // Node IDs at the start or end of a path element (a node ID, or a reference to another path).
  function edgeNodes(element, atEnd, seen = new Set()) {
    if (typeof element === 'string') return [element];
    if (!element?.path_id || seen.has(element.path_id)) return [];
    const ref = all_paths[element.path_id]?.path;
    if (!ref?.length) return [];
    const next = new Set(seen).add(element.path_id);
    const edge = atEnd ? ref[ref.length - 1] : ref[0];
    return (Array.isArray(edge) ? edge : [edge]).flatMap(e => edgeNodes(e, atEnd, next));
  }

  const pathsDoc = document.getElementById('paths_doc_content');
  pathsDoc.innerHTML = '';
  for(let k in paths) {
    const path = paths[k];
    const div = document.createElement('div');
    const h4 = document.createElement('h4');
    h4.innerText = paths[k].name || k;
    div.appendChild(h4);
    if('comment' in path) {
      const comment = document.createElement('p');
      comment.className = 'comment';
      comment.innerText = path.comment;
      div.appendChild(comment);
    }
    const pathDiv = document.createElement('div');
    pathDiv.className = 'path';

    // `incoming` is the list of {node, reached} ends preceding this path; `reached` means an impacted node
    // (or one downstream of it via implied links) appears earlier on the path being drawn.
    // Returns the {node, reached} ends of this path.
    function printPath(path, parentElement, incoming = []) {
      let prevEnds = incoming;
      let linkaLast = null;
      for (let link of path.path) {
        const linkDiv = document.createElement('div');
        linkDiv.className = 'link';
        parentElement.appendChild(linkDiv);
        if(!Array.isArray(link)){
          link = [link];
        }
        const currentEnds = [];
        for(const sublink of link){
          let subDiv = document.createElement('div');
          subDiv.className = 'subpath';
          // The arrow into this element is its ::before; flag it only if the impacted node is already on this path.
          const starts = edgeNodes(sublink, false);
          if (prevEnds.some(p => p.reached && starts.some(s => impacted_keys.has(`${p.node}>${s}`)))) {
            subDiv.classList.add('impacted');
            if(linkaLast) linkaLast.classList.add('impacted');
          }
          linkDiv.appendChild(subDiv);
          if(typeof sublink == 'string'){
            let nodeName = nodes_dict[sublink]?.name || sublink;
            let linka = document.createElement('a');
            linka.href = `#${sublink}`;
            linka.innerHTML = `<svg viewBox="0 0 12 12" style="width: 16px; height: 16px;"><circle cx="8" cy="8" r="4" fill="${node_type_colors[nodes_dict[sublink]?.type || 'unknown']}" /></svg> ` + nodeName;
            subDiv.appendChild(linka);
            linka.addEventListener("click", (event) => {
              if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                prepared_data.nodes.filter(node => node.id === sublink).forEach(node => node.impacted = !node.impacted);
                computeImpactedLinks(prepared_data, source_data.links_implied);
                applyImpacted();
                writeDocSidebar(prepared_data, all_paths, anchor);
              }
            });

            linkaLast = linka;
            currentEnds.push({node: sublink, reached: prevEnds.some(p => p.reached) || reach.has(sublink)});
          } else {
            currentEnds.push(...printPath(all_paths[sublink.path_id], subDiv, prevEnds)); //NOTE: Goes back to the main/all paths data!
          }
        }
        prevEnds = currentEnds;
      }
      return prevEnds;
    }
    
    printPath(path, pathDiv);

    // let links = prepared_data.links.filter(link => pathLinks.some(pl => pl[0] === link.source && pl[1] === link.target));
    const hoveredLinks = path.paths_resolved.reduce((acc, resolvedPath) => {
      for (let i = 0; i < resolvedPath.length - 1; i++) {
        acc.push([resolvedPath[i], resolvedPath[i + 1]]);
      }
      return acc;
    }, []);
    if(hoveredLinks.length === 0) return [];
    let links = prepared_data.links.filter(link => hoveredLinks.some(([source, target]) => source === link.source && target === link.target));
    
    pathDiv.onmouseenter = () => ((links) =>{
      for (const link of links) {
        link.hovered = true;
      }
      applyHovered();
    })(links);
    pathDiv.onmouseleave = () => ((links) => {
      for (const link of links) {
        link.hovered = false;
      }
      applyHovered();
    })(links);

    div.appendChild(pathDiv);
    pathsDoc.appendChild(div);
  }

}

// Recomputes the `impacted` flag on every link in prepared_data from the `impacted` flags on its nodes.
// A link is impacted if it follows an impacted node (or a node reachable from one via implied links) in a
// resolved path, or if it is itself an implied link traversed downstream of an impacted node.
function computeImpactedLinks(prepared_data, links_implied) {
  const { nodes, links, paths } = prepared_data;

  const implied_by_source = {};
  for (const [source, target] of links_implied || []) {
    (implied_by_source[source] ||= []).push(target);
  }

  // Impacted nodes plus everything downstream of them via implied links.
  const flagged = new Set(nodes.filter(n => n.impacted).map(n => n.id));
  const impacted_keys = new Set();
  const queue = [...flagged];
  while (queue.length) {
    const node = queue.shift();
    for (const target of implied_by_source[node] || []) {
      impacted_keys.add(`${node}>${target}`);
      if (!flagged.has(target)) {
        flagged.add(target);
        queue.push(target);
      }
    }
  }

  for (const k in paths) {
    for (const path of paths[k].paths_resolved) {
      const start = path.findIndex(e => flagged.has(e));
      if (start === -1) continue;
      for (let i = start; i < path.length - 1; i++) {
        if (typeof path[i] === 'string' && typeof path[i + 1] === 'string') {
          impacted_keys.add(`${path[i]}>${path[i + 1]}`);
        }
      }
    }
  }

  for (const link of links) {
    link.impacted = impacted_keys.has(`${link.source}>${link.target}`);
  }
  prepared_data.impacted_reach = flagged;
}

let applyImpacted = null;
let applyHovered = null;

function renderChart(prepared_data, all_paths, anchor){
  let nodes = prepared_data.nodes;
  let links = prepared_data.links; 
  if (document.getElementById("force-graph")) {
    document.getElementById("force-graph").remove();
  }


  function linkArc(d) {
    const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
    return `
      M${d.source.x},${d.source.y}
      A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
    `;
  }

  const chart = () => {

    // Specify the dimensions of the chart.
    const width = window.innerWidth; // Make fill the available horizontal space
    const height = window.innerHeight;

    // Specify the color scale.
    // const color = d3.scaleOrdinal(d3.schemeCategory10);
    const color = d3.scaleOrdinal()
      .domain(Object.keys(node_type_colors))
      .range(Object.values(node_type_colors));

    // The force simulation mutates links and nodes, so create a copy
    // so that re-evaluating this cell produces the same result.
    let links = prepared_data.links.map(d => ({...d}));
    let nodes = prepared_data.nodes.map(d => ({...d}));
    const node_types = Array.from(new Set(nodes.map(d => d.type)));
    const link_types = Array.from(new Set(links.map(d => d.type)));

    // Remove any nodes not in links...
    const linkedNodeIds = new Set(links.flatMap(d => [d.source, d.target]));
    nodes = nodes.filter(d => linkedNodeIds.has(d.id));

    // Create any nodes that are referenced in links but not already in the nodes array with type = 'unknown'
    const existingNodeIds = new Set(nodes.map(d => d.id));
    for (const link of links) {
      if (!existingNodeIds.has(link.source)) {
        nodes.push({id: link.source, type: 'unknown', name: link.source});
        existingNodeIds.add(link.source);
      }
      if (!existingNodeIds.has(link.target)) {
        nodes.push({id: link.target, type: 'unknown', name: link.target});
        existingNodeIds.add(link.target);
      }
    }

    // Create a simulation with several forces.
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links)
          .id(d => d.id)
          .distance(d => {
            if (d.type === "runson") {
              return 5;
            }
            return 50;
          })
          .strength(d => {
            if (d.type === "runson") {
              // console.log("Runson link detected for node:", d.id);
              return 1.0;
            } else if (d.type === "indirect") {
              // console.log("Indirect link detected for node:", d.id);
              return 0.01;
            }
            return 0.1;
            // console.log(d);
          })
        )
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width * 0.375, height / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY());

    const drag = simulation => {
      
      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
      
      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      
      return d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended);
    }

    simulation.on("tick", () => {
      link.attr("d", linkArc);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });



    // Create the SVG container.
    const svg = d3.create("svg")
        .attr("id", "force-graph")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; font: 12px sans-serif;");
    const container = svg.append("g");

    const marker_defs = link_types.flatMap(t => [{type: t, red: false}, {type: t, red: true}]);
    svg.append("defs").selectAll("marker")
      .data(marker_defs)
      .join("marker")
        .attr("id", d => d.red ? `arrow-${d.type}-red` : `arrow-${d.type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -0.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("path")
        .attr("fill", d => d.red ? 'red' : '#999')
        .attr("d", "M0,-5L10,0L0,5");


    const link = container.append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(links)
      .join("path")
        .attr("stroke", d => d.impacted ? 'red' : '#999')
        .attr("stroke-width", d => d.type === "indirect" ? 0.5 : d.hovered ? 3 : 1.5)
        .attr("marker-end", d => `url(${new URL(`#arrow-${d.type}${d.impacted ? '-red' : ''}`, location)})`);


    const node = container.append("g")
        .attr("fill", "currentColor")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
      .selectAll("g")
      .data(nodes)
      .join("g")
        .call(drag(simulation));

    node.append("circle")
      .attr("stroke", d => d.impacted ? "red" : "white")
      .attr("stroke-width", d => d.impacted ? 3 : 1.5)
      .attr("r", 5)
      .attr("fill", d => color(d.type));

    node.append("title")
        .text(d => d.id);

    node.append("text")
        .attr("x", 8)
        .attr("y", "0.31em")
        .text(d => d.name)
        // Make text bold if id == anchor...
        .attr("font-weight", d => d.id === anchor ? "bold" : "normal")
        .attr("font-size", d => d.id === anchor ? "16px" : "12px")
      .clone(true).lower()
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 3);

    // Scroll wheel zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10]) // Min and max zoom limits
      .on("zoom", (event) => {
          container.attr("transform", event.transform); // Apply transform to the container group
      });
    svg.call(zoom);

    // Restyle in place so toggling impact doesn't restart the force layout.
    applyImpacted = () => {
      const prepared_by_id = new Map(prepared_data.nodes.map(n => [n.id, n]));
      nodes.forEach(n => { n.impacted = !!prepared_by_id.get(n.id)?.impacted; });
      links.forEach((l, i) => { l.impacted = !!prepared_data.links[i].impacted; });

      link
        .attr("stroke", d => d.impacted ? 'red' : '#999')
        .attr("marker-end", d => `url(${new URL(`#arrow-${d.type}${d.impacted ? '-red' : ''}`, location)})`);
      node.select("circle")
        .attr("stroke", d => d.impacted ? "red" : "white")
        .attr("stroke-width", d => d.impacted ? 3 : 1.5);
    };
    applyHovered = () => {
      const prepared_by_id = new Map(prepared_data.nodes.map(n => [n.id, n]));
      nodes.forEach(n => { n.hovered = !!prepared_by_id.get(n.id)?.hovered; });
      links.forEach((l, i) => { l.hovered = !!prepared_data.links[i].hovered; });

      link
        .attr("stroke-width", d => d.hovered ? 3 : 1.5)
      node.select("circle")
        .attr("r", d => d.hovered ? 6 : 4);
    };

    // Click navigates to the node; Ctrl/Cmd+click toggles its "impacted" state instead.
    node.on("click", (event, d) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        let prepared_node = prepared_data.nodes.find(n => n.id === d.id);
        if (!prepared_node) {
          prepared_node = {id: d.id, type: d.type, name: d.name};
          prepared_data.nodes.push(prepared_node);
        }
        prepared_node.impacted = !prepared_node.impacted;
        computeImpactedLinks(prepared_data, source_data.links_implied);
        applyImpacted();
        writeDocSidebar(prepared_data, all_paths, anchor);
        return;
      }
      location.hash = d.id;
      getAnchor(d.id);
    });

        
    // Legend for the node colors.
    svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(10,10)`);
      
    const legend = legendColor()
    // .shape("path", d3.symbol().type(d3.symbolSquare).size(150)())
    // .title("Node Colors")
    .titleWidth(100)
    .shape("path", d3.symbol().type(d3.symbolCircle).size(50)())
    .shapePadding(15)
    // .orient('horizontal')
    .labelOffset(10)
    .scale(color);

    svg.select(".legend")
      .call(legend);

    
    return svg.node();
  }
  document.body.appendChild(chart());
  // setWillImpact(modifierHeld);

}

// const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loadData(searchParams){
  if(!searchParams.has('input')){
    console.log("No input specified in searchParams.");
    return null;
  }

  let url = searchParams.get('input');
  let headers = searchParams.has('_headers') ? JSON.parse(searchParams.get('_headers')) : {};

  let seenFiles = new Set();
  let loadedFiles = new Set();

  let source_data = {
    nodes_array: [],
    links_meta: [],
    links_implied: [],
    paths: {},
  };

  async function innerLoad(url, source_data) {
    // console.log(`headers: ${JSON.stringify(headers)}`)
    const opts = { headers: headers || {} };

    const base = new URL(url, window.location.href);
    seenFiles.add(base.href);
    updateSplashLoadingText(seenFiles.size, loadedFiles.size);

    // await sleep(2000);
    const response = await fetch(url, opts);
    const data = await response.json();

    if ('nodes_array' in data) {
      source_data.nodes_array = source_data.nodes_array.concat(data.nodes_array);
    }

    if ('links_meta' in data) {
      source_data.links_meta = source_data.links_meta.concat(data.links_meta);
    }

    if ('links_implied' in data) {
      source_data.links_implied = source_data.links_implied.concat(data.links_implied);
    }

    if ('paths' in data) {
      // paths is an object/dictionary, not an array
      source_data.paths = Object.assign(source_data.paths, data.paths);
    }

    loadedFiles.add(base.href);

    updateSplashLoadingText(seenFiles.size, loadedFiles.size);

    if ('files' in data) {
      let filesToLoad = data.files.filter(file => !seenFiles.has(file));
      // filesToLoad.forEach(file => seenFiles.add(file));

      // Load all files in parallel...
      await Promise.all(filesToLoad.map(async file => {
        let resolvedUrl = new URL(file, base).href;
        return await innerLoad(resolvedUrl, source_data); 
      }));
    }

  }
  
  await innerLoad(url, source_data);
  return source_data;
}

// Tracks whether Ctrl/Cmd is held, so the graph can signal that a click will toggle "impacted".
// The graph element is recreated on every render, so the state is reapplied after each one.
let modifierHeld = false;

function setWillImpact(held) {
  modifierHeld = held;
  document.getElementById("force-graph")?.classList.toggle("will-impact", held);
}

window.addEventListener("keydown", e => setWillImpact(e.ctrlKey || e.metaKey));
window.addEventListener("keyup", e => setWillImpact(e.ctrlKey || e.metaKey));
window.addEventListener("blur", () => setWillImpact(false));


// Splash screen handling
const splash = document.getElementById("splash");
const splashLogo = document.getElementById("splash-logo");
import splashUrl from './assets/YarnWall.jpg';

function showSplash() {
  splash.style.display = "block";
  splashLogo.src = splashUrl;
}
function hideSplash() {
  splash.style.display = "none";
}
function updateSplashLoadingText(numLoading, numLoaded) {
  document.getElementById("splash-text").textContent = `Loaded ${numLoaded} of ${numLoading} files...`;
  console.log(`Loaded ${numLoaded} of ${numLoading} files...`);
}
showSplash();


let searchParams = new URLSearchParams(window.location.search);

// Check for Google Apps Script parameter injection...
if(window.gasRequestParams){
  // console.log(`Getting input from requestParams: ${window.gasRequestParams}`);
  let gasHeaders = window.gasRequestParams._gasHeaders;
  delete window.gasRequestParams._gasHeaders;
  searchParams = new URLSearchParams(window.gasRequestParams);
  searchParams.set('_headers', JSON.stringify(gasHeaders));
} else {
  searchParams.delete('_headers'); // Prevent trying to use this outisde of GAS for some reason
  // console.log(`Getting input from URL search parameters: ${searchParams.get('input')}`);
}

let source_data = default_data;
let loadedData = await loadData(searchParams);
if (loadedData) {
  source_data = loadedData;
}
hideSplash();

let current_prepared = null;

function getAnchor(anchor) {
  if(!anchor){
    anchor = window.location.hash.slice(1);
  }
  const impactedIds = new Set((current_prepared?.nodes || []).filter(n => n.impacted).map(n => n.id));
  let prepared_data = prepareData(source_data, anchor);
  current_prepared = prepared_data;
  // Carry impacted flags over from the previous render, since prepareData rebuilds the structure.
  for (const n of prepared_data.nodes) {
    n.impacted = impactedIds.has(n.id);
  }
  computeImpactedLinks(prepared_data, source_data.links_implied);
  renderChart(prepared_data, source_data.paths, anchor);
  writeDocSidebar(prepared_data, source_data.paths, anchor);
}
  
getAnchor();

// Redraw when the anchor element changes size
// const resizeObserver = new ResizeObserver(() => {
//   renderChart();
// });
// resizeObserver.observe(window.document.body);
// console.log("setting hashchange listener");
window.addEventListener("hashchange", function(){
  getAnchor();
});

