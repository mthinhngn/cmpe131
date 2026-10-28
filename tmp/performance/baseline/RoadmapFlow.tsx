import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function CourseCard({ data }: NodeProps<CourseNode>) {
  const { course, focused, related, shaded } = data;
  return <>
    <article className={`rf-course-card${focused ? " is-focused" : ""}${related ? " is-related" : ""}${shaded ? " is-shaded" : ""}${course.status === "choice" ? " is-choice" : ""}`}>
      <Handle id="prerequisite-target" type="target" position={Position.Top} isConnectable={false} />
      <Handle id="corequisite-left-source" type="source" position={Position.Left} isConnectable={false} />
      <Handle id="corequisite-right-source" type="source" position={Position.Right} isConnectable={false} />
      <Handle id="corequisite-left-target" type="target" position={Position.Left} isConnectable={false} />
      <Handle id="corequisite-right-target" type="target" position={Position.Right} isConnectable={false} />
      <header><strong>{course.code}</strong><span>{course.credits} u</span></header>
      <p>{course.title}</p>
      <footer><i />{roadmapStatusLabels[course.status as RoadmapStatus] ?? "Check requirements"}</footer>
      <Handle id="prerequisite-source" type="source" position={Position.Bottom} isConnectable={false} />
    </article>
  </>;
}

function SemesterLabel({ data }: NodeProps<SemesterNode>) {
  return <div className="rf-semester-label"><small>{data.row.year}</small><strong>{data.row.term} semester</strong><span>{data.row.count} requirements</span><span>{data.row.credits} units</span></div>;
}

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
  const graphEdges = useMemo<GraphEdge[]>(() => courses.flatMap(course => [
    ...course.prerequisites.map(from => ({ from, to: course.id, kind: "prerequisite" as const })),
    ...(course.corequisites ?? []).filter(from => !courses.find(item => item.id === from)?.corequisites?.includes(course.id) || from < course.id).map(from => ({ from, to: course.id, kind: "corequisite" as const })),
  ]), [courses]);
  const focus = hoveredId ?? (query.trim() && query !== dismissedQuery ? selectedId : focusedId);
  const clearFocus = useCallback(() => { setHoveredId(null); setFocusedId(null); setDismissedQuery(query); }, [query]);
  const path = useMemo(() => getHighlightedPath(focus, graphEdges), [focus, graphEdges]);

  useEffect(() => {
    setNodes(previous => [
      ...rows.map((row, index): SemesterNode => ({ id: `semester-${index + 1}`, type: "semester", position: previous.find(node => node.id === `semester-${index + 1}`)?.position ?? { x: 0, y: index * 186 + 32 }, data: { row }, selectable: false, draggable: true, deletable: false })),
      ...courses.map((course): CourseNode => ({
        id: course.id, type: "course", position: previous.find(node => node.id === course.id)?.position ?? { x: 156 + ((course.x - 140) / 165) * 192, y: ((course.y - 65) / 178) * 186 + 32 },
        data: { course, focused: course.id === focus, related: path.courseIds.has(course.id), shaded: Boolean(focus) && !path.courseIds.has(course.id) },
        selected: course.id === focus, zIndex: course.id === focus ? 30 : path.courseIds.has(course.id) ? 20 : 0,
        ariaLabel: `${course.code}, ${course.title}. Select to inspect its course path.`, deletable: false,
      })),
    ]);
  }, [courses, rows, focus, path, setNodes, clearFocus]);

  const edges = useMemo<Edge[]>(() => graphEdges.map(edge => {
    const id = `${edge.kind}-${edge.from}-${edge.to}`;
    const active = path.connectionIds.has(id);
    const corequisite = edge.kind === "corequisite";
    const leftToRight = (nodes.find(node => node.id === edge.from)?.position.x ?? 0) <= (nodes.find(node => node.id === edge.to)?.position.x ?? 0);
    return { sourceHandle: corequisite ? `corequisite-${leftToRight ? "right" : "left"}-source` : "prerequisite-source", targetHandle: corequisite ? `corequisite-${leftToRight ? "left" : "right"}-target` : "prerequisite-target", id, source: edge.from, target: edge.to, type: corequisite ? "smoothstep" : "default", markerEnd: { type: MarkerType.ArrowClosed, color: edge.kind === "corequisite" ? "#aa8954" : "#168873", width: 14, height: 14 }, animated: false, selectable: false, zIndex: active ? 10 : 0, className: `${corequisite ? "rf-corequisite " : ""}${active ? "rf-path-active" : focus ? "rf-path-shaded" : ""}`, style: { stroke: edge.kind === "corequisite" ? "#aa8954" : "#629889", strokeWidth: active ? 2.8 : 1.3 } };
  }), [graphEdges, path, focus, nodes]);

  return <div ref={shellRef} className="rf-roadmap" style={{ height: canvasHeight }} onKeyDown={event => { if (event.key === "Escape") clearFocus(); }}>
    <div className="rf-map-help">Drag any course to rearrange · Hover to follow a path · Click to keep it selected</div>
    <ReactFlow<RoadmapNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
      onNodeMouseEnter={(_, node) => { if (node.type === "course") setHoveredId(node.id); }}
      onNodeMouseLeave={() => setHoveredId(null)}
      onNodeClick={(_, node) => { if (node.type === "course") { setFocusedId(node.id); onSelect(node.id); } }}
      onInit={setFlow} onPaneClick={clearFocus} minZoom={.1} maxZoom={1.8}
      proOptions={{ hideAttribution: true }} nodesDraggable nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} selectionOnDrag={false} panOnDrag zoomOnPinch zoomOnScroll preventScrolling={false}>
      <Background variant={BackgroundVariant.Lines} gap={26} color="#e5eeea" />
      
    </ReactFlow>
  </div>;
}





