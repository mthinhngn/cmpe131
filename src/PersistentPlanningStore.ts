import { PlanningStore, type ActionResult, type Edit, type Plan, type Proposal, type State, type PlanSlot } from "./planning";
import { computerEngineeringCatalog } from "./data";
import { apiEndpoint } from "./api";
import { staticPreview } from "./static-preview";
type ViewState = State & { storageStatus: "loading" | "saved" | "saving" | "error"; storageError: string; hydrated: boolean };
type Command = { requestId: string; version: number; kind: string; args: object; catalogVersion?: string };
export type PlanPreview = (store: PlanningStore) => void;
export type PlanCoordinator = (kind: string, args: Record<string, any>, save: (kind: string, args: object, preview?: PlanPreview) => Promise<ActionResult>) => Promise<ActionResult>;
class WorkspaceError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const guestDraft = (state: State) => { const { catalog: _catalog, ...draft } = state; return draft; };
const guestKey = "course-radar-guest-tab-v1";
type QueuedChange = { kind: string; args: Record<string, any>; preview?: (store: PlanningStore) => void };
// Course changes the browser can preview with the shared planning engine; everything else waits for the server.
const PREVIEWABLE = new Set(["setPlan", "removePlan", "moveCompletedCourse", "toggleTakenCourse", "chooseRequirement"]);
function previewChange(store: PlanningStore, { kind, args, preview }: QueuedChange) {
  if (preview) preview(store);
  else if (kind === "setPlan") store.setPlan(args.id, args.semester, args.status ?? "planned");
  else if (kind === "removePlan") store.removePlan(args.id);
  else if (kind === "moveCompletedCourse") store.moveCompletedCourse(args.id, args.semester);
  else if (kind === "toggleTakenCourse") store.toggleTakenCourse(args.id);
  else if (kind === "chooseRequirement") store.chooseRequirement(args.requirementId, args.id);
}
export class PersistentPlanningStore {
  constructor(private readonly account: string | null = null) {}
  private engine = new PlanningStore("computer-engineering", computerEngineeringCatalog);
  private state: ViewState = { ...this.engine.getState(), storageStatus: "loading", storageError: "", hydrated: false };
  private listeners = new Set<() => void>();
  private version = 0;
  private guestUndo?: Omit<State, "catalog">;
  private queue: Promise<unknown> = Promise.resolve();
  private loading?: Promise<void>;
  private pending?: Command;
  private coordinator: PlanCoordinator | null = null;
  // Changes shown immediately while they wait in the save queue, oldest first.
  private queued: QueuedChange[] = [];
  coordinatePlan(coordinator: PlanCoordinator | null) { this.coordinator = coordinator; }
  getState = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit(patch: Partial<ViewState> = {}) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  /** Last saved state with every queued change replayed on top. A change that no longer applies is skipped; the server decides. */
  private shown(): State {
    const saved = this.engine.getState();
    if (!this.queued.length) return saved;
    const preview = new PlanningStore(saved.program, saved.catalog);
    preview.restore(saved);
    for (const change of this.queued) { try { previewChange(preview, change); } catch { /* The queued save will report its own error. */ } }
    return preview.getState();
  }
  private settle(change?: QueuedChange) {
    const index = change ? this.queued.indexOf(change) : -1;
    if (index < 0) return false;
    this.queued.splice(index, 1);
    return true;
  }
  /** True while changes are still waiting to reach the server. */
  get hasQueuedChanges() { return this.queued.length > 0; }
  private async request(path: string, body?: unknown) {
    const response = await fetch(apiEndpoint(path), { credentials: "include", cache: "no-store", method: body ? "POST" : "GET", headers: { "X-Workspace-User": this.account || "guest", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(75000) });
    let payload;
    try { payload = await response.json(); } catch { throw new Error(`Workspace request failed (${response.status}). Reload to check saved state.`); }
    if (!response.ok) throw new WorkspaceError(typeof payload.message === "string" ? payload.message : `Workspace request failed (${response.status}).`, response.status);
    return payload;
  }
  private accept(payload: { state: State; version: number }, hydrated = true) {
    if (!payload.state?.catalog?.courses || !Number.isInteger(payload.version)) throw new Error("Invalid saved workspace response.");
    this.version = payload.version; this.engine.restore(payload.state);
    if (!this.account) {
      // Temporary tab state keeps navigation usable; no guest record reaches PostgreSQL.
      try { sessionStorage.setItem(guestKey, JSON.stringify(guestDraft(payload.state))); } catch { /* Storage-disabled browsers keep the current page in memory. */ }
    }
    this.emit({ ...this.shown(), undoRevision: payload.state.undoRevision, undoRequestId: payload.state.undoRequestId, storageStatus: hydrated ? "saved" : "loading", storageError: "", hydrated });
  }
  load = () => {
    if (staticPreview) {
      this.emit({ ...this.engine.getState(), storageStatus: "saved", storageError: "", hydrated: true });
      return Promise.resolve();
    }
    if (this.loading) return this.loading;
    this.loading = (async () => {
      this.emit({ storageStatus: "loading", storageError: "" });
      try {
        if (!this.account && this.state.hydrated) { this.emit({ storageStatus: "saved" }); return; }
        let draft;
        if (!this.account) { try { draft = JSON.parse(sessionStorage.getItem(guestKey) || "null") ?? undefined; } catch { /* Start a fresh guest visit when tab storage is unavailable. */ } }
        const payload = await this.request("workspace", draft ? { guestState: { ...draft, undoRevision: undefined, undoRequestId: undefined } } : {});
        this.accept(payload); this.pending = undefined;
      }
      catch (error) { this.emit({ storageStatus: "error", storageError: this.errorText(error) }); }
      finally { this.loading = undefined; }
    })();
    return this.loading;
  };
  private errorText(error: unknown) { return error instanceof Error ? error.message : "Database save failed. Reload to check saved state."; }
  /** `preview` shows a change the browser cannot derive alone (such as chosen sections) until its save lands. */
  command(kind: string, args: object = {}, preview?: PlanPreview): Promise<ActionResult> {
    if (staticPreview) return Promise.resolve({ status: "unchanged", message: "Preview controls are inactive." });
    // Show previewable course changes at once; the queue then saves them one at a time, in order.
    const change: QueuedChange | undefined = (preview || PREVIEWABLE.has(kind)) && this.state.hydrated && !["loading", "error"].includes(this.state.storageStatus) ? { kind, args: args as Record<string, any>, preview } : undefined;
    if (change) { this.queued.push(change); this.emit(this.shown()); }
    const save = (nextKind: string, nextArgs: object, nextPreview?: PlanPreview) => {
      // A coordinator can add what it learned (chosen sections) to the queued preview before saving.
      const extra: QueuedChange | undefined = nextPreview && this.state.hydrated ? { kind: nextKind, args: nextArgs as Record<string, any>, preview: nextPreview } : undefined;
      if (extra) { this.queued.push(extra); this.emit(this.shown()); }
      return this.enqueue(nextKind, nextArgs, kind === "agentAction" ? (args as { action: { action_id: string } }).action.action_id : undefined, change, extra)
        .finally(() => { if (this.settle(extra)) this.emit(this.shown()); });
    };
    const done = this.coordinator && ["setPlan", "removePlan", "agentAction"].includes(kind) ? this.coordinator(kind, args, save) : save(kind, args);
    // A coordinator may decline without saving; drop that preview too.
    return done.finally(() => { if (this.settle(change)) this.emit(this.shown()); });
  }
  private enqueue(kind: string, args: object, requestId?: string, change?: QueuedChange, extra?: QueuedChange): Promise<ActionResult> {
    const task = async () => {
      if (["loading", "error"].includes(this.state.storageStatus)) return { status: "error", message: this.state.storageError || "Wait for the saved workspace to load." } as ActionResult;
      return this.execute({ requestId: requestId ?? crypto.randomUUID(), version: this.version, kind, args, catalogVersion: this.state.catalog.dataVersion }, change, extra);
    };
    const result = this.queue.then(task); this.queue = result.catch(() => {}); return result;
  }
  private async execute(command: Command, change?: QueuedChange, extra?: QueuedChange): Promise<ActionResult> {
    this.pending = command; this.emit({ storageStatus: "saving" });
    try {
      const before = guestDraft(this.engine.getState());
      const response = await this.request("workspace/operations", this.account ? command : { ...command, guestState: before, undoState: this.guestUndo });
      if (!this.account && response.state.revision !== before.revision) this.guestUndo = command.kind === "undo" ? undefined : before;
      // The saved state now contains this change; stop replaying it before showing the result.
      this.settle(change); this.settle(extra);
      this.accept(response); this.pending = undefined; return response.result;
    }
    catch (error) {
      const message = this.errorText(error);
      this.settle(change); this.settle(extra);
      if (error instanceof WorkspaceError && error.status === 400) { this.pending = undefined; this.emit({ ...this.shown(), storageStatus: "saved", storageError: "" }); }
      else this.emit({ ...this.shown(), storageStatus: "error", storageError: message });
      return { status: "error", message };
    }
  }
  retry = async () => this.pending ? this.execute(this.pending) : this.load();
  agentAction(action: import("./agent-client").BrowserAction, browserFresh: boolean) {
    return this.command("agentAction", { action, browserFresh });
  }
  setStartingTerm(term: string | null) { return this.command("setStartingTerm", { term }); }
  get plans() { return this.state.plans[this.state.program] ?? {}; }
  get terms() { return this.state.terms[this.state.program] ?? {}; }
  get semesterCount() { return this.engine.semesterCount; }
  get termOrder() { return this.engine.termOrder; }
  get semesterSlots() { return this.engine.semesterSlots; }
  get nextSemester() { return this.engine.nextSemester; }
  snapshot() { return this.engine.snapshot(); }
  setPlan(id: string, semester: PlanSlot, status: Plan["status"] = "planned") { return this.command("setPlan", { id, semester, status }); }
  removePlan(id: string) { return this.command("removePlan", { id }); }
  moveCompletedCourse(id: string, semester: PlanSlot) { return this.command("moveCompletedCourse", { id, semester }); }
  moveSemester(from: PlanSlot, to: PlanSlot) { return this.command("moveSemester", { from, to }); }
  toggleTakenCourse(id: string) { return this.command("toggleTakenCourse", { id }); }
  addSemester() { return this.command("addSemester"); }
  addNamedTerm(term: string) { return this.command("addNamedTerm", { term }); }
  removeSemester(semester: PlanSlot) { return this.command("removeSemester", { semester }); }
  removeLastSemester() { return this.command("removeLastSemester"); }
  setTerm(semester: number, term: string) { return this.command("setTerm", { semester, term }); }
  selectProgram(program: string) { return this.command("selectProgram", { program }); }
  apply(proposal: Proposal, reviewed = false) { return this.command("apply", { proposal, reviewed }); }
  undo(_edits: Edit[], revision: number) { return this.command("undo", { revision }); }
  undoLast() { return this.command("undo", { revision: this.state.revision }); }
  saveView(semester: PlanSlot, selectedCourseId: string | null) { return this.command("view", { semester, selectedCourseId }); }
}
