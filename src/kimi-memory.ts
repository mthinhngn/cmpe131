import type { AgentSession, ConversationItem, Receipt } from "./agent-client";

export type SavedConversation = { threadId: string; items: ConversationItem[]; preferences: Record<string, unknown>; instanceId?: string };
type StoredReceipt = { state: "pending" } | { state: "done"; receipt: Receipt };
let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("course-radar-kimi-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("conversations"); request.result.createObjectStore("receipts"); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(Error("Kimi storage is blocked by another tab.")); };
  });
}

async function transaction<T>(store: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? Error("Kimi storage transaction was interrupted."));
  });
}

export const readConversation = (session: AgentSession) => transaction<SavedConversation | undefined>("conversations", "readonly", store => store.get(session.namespace));
export const saveConversation = (session: AgentSession, conversation: SavedConversation) => transaction("conversations", "readwrite", store => store.put(conversation, session.namespace));
export const readReceipt = (session: AgentSession, actionId: string) => transaction<StoredReceipt | undefined>("receipts", "readonly", store => store.get([session.namespace, actionId]));
export const saveReceipt = (session: AgentSession, actionId: string, receipt: Receipt) => transaction("receipts", "readwrite", store => store.put({ state: "done", receipt }, [session.namespace, actionId]));

/** Atomic reservation across tabs: the loser must reconcile, never execute again. */
export async function reserveAction(session: AgentSession, actionId: string): Promise<boolean> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("receipts", "readwrite"), store = tx.objectStore("receipts");
    let reserved = false;
    const request = store.get([session.namespace, actionId]);
    request.onsuccess = () => {
      if (!request.result) { store.put({ state: "pending" }, [session.namespace, actionId]); reserved = true; }
    };
    tx.oncomplete = () => resolve(reserved);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? Error("Action reservation failed."));
  });
}

export function restoredItems(items: ConversationItem[], sameInstance: boolean): ConversationItem[] {
  return items.map(item => sameInstance || ["completed", "failed"].includes(item.request.status) ? item : {
    ...item, request: { ...item.request, status: "failed", action: null, reply: "This request was interrupted by a service restart. Its outcome is unconfirmed. Check your current plan before sending a new request." }
  });
}

export function accountItems(history: { role: string; content: string }[]): ConversationItem[] {
  const items: ConversationItem[] = [];
  for (const message of history) {
    if (message.role === "user") items.push({ query: message.content, request: { request_id: `restored-${items.length}`, status: "failed", reply: "This request was interrupted. Check your plan before trying again.", action: null, events: [], trace_id: "" } });
    else if (message.role === "assistant" && items.length) Object.assign(items[items.length - 1].request, { reply: message.content, status: "completed" });
  }
  return items;
}
