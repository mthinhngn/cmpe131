import { universitySections } from "./university.controller";
import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { BootstrapController } from "./bootstrap.controller";
import { PlanningStore, type State, type Proposal, type ActionResult, validSlot } from "./planning-engine";
import { applyAgentAction } from "./agent-action";
import { applyAgentSections } from "./agent-sections";
import type { ProgramCatalog } from "./course-types";
import { sourceData, syncPlan, termFor, type CalendarData, type SectionData } from "./schedule-sync";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const fail = (message: string): never => { throw new BadRequestException(message); };
export function workspaceHash(authorization: unknown) {
  if (typeof authorization !== "string" || !/^Bearer [a-f0-9]{64}$/.test(authorization)) throw new UnauthorizedException("A valid private workspace credential is required.");
  return createHash("sha256").update(authorization.slice(7)).digest("hex");
}
export type Command = { requestId: string; version: number; kind: string; args: any; catalogVersion?: string };
export function validateCommand(value: unknown): Command {
  if (!object(value) || typeof value.requestId !== "string" || !/^[\w-]{1,100}$/.test(value.requestId) || !Number.isSafeInteger(value.version) || value.version < 0 || !object(value.args) || typeof value.kind !== "string" || JSON.stringify(value.args).length > 60000) fail("Invalid workspace operation.");
  if ((value as Command).kind === "message") fail("Chat is kept only in the current browser tab; database chat storage is disabled.");
  return value as Command;
}
export function applyManual(store: PlanningStore, kind: string, a: Record<string, any>, catalogs: Record<string, ProgramCatalog>, sections: SectionData | null = null, profileStart?: string) {
  const id = () => { if (typeof a.id !== "string" || !store.getState().catalog.courses.some(c => c.id === a.id)) fail("Unknown course in current program."); return a.id as string; };
  switch (kind) {
    case "agentAction": try { if (a.action?.kind === "set_course_sections") applyAgentSections(store, a, sections, profileStart); else applyAgentAction(store, { ...a, profileStart }); } catch (error) { fail(error instanceof Error ? error.message : "Invalid agent action."); } break;
    case "setStartingTerm": {
      if (a.term !== null && (typeof a.term !== "string" || !/^(winter|spring|summer|fall)-(19|20|21)\d{2}$/.test(a.term))) fail("Invalid starting academic term.");
      const state = store.getState(); store.restore({ ...state, startingTerms: { ...state.startingTerms, [state.program]: a.term }, revision: state.revision + 1 }); break;
    }
    case "setPlan": store.setPlan(id(), a.semester, a.status); break;
    case "moveCompletedCourse": store.moveCompletedCourse(id(), a.semester); break;
    case "moveSemester": store.moveSemester(a.from, a.to, profileStart); break;
    case "removePlan": store.removePlan(id()); break;
    case "toggleTakenCourse": store.toggleTakenCourse(id()); break;
    case "chooseRequirement": {
      if (typeof a.requirementId !== "string") fail("Unknown requirement.");
      store.chooseRequirement(a.requirementId, id()); break;
    }
    case "addSemester": store.addSemester(); break;
    case "addNamedTerm": store.addNamedTerm(a.term); break;
    case "removeSemester": {
      const state = store.getState();
      store.removeSemester(a.semester, termFor(profileStart ?? state.startingTerms?.[state.program], a.semester)); break;
    }
    case "removeLastSemester": store.removeLastSemester(); break;
    case "setTerm": if (typeof a.term !== "string") fail("Invalid term."); store.setTerm(a.semester, a.term); break;
    case "selectProgram": if (typeof a.program !== "string" || !catalogs[a.program]) fail("Invalid program."); store.selectProgram(a.program, catalogs[a.program], a.additionalPrograms); break;
    case "schedule": {
      if (typeof a.classNumber !== "string" || typeof a.selected !== "boolean") fail("Invalid section selection.");
      const state = store.getState(), catalog = state.catalog, scope = `${state.program}:${catalog.catalogYear}:${catalog.currentTerm.id}`;
      const offering = catalog.offerings.find(o => o.classNumber === a.classNumber);
      if (a.selected && !offering) fail("Section not in current catalog snapshot.");
      let selected = state.schedules[scope] ?? [];
      selected = selected.filter(n => n !== a.classNumber && (!a.selected || !catalog.offerings.some(o => o.classNumber === n && o.courseCode === offering!.courseCode && o.component === offering!.component)));
      if (a.selected) selected.push(a.classNumber);
      store.restore({ ...state, revision: state.revision + 1, schedules: { ...state.schedules, [scope]: selected } }); break;
    }
    default: fail("Unsupported workspace operation.");
  }
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly db: PrismaService) {}
  private async safe<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) throw new ConflictException("Concurrent operation. Reload the saved workspace before retrying.");
      throw new ServiceUnavailableException("PostgreSQL could not confirm this operation. No temporary plan was saved. Retry the same operation or reload to check its saved status.");
    }
  }
  private async catalog(program: string, additional: unknown = []) { return new BootstrapController(this.db).compose(program, additional); }
  async create(authorization: unknown, storage: PrismaService = this.db, initialProgram = "computer-engineering") {
    const tokenHash = workspaceHash(authorization);
    return this.safe(async () => {
      const existing = await storage.personalWorkspace.findUnique({ where: { tokenHash } });
      if (existing) return this.read(authorization, storage);
      const program = initialProgram;
      const catalog = await this.catalog(program);
      const state = new PlanningStore(program, catalog).getState();
      const workspace = await storage.personalWorkspace.upsert({ where: { tokenHash }, create: { tokenHash, state: json(state) }, update: {} });
      return this.response(workspace);
    });
  }
  private response(workspace: { state: Prisma.JsonValue; version: number }) { return { state: workspace.state as unknown as State, version: workspace.version }; }
  async read(authorization: unknown, storage: PrismaService = this.db) {
    const tokenHash = workspaceHash(authorization);
    return this.safe(async () => {
      return storage.$transaction(async tx => {
        const workspace = await tx.personalWorkspace.findUnique({ where: { tokenHash } });
        if (!workspace) throw new NotFoundException("Workspace not found. Your saved credential has not been replaced.");
        await tx.$queryRaw`SELECT "id" FROM "PersonalWorkspace" WHERE "id" = ${workspace.id} FOR UPDATE`;
        const current = await tx.personalWorkspace.findUniqueOrThrow({ where: { id: workspace.id } });
        const state = current.state as unknown as State;
        const catalog = await this.catalog(state.program, state.additionalPrograms?.[state.program]);
        if (state.catalog.dataVersion === catalog.dataVersion && state.catalog.currentTerm.fetchedAt === catalog.currentTerm.fetchedAt) return this.response(current);
        const refreshedState = { ...state, catalog, revision: state.revision + 1, undoRevision: undefined, undoRequestId: undefined };
        const refreshed = await tx.personalWorkspace.update({ where: { id: current.id }, data: { state: json(refreshedState), version: { increment: 1 } } });
        await tx.personalOperation.create({ data: { workspaceId: current.id, requestId: `catalog-${refreshed.version}`, fingerprint: createHash("sha256").update(JSON.stringify(catalog)).digest("hex"), kind: "catalog-refresh", before: json(state), result: json({ status: "success", message: "Catalog refreshed; personal plan preserved." }) } });
        return this.response(refreshed);
      }, { timeout: 15000 });
    });
  }
  async execute(authorization: unknown, input: unknown, storage: PrismaService = this.db, startingSemester?: string) {
    const tokenHash = workspaceHash(authorization), command = validateCommand(input);
    const fingerprint = createHash("sha256").update(JSON.stringify(command.kind === "agentAction" ? { kind: command.kind, action: command.args.action }
      : command.kind === "syncPlan" && command.args.baseKind === "agentAction" ? { kind: command.kind, action: command.args.baseArgs?.action, term: command.args.term, selected: command.args.selected } : command)).digest("hex");
    return this.safe(async () => {
      const original = await storage.personalWorkspace.findUnique({ where: { tokenHash } });
      if (!original) throw new NotFoundException("Workspace not found.");
      let calendar: CalendarData | null = null, sections: SectionData | null = null;
      if (command.kind === "syncPlan" && command.args.term) {
        if (typeof command.args.term !== "string" || !/^(fall|spring|winter|summer)-(19|20|21)\d{2}$/.test(command.args.term)) fail("Invalid schedule semester.");
        try { calendar = await sourceData("schedule/terms"); } catch { /* Schedule validation will reject an unverified term. */ }
        try { sections = await universitySections(this.db, command.args.term); }
        catch { sections = { term: command.args.term, status: "unavailable", offerings: [] }; }
      }
      if (command.kind === "agentAction" && command.args.action?.kind === "set_course_sections") {
        const term = command.args.action.term;
        if (typeof term !== "string" || !/^(fall|spring|winter|summer)-(19|20|21)\d{2}$/.test(term)) fail("Invalid section term.");
        sections = await universitySections(this.db, term);
      }
      const catalogs: Record<string, ProgramCatalog> = {};
      if (!["view", "undo"].includes(command.kind)) {
        const program = (original.state as unknown as State).program;
        const saved = original.state as unknown as State;
        catalogs[program] = await this.catalog(program, saved.additionalPrograms?.[program]);
        if (command.kind === "selectProgram" && typeof command.args.program === "string") catalogs[command.args.program] = await this.catalog(command.args.program, command.args.additionalPrograms ?? saved.additionalPrograms?.[command.args.program]);
        if (command.kind === "importLegacy") {
          for (const program of ["computer-engineering", "software-engineering"]) catalogs[program] = await this.catalog(program);
        }
      }
      return storage.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "PersonalWorkspace" WHERE "id" = ${original.id} FOR UPDATE`;
        const workspace = await tx.personalWorkspace.findUniqueOrThrow({ where: { id: original.id } });
        const receipt = await tx.personalOperation.findUnique({ where: { workspaceId_requestId: { workspaceId: workspace.id, requestId: command.requestId } } });
        if (receipt) {
          if (receipt.fingerprint !== fingerprint) throw new ConflictException("Operation ID reused with different arguments.");
          return { ...this.response(workspace), result: receipt.result as unknown as ActionResult, replayed: true };
        }
        if (workspace.version !== command.version) throw new ConflictException("Saved workspace changed in another tab. Reload before making another change.");
        const before = workspace.state as unknown as State;
        const store = new PlanningStore(before.program, before.catalog); store.restore(structuredClone(before));
        const a = command.args;
        let result: ActionResult = { status: "success", message: "Saved to PostgreSQL." };
        if (command.kind === "importLegacy") {
          if (workspace.version !== 0 || before.revision !== 0) throw new ConflictException("Legacy browser data can only initialize an empty workspace.");
          if (!["computer-engineering", "software-engineering"].includes(a.program) || !Array.isArray(a.completed) || a.completed.length > 1000 || a.completed.some((id: unknown) => typeof id !== "string" || !Object.values(catalogs).some(c => c.courses.some(course => course.id === id))) || !object(a.schedules)) fail("Existing browser draft contains invalid catalog references. Original browser data has not been changed.");
          const schedules: Record<string, string[]> = {};
          for (const [scope, numbers] of Object.entries(a.schedules)) {
            const catalog = Object.entries(catalogs).find(([program, c]) => scope === `${program}:${c.catalogYear}:${c.currentTerm.id}`)?.[1];
            if (!catalog || !Array.isArray(numbers) || numbers.length > 100 || numbers.some(number => typeof number !== "string" || !catalog.offerings.some(o => o.classNumber === number))) fail("Existing weekly draft has unavailable sections. Original browser data has not been changed.");
            schedules[scope] = [...new Set(numbers as string[])];
          }
          store.restore({ ...before, program: a.program, catalog: catalogs[a.program], completed: [...new Set(a.completed as string[])], schedules, revision: before.revision + 1, undoRevision: before.revision + 1, undoRequestId: command.requestId });
          result = { status: "success", message: "Existing browser completion and weekly schedule imported and saved." };
        } else if (command.kind === "view") {
          if (!store.validSlot(a.semester) || (a.selectedCourseId !== null && !before.catalog.courses.some(c => c.id === a.selectedCourseId))) fail("Invalid planner view.");
          store.restore({ ...before, views: { ...before.views, [before.program]: { semester: a.semester, selectedCourseId: a.selectedCourseId } } });
        } else if (command.kind === "undo") {
          if (before.undoRevision === undefined || a.revision !== before.revision || a.revision !== before.undoRevision) throw new ConflictException("A newer change prevents this Undo. Reload your plan.");
          const operation = before.undoRequestId
            ? await tx.personalOperation.findUnique({ where: { workspaceId_requestId: { workspaceId: workspace.id, requestId: before.undoRequestId } } })
            : await tx.personalOperation.findFirst({ where: { workspaceId: workspace.id, kind: { notIn: ["metadata", "undo"] } }, orderBy: { createdAt: "desc" } });
          if (!operation) fail("No saved change to undo.");
          const previous = operation!.before as unknown as State;
          store.restore({ ...before, program: previous.program, additionalPrograms: previous.additionalPrograms, plans: previous.plans, counts: previous.counts, terms: previous.terms, startingTerms: previous.startingTerms, namedTerms: previous.namedTerms, semesterSlots: previous.semesterSlots, termOrder: previous.termOrder, completed: previous.completed, requirementChoices: previous.requirementChoices, schedules: previous.schedules, scheduleOfferings: previous.scheduleOfferings, catalog: previous.catalog, revision: before.revision + 1, undoRevision: undefined, undoRequestId: undefined });
          result = { status: "success", message: "Change undone and saved.", revision: before.revision + 1 };
        } else {
          const catalog = catalogs[before.program];
          if (!catalog || (command.catalogVersion && catalog.dataVersion !== command.catalogVersion)) throw new ConflictException("Catalog changed. Reload the workspace before editing.");
          store.restore({ ...store.getState(), catalog });
          if (command.kind === "apply") {
            if (typeof a.reviewed !== "boolean" || !object(a.proposal)) fail("Invalid proposal.");
            if (typeof a.proposal.requestId !== "string" || a.proposal.requestId.length > 100) fail("Invalid proposal request ID.");
            const prior = await tx.personalOperation.findFirst({ where: { workspaceId: workspace.id, kind: "apply", result: { path: ["proposalRequestId"], equals: a.proposal.requestId } } });
            if (prior && ["success", "unchanged"].includes((prior.result as unknown as ActionResult).status)) return { ...this.response(workspace), result: { status: "unchanged", message: "This action was already applied. Nothing changed." }, replayed: true };
            result = store.apply(a.proposal as Proposal, a.reviewed);
            if (result.status === "error") throw new BadRequestException(result.message);
          } else {
            try {
              if (command.kind === "syncPlan") {
                syncPlan(store, a, calendar, sections, startingSemester?.trim().toLowerCase().replace(/\s+/, "-"), (kind, payload) => applyManual(store, kind, payload, catalogs));
                result = { status: "success", message: a.term ? `Saved Planner and Schedule for ${a.term}.` : "Saved to PostgreSQL." };
              } else applyManual(store, command.kind, a, catalogs, sections, startingSemester?.trim().toLowerCase().replace(/\s+/, "-"));
            } catch (error) { if (error instanceof HttpException) throw error; fail(error instanceof Error ? error.message : "Invalid planning action."); }
          }
          if (store.getState().revision !== before.revision) store.restore({ ...store.getState(), revision: before.revision + 1, undoRevision: before.revision + 1, undoRequestId: command.requestId });
          result = { ...result, revision: store.getState().revision };
        }
        const state = store.getState();
        const saved = await tx.personalWorkspace.update({ where: { id: workspace.id }, data: { state: json(state), version: { increment: 1 } } });
        await tx.personalOperation.create({ data: { workspaceId: workspace.id, requestId: command.requestId, fingerprint, kind: state.revision === before.revision ? "metadata" : command.kind, before: json(before), result: json({ ...result, ...(command.kind === "apply" ? { proposalRequestId: a.proposal.requestId } : {}) }) } });
        return { ...this.response(saved), result, replayed: false };
      }, { timeout: 15000 });
    });
  }
}
