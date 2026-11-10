import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { GroupImperativeHandle, Layout } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";

export type ExplorerView = "split" | "catalog" | "week";
const STORAGE_KEY = "course-radar-explorer-graphite-split-v1";
const DEFAULT_LAYOUT: Layout = { catalog: 27.6, week: 72.4 };

function readLayout(): Layout {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Layout | null;
    if (value && Number.isFinite(value.catalog) && Number.isFinite(value.week) && value.catalog > 0 && value.catalog < 100 && Math.abs(value.catalog + value.week - 100) < .1) return value;
  } catch { /* A blocked or invalid preference never blocks course planning. */ }
  return DEFAULT_LAYOUT;
}

export function ExplorerPanels({ view, onViewChange, catalog, week }: {
  view: ExplorerView;
  onViewChange: (view: ExplorerView) => void;
  catalog: ReactNode;
  week: ReactNode;
}) {
  const group = useRef<GroupImperativeHandle | null>(null);
  const workbench = useRef<HTMLDivElement>(null);
  const previousView = useRef(view);
  const dragChangedView = useRef(false);
  const [visibleView, setVisibleView] = useState<ExplorerView>(view);
  const [initialLayout] = useState(readLayout);
  const lastSplit = useRef(initialLayout);
  useLayoutEffect(() => {
    if (dragChangedView.current) {
      dragChangedView.current = false;
      previousView.current = view;
      return;
    }
    previousView.current = view;
    // Let the panel registry apply the new constraints before restoring a layout.
    const frame = requestAnimationFrame(() => {
      group.current?.setLayout(view === "catalog" ? { catalog: 100, week: 0 } : view === "week" ? { catalog: 0, week: 100 } : lastSplit.current);

    });
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const resetSplit = () => {
    lastSplit.current = DEFAULT_LAYOUT;
    onViewChange("split");
    requestAnimationFrame(() => group.current?.setLayout(DEFAULT_LAYOUT));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LAYOUT)); } catch { /* Optional preference. */ }
  };

  return <>
    <div ref={workbench} className={`cx-workbench cx-desktop-workbench cx-layout-${visibleView}`}>
      <ResizablePanelGroup className="cx-panel-group" style={{ overflow: "visible", height: "max(640px, calc(100vh - 180px))", flex: "none" }} groupRef={group} defaultLayout={initialLayout} orientation="horizontal" resizeTargetMinimumSize={{ fine: 48, coarse: 48 }} onLayoutChange={layout => {
        setVisibleView(layout.catalog <= .01 ? "week" : layout.week <= .01 ? "catalog" : "split");
      }} onLayoutChanged={(layout, meta) => {
        if (!meta.isUserInteraction) return;
        // Snap the last few pixels at release, so the edge never leaves a sliver.
        const nextView = layout.catalog <= 3 ? "week" : layout.week <= 3 ? "catalog" : "split";
        if (nextView !== "split") group.current?.setLayout(nextView === "week" ? { catalog: 0, week: 100 } : { catalog: 100, week: 0 });
        if (nextView !== view) {
          dragChangedView.current = true;
          onViewChange(nextView);
        }
        if (nextView !== "split") return;
        const requested = meta.requestedLayout ?? layout;
        lastSplit.current = requested;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(requested)); } catch { /* Optional preference. */ }
      }}>
        <ResizablePanel id="catalog" minSize={0} className="cx-resizable-panel" style={{ overflow: "hidden" }}><div hidden={visibleView === "week"}>{catalog}</div></ResizablePanel>
        <ResizableHandle disableDoubleClick aria-label="Resize catalog and schedule" title="Drag to either edge · Arrow keys to adjust · Double-click to reset" onDoubleClick={resetSplit} />
        <ResizablePanel id="week" minSize={0} className="cx-resizable-panel" style={{ overflow: "hidden" }}><div hidden={visibleView === "catalog"}><div className="cx-week-frame">{week}</div></div></ResizablePanel>
      </ResizablePanelGroup>

    </div>
  </>;
}
