import type { PersistentPlanningStore } from "./PersistentPlanningStore";
import { transcriptTerm, transcriptPlacementIssue, type TranscriptPlacement } from "../api/src/transcript-import.ts";
import type { State } from "./planning";

export type TranscriptRow = { row_id: string; code: string; title: string; units: number | null; grade: string; status: string; term: string; course_id: string | null; needs_review: boolean; confirmed?: boolean };
export type Transcript = { document_id?: string; status: "none" | "pending" | "ready"; courses: TranscriptRow[]; row_count?: number; unmatched_count?: number; student_program?: string };

export async function transcriptRequest(method = "GET", data?: FormData | object): Promise<Transcript> {
  const base = (import.meta.env.VITE_AGENT_URL || "/api/v1/agent").replace(/\/$/, "");
  const response = await fetch(`${base}/transcript${method === "CONFIRM" ? "/confirm" : ""}`, {
    method: method === "CONFIRM" ? "POST" : method, credentials: "same-origin", cache: "no-store",
    headers: data && !(data instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Error(typeof payload?.detail === "string" ? payload.detail : `Transcript request failed (${response.status}). Please retry.`);
  return payload;
}

export function transcriptRowIssue(row: TranscriptRow, transcript: Transcript, state?: State, start?: string) {
  if (!row.course_id || row.needs_review) return "Check this row; no verified catalog match.";
  if (!["completed", "in_progress"].includes(row.status)) return "Transfer credit and withdrawn courses need manual review.";
  const term = transcriptTerm(row.term);
  if (!term) return "Term is unclear; review before adding this course manually.";
  if (transcript.courses.filter(other => other.course_id === row.course_id && ["completed", "in_progress"].includes(other.status)).length > 1) return "Repeated course; review the attempts before adding it manually.";
  return state && start ? transcriptPlacementIssue(state, { course_id: row.course_id, term, status: row.status as TranscriptPlacement["status"] }, start) : null;
}

/** One persisted workspace operation saves all placements and completions before RAG confirmation. */
export async function saveTranscriptCourses(store: PersistentPlanningStore, transcript: Transcript, rowIds: string[], start: string) {
  const rows: TranscriptPlacement[] = [];
  if (!rowIds.length || new Set(rowIds).size !== rowIds.length) throw Error("Select transcript courses to import.");
  for (const id of rowIds) {
    const row = transcript.courses.find(row => row.row_id === id);
    if (!row) throw Error("This transcript row is no longer available.");
    const issue = transcriptRowIssue(row, transcript, store.getState(), start);
    if (issue) throw Error(`${row.code}: ${issue}`);
    rows.push({ course_id: row.course_id!, term: transcriptTerm(row.term)!, status: row.status as TranscriptPlacement["status"] });
  }
  const result = await store.importTranscript(rows);
  if (result.status === "error") throw Error(result.message);
  return [...store.getState().completed];
}
