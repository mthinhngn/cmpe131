import type { AgentContext, AgentRequest } from "./agent-client";

export type ConversationItem = { query: string; request: AgentRequest };
export type Receipt = { status: "succeeded" | "failed"; code: string; message: string; context: AgentContext };
export type ChatSession = { instanceId?: string; preferences?: Record<string, unknown>; threadId: string; items: ConversationItem[]; receipts: [string, Receipt][] };
const prefix = "course-radar-chat-session-v1:";
export const newChatSession = (): ChatSession => ({ threadId: crypto.randomUUID(), items: [], receipts: [] });

export function readChatSession(scope: string): ChatSession {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + scope) || "null");
    if (value && typeof value.threadId === "string" && Array.isArray(value.items) && Array.isArray(value.receipts)
      && value.items.every((item: ConversationItem) => typeof item?.query === "string" && typeof item.request?.request_id === "string" && typeof item.request.status === "string")) return value;
  } catch { /* Invalid or unavailable tab storage starts a fresh conversation. */ }
  return newChatSession();
}

export function writeChatSession(scope: string, value: ChatSession) {
  sessionStorage.setItem(prefix + scope, JSON.stringify(value));
}

// Browsers can copy sessionStorage into duplicated tabs or tabs opened by a link.
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    const tabKey = prefix + "tab";
    let tabId = sessionStorage.getItem(tabKey) || crypto.randomUUID();
    sessionStorage.setItem(tabKey, tabId);
    const instance = crypto.randomUUID();
    const channel = new BroadcastChannel("course-radar-chat-tabs");
    channel.onmessage = ({ data }) => {
      if (data?.kind === "claim" && data.tabId === tabId && data.instance !== instance) {
        channel.postMessage({ kind: "occupied", instance: data.instance });
      } else if (data?.kind === "occupied" && data.instance === instance) {
        for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);
        tabId = crypto.randomUUID();
        sessionStorage.setItem(tabKey, tabId);
        window.dispatchEvent(new Event("course-radar-chat-reset"));
      }
    };
    channel.postMessage({ kind: "claim", tabId, instance });
    window.addEventListener("pagehide", () => channel.close(), { once: true });
    window.addEventListener("pageshow", event => { if (event.persisted) window.location.reload(); });
  } catch { /* Browsers without tab messaging still use tab-scoped sessionStorage. */ }
}
