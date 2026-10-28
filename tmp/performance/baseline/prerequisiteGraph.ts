export type GraphEdge = { from: string; to: string; kind: "prerequisite" | "corequisite" };

/** Trace ancestry and descendants independently, keeping corequisites symmetric. */
export function getHighlightedPath(highlightedCourseId: string | null, edges: GraphEdge[]) {
    const courseIds = new Set<string>();
    const upstreamIds = new Set<string>();
    const downstreamIds = new Set<string>();
    const corequisiteIds = new Set<string>();
    const connectionIds = new Set<string>();
    const upstreamEdges = new Set<string>();
    const downstreamEdges = new Set<string>();
    const corequisiteEdges = new Set<string>();

    if (!highlightedCourseId) {
      return {
        courseIds,
        upstreamIds,
        downstreamIds,
        corequisiteIds,
        connectionIds,
        upstreamEdges,
        downstreamEdges,
        corequisiteEdges,
      };
    }

    courseIds.add(highlightedCourseId);

    const walk = (id: string, walkDir: "upstream" | "downstream", visited: Set<string>) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const edge of edges) {
        if (edge.kind === "corequisite") {
          if (edge.from === id || edge.to === id) {
            const other = edge.from === id ? edge.to : edge.from;
            const key = `${edge.kind}-${edge.from}-${edge.to}`;
            connectionIds.add(key);
            corequisiteEdges.add(key);
            courseIds.add(other);
            if (other !== highlightedCourseId) {
              corequisiteIds.add(other);
            }
          }
          continue;
        }

        const follows = walkDir === "upstream" ? edge.to === id : edge.from === id;
        if (!follows) continue;
        const next = walkDir === "upstream" ? edge.from : edge.to;
        const key = `${edge.kind}-${edge.from}-${edge.to}`;
        connectionIds.add(key);
        if (walkDir === "upstream") {
          upstreamEdges.add(key);
          if (next !== highlightedCourseId) upstreamIds.add(next);
        } else {
          downstreamEdges.add(key);
          if (next !== highlightedCourseId) downstreamIds.add(next);
        }
        courseIds.add(next);
        walk(next, walkDir, visited);
      }
    };

    walk(highlightedCourseId, "upstream", new Set());
    walk(highlightedCourseId, "downstream", new Set());

    return {
      courseIds,
      upstreamIds,
      downstreamIds,
      corequisiteIds,
      connectionIds,
      upstreamEdges,
      downstreamEdges,
      corequisiteEdges,
    };
}
