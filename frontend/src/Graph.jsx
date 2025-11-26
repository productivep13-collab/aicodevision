import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function Graph({ tree }) {
  const graphRef = useRef();

  useEffect(() => {
    if (!tree) return;

    const svg = d3.select(graphRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;
    svg.attr("width", width).attr("height", height);

    const hierarchy = d3.hierarchy(tree, (d) => d.children);
    const treeLayout = d3.tree().size([width, height]);
    treeLayout(hierarchy);

    svg.selectAll("line")
      .data(hierarchy.links())
      .enter()
      .append("line")
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
      .attr("stroke", "gray");

    svg.selectAll("circle")
      .data(hierarchy.descendants())
      .enter()
      .append("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 5)
      .attr("fill", "lightblue");

  }, [tree]);

  return <svg ref={graphRef}></svg>;
}
