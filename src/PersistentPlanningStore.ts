import { PlanningStore, type ActionResult, type Edit, type Plan, type Proposal, type State, type PlanSlot } from "./planning";
import { computerEngineeringCatalog } from "./data";
import { apiEndpoint } from "./api";
import { staticPreview } from "./static-preview";
type ViewState = State & { storageStatus: "loading" | "saved" | "saving" | "error"; storageError: string; hydrated: boolean };
type Command = { requestId: string; version: number; kind: string; args: object; catalogVersion?: string };
export type PlanCoordinator = (kind: string, args: Record<string, any>, save: (kind: string, args: object) => Promise<ActionResult>) => Promise<ActionResult>;
class WorkspaceError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const guestDraft = (state: State) => { const { catalog: _catalog, ...draft } = state; return draft; };
const guestKey = "course-radar-guest-tab-v1";
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
  coordinatePlan(coordinator: PlanCoordinator | null) { this.coordinator = coordinator; }
  getState = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private emit(patch: Partial<ViewState> = {}) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
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
    this.emit({ ...payload.state, undoRevision: payload.state.undoRevision, undoRequestId: payload.state.undoRequestId, storageStatus: hydrated ? "saved" : "loading", storageError: "", hydrated });
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
  command(kind: string, args: object = {}): Promise<ActionResult> {
    if (staticPreview) return Promise.resolve({ status: "unchanged", message: "Preview controls are inactive." });
    const save = (nextKind: string, nextArgs: object) => this.enqueue(nextKind, nextArgs,
      kind === "agentAction" ? (args as { action: { action_id: string } }).action.action_id : undefined);
    if (this.coordinator && ["setPlan", "removePlan", "agentAction"].includes(kind)) return this.coordinator(kind, args, save);
    return save(kind, args);
  }
  private enqueue(kind: string, args: object, requestId?: string): Promise<ActionResult> {
    const task = async () => {
      if (["loading", "error"].includes(this.state.storageStatus)) return { status: "error", message: this.state.storageError || "Wait for the saved workspace to load." } as ActionResult;
      return this.execute({ requestId: requestId ?? crypto.randomUUID(), version: this.version, kind, args, catalogVersion: this.state.catalog.dataVersion });
    };
    const result = this.queue.then(task); this.queue = result.catch(() => {}); return result;
  }
  private async execute(command: Command): Promise<ActionResult> {
    this.pending = command; this.emit({ storageStatus: "saving" });
    try {
      const before = guestDraft(this.engine.getState());
      const response = await this.request("workspace/operations", this.account ? command : { ...command, guestState: before, undoState: this.guestUndo });
      if (!this.account && response.state.revision !== before.revision) this.guestUndo = command.kind === "undo" ? undefined : before;
      this.accept(response); this.pending = undefined; return response.result;
    }
    catch (error) {
      const message = this.errorText(error);
      if (error instanceof WorkspaceError && error.status === 400) { this.pending = undefined; this.emit({ storageStatus: "saved", storageError: "" }); }
      else this.emit({ storageStatus: "error", storageError: message });
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
