import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesInitialized,
  getViewportForBounds,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsOutSimple } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { GitBranch } from "@phosphor-icons/react/dist/csr/GitBranch";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { Link } from "react-router-dom";
import { useCatalog } from "./CatalogContext";
import { CourseDetail } from "./CourseDetail";
import type { Course } from "./types";
import { getHighlightedPath, type GraphEdge } from "./prerequisiteGraph";
import { CourseStateBadge, courseStateLabels, useCourseState } from "./CourseState";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "./components/ui/native-select";
import "./components/ui/ui.css";
import "./prerequisites.css";


type NodeRelationRole = "selected" | "upstream" | "downstream" | "corequisite" | null;
let lastCoursePreviewClose = 0;

const SUBJECT_GROUPS = [
  { id: "all", label: "All subjects" },
  { id: "node-cmpe", label: "CMPE & CS" },
  { id: "node-math", label: "MATH & ISE" },
  { id: "node-science", label: "Science" },
  { id: "node-engineering", label: "ENGR & EE" },
  { id: "node-general", label: "GE & Core" },
] as const;

type SubjectFilterId = (typeof SUBJECT_GROUPS)[number]["id"];

const nodeCategory = (code: string) => {
  if (code.startsWith("CMPE") || code.startsWith("CS") || code.startsWith("SE")) return "node-cmpe";
  if (code.startsWith("MATH") || code.startsWith("ISE")) return "node-math";
  if (code.startsWith("PHYS") || code.startsWith("BIOL") || code.startsWith("CHEM")) return "node-science";
  if (code.startsWith("ENGR") || code.startsWith("EE")) return "node-engineering";
  return "node-general";
};

const categoryTrackOrder = (code: string) => {
  const cat = nodeCategory(code);
  switch (cat) {
    case "node-math":
      return 0;
    case "node-science":
      return 1;
    case "node-cmpe":
      return 2;
    case "node-engineering":
      return 3;
    default:
      return 4;
  }
};

const categoryShortLabel = (category: string) => {
  switch (category) {
    case "node-cmpe":
      return "Computing";
    case "node-math":
      return "Quantitative";
    case "node-science":
      return "Science";
    case "node-engineering":
      return "Engineering";
    default:
      return "Core";
  }
};

type SemesterLaneData = {
  semesterNumber: number;
  yearNumber: number;
  units: number;
  courseCount: number;
  width: number;
  height: number;
};

type CourseFlowNodeData = {
  course: Course;
  isSelected: boolean;
  isRelated: boolean;
  relationRole: NodeRelationRole;
  isTaken: boolean;
  prereqCount: number;
  unlockCount: number;
  onOpen: (course: Course) => void;
  onEnter: (courseId: string) => void;
  onLeave: (courseId: string) => void;
};

function SemesterLaneNode({ data }: NodeProps<Node<SemesterLaneData>>) {
  const courseLabel = data.courseCount === 1 ? "course" : "courses";

  return (
    <div
      className="semester-band flow-semester-lane is-tb"
      style={{ width: data.width, height: data.height }}
    >
      <header className="flow-semester-header">
        <span className="semester-year-label">Year {data.yearNumber}</span>
        <strong>Semester {data.semesterNumber}</strong>
        <span className="semester-units-pill">
          {data.courseCount} {courseLabel} Â· {data.units} units
        </span>
      </header>
    </div>
  );
}

function CourseFlowNode({ data }: NodeProps<Node<CourseFlowNodeData>>) {
  const {
    course,
    isSelected,
    isRelated,
    relationRole,
    isTaken,
    prereqCount,
    unlockCount,
    onOpen,
    onEnter,
    onLeave,
  } = data;
  const { catalog, courseById } = useCatalog();
  const state = useCourseState(course);
  const category = nodeCategory(course.code);
  const roleClass = relationRole ? ` role-${relationRole}` : "";
  const targetPos = Position.Top;
  const sourcePos = Position.Bottom;
  const coreqTargetPos = Position.Left;
  const coreqSourcePos = Position.Right;
  const cardRef = useRef<HTMLButtonElement>(null);
  const previewTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInstant, setPreviewInstant] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ left: number; top: number } | null>(null);
  const previewId = `course-preview-${course.id}`;
  const prerequisiteCodes = course.prerequisiteCourseIds
    .map((id) => courseById.get(id)?.code)
    .filter((code): code is string => Boolean(code));
  const unlockCodes = catalog.courses
    .filter((item) => item.prerequisiteCourseIds.includes(course.id))
    .map((item) => item.code);
  const corequisiteCodes = catalog.courses
    .filter((item) => item.corequisiteCourseIds.includes(course.id) || course.corequisiteCourseIds.includes(item.id))
    .map((item) => item.code);

  const positionPreview = useCallback(() => {
    const bounds = cardRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const previewWidth = 304;
    const previewHeight = 260;
    const space = 16;
    const left = bounds.right + space + previewWidth <= window.innerWidth - 12
      ? bounds.right + space
      : Math.max(12, bounds.left - previewWidth - space);
    const top = Math.max(12, Math.min(bounds.top, window.innerHeight - previewHeight - 12));
    setPreviewPosition({ left, top });
  }, []);

  const openPreview = useCallback((fromKeyboard = false) => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    onEnter(course.id);
    const instant = fromKeyboard || Date.now() - lastCoursePreviewClose < 650;
    setPreviewInstant(instant);
    const reveal = () => {
      positionPreview();
      setPreviewOpen(true);
      previewTimer.current = null;
    };
    if (instant) reveal();
    else previewTimer.current = window.setTimeout(reveal, 140);
  }, [course.id, onEnter, positionPreview]);

  const closePreview = useCallback(() => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    previewTimer.current = null;
    closeTimer.current = null;
    if (previewOpen) lastCoursePreviewClose = Date.now();
    setPreviewOpen(false);
    onLeave(course.id);
  }, [course.id, onLeave, previewOpen]);

  const scheduleClosePreview = useCallback(() => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    closeTimer.current = window.setTimeout(closePreview, 120);
  }, [closePreview]);

  useEffect(() => {
    if (!previewOpen) return;
    window.addEventListener("scroll", positionPreview, true);
    window.addEventListener("resize", positionPreview);
    return () => {
      window.removeEventListener("scroll", positionPreview, true);
      window.removeEventListener("resize", positionPreview);
    };
  }, [positionPreview, previewOpen]);

  useEffect(() => () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  return (
    <div className="flow-course-node-wrapper" onMouseEnter={() => openPreview()} onMouseLeave={scheduleClosePreview}>
      <Handle
        id="prereq-in"
        type="target"
        position={targetPos}
        className="flow-node-handle"
        isConnectable={false}
      />
      <Handle
        id="coreq-in"
        type="target"
        position={coreqTargetPos}
        className="flow-node-handle is-coreq"
        isConnectable={false}
      />
      <button
        type="button"
        ref={cardRef}
        className={`chart-node ${category} state-${state}${isSelected ? " selected" : ""}${roleClass}${!isSelected && !isRelated ? " graph-muted" : ""}${isTaken ? " is-taken" : ""}`}
        aria-label={`${course.code}: ${course.title}, ${course.units} units, ${courseStateLabels[state]}. View course details`}
        aria-describedby={previewOpen ? previewId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          closePreview();
          onOpen(course);
        }}
        onFocus={() => openPreview(true)}
        onBlur={closePreview}
        onKeyDown={(event) => {
          if (event.key === "Escape") closePreview();
        }}
      >
        <div className="chart-node-top">
          <strong>{course.code}</strong>
          <span className="node-term">
            {course.units} {course.units === 1 ? "unit" : "units"}
          </span>
        </div>
        <p>{course.title}</p>
        <div className="chart-node-context">
          {relationRole === "selected" ? (
            <Badge variant="default" className="node-role-badge">
              Focused
            </Badge>
          ) : relationRole === "upstream" ? (
            <Badge variant="brass" className="node-role-badge">
              Prerequisite
            </Badge>
          ) : relationRole === "downstream" ? (
            <Badge variant="persimmon" className="node-role-badge">
              Unlocks
            </Badge>
          ) : relationRole === "corequisite" ? (
            <Badge variant="secondary" className="node-role-badge">
              Corequisite
            </Badge>
          ) : (
            <span className="node-subject-tag">{categoryShortLabel(category)}</span>
          )}
        </div>

        <div className="chart-node-footer">
          <CourseStateBadge course={course} compact />
          {(prereqCount > 0 || unlockCount > 0) && (
            <span
              className="node-degree-meta"
              title={`${prereqCount} incoming prerequisite(s), ${unlockCount} outgoing dependent(s)`}
            >
              {prereqCount > 0 && <span>{prereqCount} in</span>}
              {prereqCount > 0 && unlockCount > 0 && <span aria-hidden="true">Â·</span>}
              {unlockCount > 0 && <span>{unlockCount} out</span>}
            </span>
          )}
        </div>
      </button>
      <Handle
        id="prereq-out"
        type="source"
        position={sourcePos}
        className="flow-node-handle"
        isConnectable={false}
      />
      <Handle
        id="coreq-out"
        type="source"
        position={coreqSourcePos}
        className="flow-node-handle is-coreq"
        isConnectable={false}
      />
      {previewOpen && previewPosition && createPortal(
        <div
          id={previewId}
          role="tooltip"
          className="course-hover-card prerequisite-course-preview"
          data-instant={previewInstant ? "" : undefined}
          style={previewPosition}
          onMouseEnter={() => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); }}
          onMouseLeave={closePreview}
        >
          <div className="course-hover-card-meta">
            <span>Semester {course.recommendedSemester} Â· {course.units} {course.units === 1 ? "unit" : "units"}</span>
            <span>{courseStateLabels[state]}</span>
          </div>
          <strong>{course.code}</strong>
          <p>{course.title}</p>
          <dl>
            <div><dt>Requires</dt><dd>{prerequisiteCodes.join(", ") || "No mapped course"}</dd></div>
            <div><dt>Unlocks</dt><dd>{unlockCodes.join(", ") || "No mapped course"}</dd></div>
            {corequisiteCodes.length > 0 && <div><dt>Corequisite</dt><dd>{corequisiteCodes.join(", ")}</dd></div>}
          </dl>
          <small>Click for full catalog requirements</small>
        </div>,
        document.body
      )}
    </div>
  );
}

const nodeTypes = {
  semesterLane: SemesterLaneNode,
  courseNode: CourseFlowNode,
};

function PrerequisiteFlowCanvas({
  nodes,
  edges,
  activeCourseId,
  onClearSelection,
}: {
  nodes: Node[];
  edges: Edge[];
  activeCourseId: string | null;
  onClearSelection: () => void;
}) {
  const { fitView, setViewport, getNodesBounds, getNodes, viewportInitialized } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const canvasRef = useRef<HTMLDivElement>(null);
  // Ignore highlight/filter changes: only topology or viewport size resets the overview.
  const layoutKey = nodes.map((node) => `${node.id}:${node.position.x}:${node.position.y}`).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!nodesInitialized || !viewportInitialized || !canvas) return;
    let frame = 0;
    const fitOverview = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        const viewport = getViewportForBounds(getNodesBounds(getNodes()), width, height, 0.05, 1, 0.12);
        void setViewport(viewport, { duration: 0 });
      });
    };
    const observer = new ResizeObserver(fitOverview);
    observer.observe(canvas);
    fitOverview();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [setViewport, getNodesBounds, getNodes, nodesInitialized, viewportInitialized, layoutKey]);

  useEffect(() => {
    if (!activeCourseId || !nodesInitialized) return;
    const timer = window.setTimeout(() => {
      fitView({ nodes: [{ id: activeCourseId }], duration: 240, padding: 0.42, maxZoom: 1 });
    }, 20);
    return () => window.clearTimeout(timer);
  }, [activeCourseId, fitView, nodesInitialized]);

  return (
    <div ref={canvasRef} className="flow-viewport-frame">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12, minZoom: 0.05, maxZoom: 1 }}
      minZoom={0.05}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={false}
      zoomOnScroll
      zoomOnPinch
      zoomOnDoubleClick={false}
      preventScrolling
      proOptions={{ hideAttribution: true }}
      onPaneClick={onClearSelection}
    >
      <Background
        variant={BackgroundVariant.Lines}
        gap={64}
        lineWidth={1}
        color="#dce9e3"
        className="flow-map-grid"
      />
    </ReactFlow>
    </div>
  );
}

export default function PrerequisiteChart() {
  const { catalog, takenCourseIds } = useCatalog();
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [hoveredCourseId, setHoveredCourseId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilterId>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const highlightedCourseId = hoveredCourseId ?? activeCourseId;

  const edges = useMemo(() => {
    const result: GraphEdge[] = [];
    const corequisitePairs = new Set<string>();
    for (const course of catalog.courses) {
      for (const prerequisiteId of course.prerequisiteCourseIds) {
        result.push({ from: prerequisiteId, to: course.id, kind: "prerequisite" });
      }
      for (const corequisiteId of course.corequisiteCourseIds) {
        const pair = [course.id, corequisiteId].sort().join(":");
        if (!corequisitePairs.has(pair)) {
          corequisitePairs.add(pair);
          result.push({ from: course.id, to: corequisiteId, kind: "corequisite" });
        }
      }
    }
    return result;
  }, [catalog.courses]);

  // Barycentric ordering of courses within each semester so prerequisite chains align cleanly
  const semesters = useMemo(() => {
    const slotByCourseId = new Map<string, number>();
    return Array.from({ length: 8 }, (_, index) => {
      const semNumber = index + 1;
      const rawCourses = catalog.courses.filter(
        (course) => course.recommendedSemester === semNumber
      );

      const ordered = [...rawCourses].sort((a, b) => {
        const aPrereqSlots = a.prerequisiteCourseIds
          .map((id) => slotByCourseId.get(id))
          .filter((slot): slot is number => slot !== undefined);
        const bPrereqSlots = b.prerequisiteCourseIds
          .map((id) => slotByCourseId.get(id))
          .filter((slot): slot is number => slot !== undefined);

        const aTrack = categoryTrackOrder(a.code);
        const bTrack = categoryTrackOrder(b.code);

        const aScore = aPrereqSlots.length
          ? aPrereqSlots.reduce((s, v) => s + v, 0) / aPrereqSlots.length * 0.7 + aTrack * 0.3
          : aTrack;
        const bScore = bPrereqSlots.length
          ? bPrereqSlots.reduce((s, v) => s + v, 0) / bPrereqSlots.length * 0.7 + bTrack * 0.3
          : bTrack;

        if (Math.abs(aScore - bScore) > 0.05) return aScore - bScore;
        return a.code.localeCompare(b.code);
      });

      ordered.forEach((course, idx) => {
        slotByCourseId.set(course.id, idx);
      });

      const units = ordered.reduce((sum, course) => sum + course.units, 0);
      return {
        number: semNumber,
        courses: ordered,
        units,
      };
    });
  }, [catalog.courses]);

  const degreeCounts = useMemo(() => {
    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    for (const edge of edges) {
      if (edge.kind === "prerequisite") {
        incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
        outgoingCount.set(edge.from, (outgoingCount.get(edge.from) ?? 0) + 1);
      } else {
        incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
        incomingCount.set(edge.from, (incomingCount.get(edge.from) ?? 0) + 1);
      }
    }
    return { incomingCount, outgoingCount };
  }, [edges]);

  const gatewayCourses = useMemo(() => {
    return [...catalog.courses]
      .filter((course) => (degreeCounts.outgoingCount.get(course.id) ?? 0) > 0)
      .sort(
        (a, b) =>
          (degreeCounts.outgoingCount.get(b.id) ?? 0) -
            (degreeCounts.outgoingCount.get(a.id) ?? 0) ||
          a.recommendedSemester - b.recommendedSemester
      )
      .slice(0, 5);
  }, [catalog.courses, degreeCounts.outgoingCount]);

  const highlightedPath = useMemo(() => getHighlightedPath(highlightedCourseId, edges), [highlightedCourseId, edges]);

  const handleOpenCourse = useCallback((course: Course) => {
    setSelectedCourse(course);
  }, []);

  const handleEnterCourse = useCallback((courseId: string) => {
    setHoveredCourseId(courseId);
  }, []);

  const handleLeaveCourse = useCallback((courseId: string) => {
    setHoveredCourseId((current) => current === courseId ? null : current);
  }, []);

  // Fixed semester rows preserve topology while focus changes only visual emphasis.
  const flowNodes = useMemo((): Node[] => {
    const nodes: Node[] = [];
    const nodeWidth = 236;
    const columnGap = 24;
    const labelWidth = 154;
    const rowHeight = 156;
    const rowGap = 36;
    const maxCount = Math.max(5, ...semesters.map((semester) => semester.courses.length));
    const laneWidth = labelWidth + 32 + maxCount * nodeWidth + (maxCount - 1) * columnGap + 24;

    semesters.forEach((semester, semesterIndex) => {
      const laneY = semesterIndex * (rowHeight + rowGap);
      const rowInset = (maxCount - semester.courses.length) * (nodeWidth + columnGap) / 2;
      nodes.push({
        id: `semester-lane-${semester.number}`,
        type: "semesterLane",
        position: { x: 0, y: laneY },
        selectable: false,
        draggable: false,
        zIndex: 0,
        data: {
          semesterNumber: semester.number,
          yearNumber: Math.ceil(semester.number / 2),
          units: semester.units,
          courseCount: semester.courses.length,
          width: laneWidth,
          height: rowHeight,
        },
      });

      semester.courses.forEach((course, courseIndex) => {
        const matchesSubject = subjectFilter === "all" || nodeCategory(course.code) === subjectFilter;
        const isRelated = matchesSubject && (!highlightedCourseId || highlightedPath.courseIds.has(course.id));
        let relationRole: NodeRelationRole = null;
        if (highlightedCourseId === course.id) relationRole = "selected";
        else if (highlightedPath.upstreamIds.has(course.id)) relationRole = "upstream";
        else if (highlightedPath.downstreamIds.has(course.id)) relationRole = "downstream";
        else if (highlightedPath.corequisiteIds.has(course.id)) relationRole = "corequisite";
        nodes.push({
          id: course.id,
          type: "courseNode",
          position: { x: labelWidth + 24 + rowInset + courseIndex * (nodeWidth + columnGap), y: laneY + 17 },
          zIndex: relationRole ? 10 : 5,
          data: {
            course,
            isSelected: highlightedCourseId === course.id,
            isRelated,
            relationRole,
            isTaken: takenCourseIds.has(course.id),
            prereqCount: degreeCounts.incomingCount.get(course.id) ?? 0,
            unlockCount: degreeCounts.outgoingCount.get(course.id) ?? 0,
            onOpen: handleOpenCourse,
            onEnter: handleEnterCourse,
            onLeave: handleLeaveCourse,
          },
        });
      });
    });
    return nodes;
  }, [semesters, subjectFilter, highlightedCourseId, highlightedPath, takenCourseIds, degreeCounts, handleOpenCourse, handleEnterCourse, handleLeaveCourse]);

  // Build React Flow edges with direction-aware color, animation, and z-index
  const flowEdges = useMemo((): Edge[] => {
    return edges.map((edge) => {
      const key = `${edge.kind}-${edge.from}-${edge.to}`;
      const isActive = highlightedPath.connectionIds.has(key);
      const isUpstream = highlightedPath.upstreamEdges.has(key);
      const isDownstream = highlightedPath.downstreamEdges.has(key);
      const isCoreq = edge.kind === "corequisite";

      let strokeColor = isCoreq ? "#829a90" : "#b3cbc1";
      let strokeWidth = isCoreq ? 1.5 : 1.4;
      let opacity = highlightedCourseId ? 0.12 : 0.78;
      let zIndex = 2;

      if (isActive) {
        opacity = 1;
        strokeWidth = 2.5;
        zIndex = 4;
        if (isUpstream) {
          strokeColor = "#a27c3a";
        } else if (isDownstream) {
          strokeColor = "#168873";
        } else {
          strokeColor = "#64756c";
        }
      }

      const directionClass = isActive
        ? isUpstream
          ? " active-upstream"
          : isDownstream
          ? " active-downstream"
          : " active-corequisite"
        : "";

      return {
        id: key,
        source: edge.from,
        target: edge.to,
        sourceHandle: isCoreq ? "coreq-out" : "prereq-out",
        targetHandle: isCoreq ? "coreq-in" : "prereq-in",
        type: "default",
        zIndex,
        className: `connection ${edge.kind}${
          highlightedCourseId ? (isActive ? ` active${directionClass}` : " muted") : ""
        }`,
        style: {
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: "round",
          opacity,
          strokeDasharray: isCoreq ? "6 4" : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: strokeColor,
        },
      };
    });
  }, [edges, highlightedCourseId, highlightedPath]);

  const focusedCourse = highlightedCourseId
    ? catalog.courses.find((course) => course.id === highlightedCourseId)
    : undefined;

  const incoming = focusedCourse
    ? edges
        .filter((edge) => edge.kind === "prerequisite" && edge.to === focusedCourse.id)
        .map((edge) => catalog.courses.find((course) => course.id === edge.from))
        .filter((course): course is Course => Boolean(course))
    : [];

  const outgoing = focusedCourse
    ? edges
        .filter((edge) => edge.kind === "prerequisite" && edge.from === focusedCourse.id)
        .map((edge) => catalog.courses.find((course) => course.id === edge.to))
        .filter((course): course is Course => Boolean(course))
    : [];

  const corequisites = focusedCourse
    ? edges
        .filter((edge) => edge.kind === "corequisite" && (edge.from === focusedCourse.id || edge.to === focusedCourse.id))
        .map((edge) => catalog.courses.find((course) => course.id === (edge.from === focusedCourse.id ? edge.to : edge.from)))
        .filter((course): course is Course => Boolean(course))
    : [];

  return (
    <main className="chart-page prerequisite-workspace">
      <div className="prerequisite-heading">
        <div>
          <h1>Prerequisite explorer</h1>
          <p>Follow a course backward to what it requires, then forward to what it opens.</p>
        </div>
        <div className="prerequisite-heading-aside">
          <span>{catalog.name} · {catalog.catalogYear}</span>
          <span>{catalog.courses.length} courses · 8 recommended semesters</span>
        </div>
      </div>

      <section className="prerequisite-atlas" aria-label="Interactive prerequisite map">
        <div className="atlas-controls">
          <label className="atlas-search">
            <MagnifyingGlass size={17} aria-hidden="true" />
            <span className="sr-only">Find and focus a course</span>
            <NativeSelect
              aria-label="Find and focus a course"
              value={activeCourseId ?? ""}
              onChange={(event) => setActiveCourseId(event.target.value || null)}
            >
              <NativeSelectOption value="">Find a course on the map</NativeSelectOption>
              {semesters.map((semester) => (
                <NativeSelectOptGroup key={semester.number} label={`Semester ${semester.number}`}>
                  {semester.courses.map((course) => (
                    <NativeSelectOption value={course.id} key={course.id}>{course.code} · {course.title}</NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </label>
          <div className="atlas-filter-group" role="group" aria-label="Filter map by subject">
            {SUBJECT_GROUPS.map((group) => (
              <Button
                key={group.id}
                size="xs"
                variant="ghost"
                aria-pressed={subjectFilter === group.id}
                onClick={() => setSubjectFilter(group.id)}
              >{group.label}</Button>
            ))}
          </div>
          {(activeCourseId || subjectFilter !== "all") && (
            <Button size="xs" variant="ghost" className="atlas-reset" onClick={() => { setActiveCourseId(null); setSubjectFilter("all"); }}>
              <X size={14} aria-hidden="true" /> Clear
            </Button>
          )}
        </div>

        <div className="atlas-stage">
          <div className="atlas-stage-caption"><span>COURSE MAP</span><span>Scroll or pinch to zoom · Drag to move</span></div>
          <div className="chart-scroll flow-chart-shell">
            <div className="prerequisite-chart flow-chart-container">
              <ReactFlowProvider>
                <PrerequisiteFlowCanvas
                  nodes={flowNodes}
                  edges={flowEdges}
                  activeCourseId={activeCourseId}
                  onClearSelection={() => setActiveCourseId(null)}
                />
              </ReactFlowProvider>
            </div>
          </div>
          <div className="atlas-stage-footer">
            <div className="atlas-legend" aria-label="Map legend">
              <span><i className="legend-line upstream" /> Prerequisite</span>
              <span><i className="legend-line downstream" /> Unlocks</span>
              <span><i className="legend-line dashed" /> Corequisite</span>
              <span><i className="legend-status-dot open" /> Open</span>
              <span><i className="legend-status-dot closed" /> Closed</span>
              <span><i className="legend-taken" /> Completed</span>
            </div>
            <span className="atlas-stage-hint">Click a course for requirements and planning</span>
          </div>
        </div>
      </section>

      <section className={`atlas-reading ${focusedCourse ? "has-focus" : ""}`} aria-live="polite" aria-label="Course relationships">
        {focusedCourse ? (
          <>
            <div className="atlas-reading-course">
              <div className="atlas-reading-meta"><span>SEMESTER {focusedCourse.recommendedSemester}</span><span>{focusedCourse.units} {focusedCourse.units === 1 ? "UNIT" : "UNITS"}</span><CourseStateBadge course={focusedCourse} compact /></div>
              <h2>{focusedCourse.code}</h2>
              <p>{focusedCourse.title}</p>
              <Button variant="default" size="sm" onClick={() => setSelectedCourse(focusedCourse)}>Open course details <ArrowsOutSimple size={15} aria-hidden="true" /></Button>
            </div>
            <div className={`atlas-reading-paths${corequisites.length ? " has-corequisites" : ""}`}>
              <div><h3>Comes before</h3><p>{incoming.length ? "Courses linked into this course" : "No mapped course prerequisites"}</p><div className="atlas-related-courses">{incoming.map((course) => <button key={course.id} type="button" onClick={() => setActiveCourseId(course.id)}>{course.code}<ArrowRight size={13} aria-hidden="true" /></button>)}</div></div>
              <div><h3>Opens next</h3><p>{outgoing.length ? "Courses linked after this course" : "No mapped downstream courses"}</p><div className="atlas-related-courses">{outgoing.map((course) => <button key={course.id} type="button" onClick={() => setActiveCourseId(course.id)}>{course.code}<ArrowRight size={13} aria-hidden="true" /></button>)}</div></div>
              {corequisites.length > 0 && <div><h3>Alongside</h3><p>Courses recorded as corequisites</p><div className="atlas-related-courses">{corequisites.map((course) => <button key={course.id} type="button" onClick={() => setActiveCourseId(course.id)}>{course.code}<ArrowRight size={13} aria-hidden="true" /></button>)}</div></div>}
            </div>
          </>
        ) : (
          <>
            <div className="atlas-reading-course"><h2>Choose a course.<br />See its path.</h2><p>Hover or focus a card to trace every connected prerequisite and unlocked course.</p></div>
            <div className="atlas-gateways"><span>GOOD PLACES TO START</span><div>{gatewayCourses.map((course) => <button key={course.id} type="button" onClick={() => setActiveCourseId(course.id)}><strong>{course.code}</strong><span>{course.title}</span><ArrowRight size={16} aria-hidden="true" /></button>)}</div></div>
          </>
        )}
      </section>

      <div className="atlas-footnote"><GitBranch size={18} aria-hidden="true" /><p>Only relationships between courses on the 2026–2027 roadmap are drawn. Placement, minimum grade, major standing, GE, and external course conditions remain in each course’s catalog detail. {catalog.abbreviation === "BSSE" && "For Software Engineering, MATH 33LA or MATH 142 and MATH 161A or ISE 130 are alternatives; check course details."}</p><Link to="/planner">Open semester planner <ArrowRight size={15} aria-hidden="true" /></Link></div>
      {selectedCourse && <CourseDetail course={selectedCourse} onClose={() => setSelectedCourse(null)} />}
    </main>
  );
}
