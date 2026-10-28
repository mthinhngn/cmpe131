import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, BackgroundVariant, Handle, MarkerType, Position, ReactFlow, useNodesState, type Edge, type ReactFlowInstance, type Node, type NodeProps } from "@xyflow/react";

import { getHighlightedPath, type GraphEdge } from "./prerequisiteGraph";
import { roadmapStatusLabels, type RoadmapStatus } from "./roadmapStatus";
import "@xyflow/react/dist/style.css";
import "./roadmap-flow.css";

type FlowCourse = { id: string; code: string; title: string; term: string; status: string; x: number; y: number; prerequisites: string[]; corequisites?: string[]; credits: number; detail?: string; sourceUrl?: string };
type Row = { year: string; term: string; count: number; credits: number; y: number };
type CourseNodeData = { course: FlowCourse; focused: boolean; related: boolean; shaded: boolean };
type CourseNode = Node<CourseNodeData, "course">;
type SemesterNode = Node<{ row: Row }, "semester">;
type RoadmapNode = CourseNode | SemesterNode;

const courseHandles = <>
  <Handle id="prerequisite-target" type="target" position={Position.Top} isConnectable={false} />
  <Handle id="corequisite-left-source" type="source" position={Position.Left} isConnectable={false} />
  <Handle id="corequisite-right-source" type="source" position={Position.Right} isConnectable={false} />
  <Handle id="corequisite-left-target" type="target" position={Position.Left} isConnectable={false} />
  <Handle id="corequisite-right-target" type="target" position={Position.Right} isConnectable={false} />
</>;
const bottomHandle = <Handle id="prerequisite-source" type="source" position={Position.Bottom} isConnectable={false} />;
const courseGrid = <Background variant={BackgroundVariant.Lines} gap={26} color="#e5eeea" />;

const CourseContent = memo(function CourseContent({ course }: { course: FlowCourse }) {
  return <>
    <header><strong>{course.code}</strong><span>{course.credits} u</span></header>
    <p>{course.title}</p>
    <footer><i />{roadmapStatusLabels[course.status as RoadmapStatus] ?? "Check requirements"}</footer>
  </>;
});

const CourseCard = memo(function CourseCard({ data }: NodeProps<CourseNode>) {
  const { course, focused, related, shaded } = data;
  return <article className={`rf-course-card${focused ? " is-focused" : ""}${related ? " is-related" : ""}${shaded ? " is-shaded" : ""}${course.status === "choice" ? " is-choice" : ""}`}>
    {courseHandles}<CourseContent course={course} />{bottomHandle}
  </article>;
}, (previous, next) => previous.data === next.data);

const SemesterLabel = memo(function SemesterLabel({ data }: NodeProps<SemesterNode>) {
  return <div className="rf-semester-label"><small>{data.row.year}</small><strong>{data.row.term} semester</strong><span>{data.row.count} requirements</span><span>{data.row.credits} units</span></div>;
});

const proOptions = { hideAttribution: true };
const nodeTypes = { course: CourseCard, semester: SemesterLabel };

export default function RoadmapFlow({ courses, rows, selectedId, query, onSelect }: { courses: FlowCourse[]; rows: Row[]; selectedId: string; query: string; onSelect: (id: string) => void }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [flow, setFlow] = useState<ReactFlowInstance<RoadmapNode> | null>(null);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);
  const graphWidth = Math.max(140, ...courses.map(course => 156 + ((course.x - 140) / 165) * 192 + 164));
  const graphBottom = Math.max(120, ...courses.map(course => ((course.y - 65) / 178) * 186 + 120));
  const zoom = Math.min(1.8, Math.max(.1, (width - 40) / graphWidth));
  const canvasHeight = Math.ceil(56 + graphBottom * zoom + 24);
  useEffect(() => {
    if (width && flow) void flow.setViewport({ x: 20, y: 56 - 32 * zoom, zoom });
  }, [flow, width, zoom]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<RoadmapNode>([]);
  const graphEdges = useMemo<GraphEdge[]>(() => {
    const byId = new Map(courses.map(course => [course.id, course]));
    return courses.flatMap(course => [
    ...course.prerequisites.map(from => ({ from, to: course.id, kind: "prerequisite" as const })),
    ...(course.corequisites ?? []).filter(from => !byId.get(from)?.corequisites?.includes(course.id) || from < course.id).map(from => ({ from, to: course.id, kind: "corequisite" as const })),
    ]);
  }, [courses]);
  const focus = hoveredId ?? (query.trim() && query !== dismissedQuery ? selectedId : focusedId);
  const clearFocus = useCallback(() => { setHoveredId(null); setFocusedId(null); setDismissedQuery(query); }, [query]);
  const path = useMemo(() => getHighlightedPath(focus, graphEdges), [focus, graphEdges]);

  useEffect(() => {
    setNodes(previous => {
      const byId = new Map(previous.map(node => [node.id, node]));
      const semesters = rows.map((row, index): SemesterNode => {
        const id = `semester-${index + 1}`;
        const old = byId.get(id);
        if (old?.type === "semester" && old.data.row === row) return old;
        return { id, type: "semester", position: old?.position ?? { x: 0, y: index * 186 + 32 }, data: { row }, selectable: false, draggable: true, deletable: false };
      });
      const cards = courses.map((course): CourseNode => {
        const old = byId.get(course.id);
        const data = { course, focused: course.id === focus, related: path.courseIds.has(course.id), shaded: Boolean(focus) && !path.courseIds.has(course.id) };
        if (old?.type === "course" && old.data.course === course && old.data.focused === data.focused && old.data.related === data.related && old.data.shaded === data.shaded && old.selected === data.focused) return old;
        return {
          ...old, id: course.id, type: "course", position: old?.position ?? { x: 156 + ((course.x - 140) / 165) * 192, y: ((course.y - 65) / 178) * 186 + 32 },
          data, selected: data.focused, zIndex: data.focused ? 30 : data.related ? 20 : 0,
          ariaLabel: `${course.code}, ${course.title}. Select to inspect its course path.`, deletable: false,
        };
      });
      return [...semesters, ...cards];
    });
  }, [courses, rows, focus, path, setNodes]);

  const onNodeMouseEnter = useCallback((_: unknown, node: RoadmapNode) => { if (node.type === "course") setHoveredId(node.id); }, []);
  const onNodeMouseLeave = useCallback(() => setHoveredId(null), []);
  const onNodeClick = useCallback((_: unknown, node: RoadmapNode) => { if (node.type === "course") { setFocusedId(node.id); onSelect(node.id); } }, [onSelect]);

  const positions = new Map(nodes.map(node => [node.id, node.position.x]));
  const corequisiteDirections = graphEdges.filter(edge => edge.kind === "corequisite").map(edge => {
    return (positions.get(edge.from) ?? 0) <= (positions.get(edge.to) ?? 0) ? "1" : "0";
  }).join("");
  const edges = useMemo<Edge[]>(() => {
    let corequisiteIndex = 0;
    return graphEdges.map(edge => {
    const id = `${edge.kind}-${edge.from}-${edge.to}`;
    const active = path.connectionIds.has(id);
    const corequisite = edge.kind === "corequisite";
    const leftToRight = !corequisite || corequisiteDirections[corequisiteIndex++] === "1";
    return { sourceHandle: corequisite ? `corequisite-${leftToRight ? "right" : "left"}-source` : "prerequisite-source", targetHandle: corequisite ? `corequisite-${leftToRight ? "left" : "right"}-target` : "prerequisite-target", id, source: edge.from, target: edge.to, type: corequisite ? "smoothstep" : "default", markerEnd: { type: MarkerType.ArrowClosed, color: edge.kind === "corequisite" ? "#aa8954" : "#168873", width: 14, height: 14 }, animated: false, selectable: false, zIndex: active ? 10 : 0, className: `${corequisite ? "rf-corequisite " : ""}${active ? "rf-path-active" : focus ? "rf-path-shaded" : ""}`, style: { stroke: edge.kind === "corequisite" ? "#aa8954" : "#629889", strokeWidth: active ? 2.8 : 1.3 } };
    });
  }, [graphEdges, path, focus, corequisiteDirections]);

  return <div ref={shellRef} className="rf-roadmap" style={{ height: canvasHeight }} onKeyDown={event => { if (event.key === "Escape") clearFocus(); }}>
    <div className="rf-map-help">Drag any course to rearrange · Hover to follow a path · Click to keep it selected</div>
    <ReactFlow<RoadmapNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onNodeClick={onNodeClick}
      onInit={setFlow} onPaneClick={clearFocus} minZoom={.1} maxZoom={1.8}
      proOptions={proOptions} nodesDraggable nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} selectionOnDrag={false} panOnDrag zoomOnPinch zoomOnScroll preventScrolling={false}>
      {courseGrid}
      
    </ReactFlow>
  </div>;
}





