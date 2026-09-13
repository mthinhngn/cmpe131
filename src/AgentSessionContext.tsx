import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useCatalog } from "./CatalogContext";
import type { AgentResponse, ChatMessage, UnavailableWindow } from "./agent";

type AgentSession = {
  messages: ChatMessage[];
  draft: string;
  unavailableTimes: UnavailableWindow[];
  pending: boolean;
};

const welcome = (): ChatMessage => ({
  id: "welcome",
  role: "assistant",
  content: "Tell me to build a schedule and I will derive eligible courses from your degree roadmap, completed prerequisites, current Fall 2026 sections, and locked schedule—no semester plan required.",
});

const createSession = (): AgentSession => ({ messages: [welcome()], draft: "", unavailableTimes: [], pending: false });

type AgentSessionContextValue = AgentSession & {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setDraft: Dispatch<SetStateAction<string>>;
  setUnavailableTimes: Dispatch<SetStateAction<UnavailableWindow[]>>;
  setPending: Dispatch<SetStateAction<boolean>>;
};

const AgentSessionContext = createContext<AgentSessionContextValue | null>(null);

export function AgentSessionProvider({ children }: { children: ReactNode }) {
  const { catalog, program } = useCatalog();
  const scopeKey = `${program}:${catalog.catalogYear}:${catalog.currentTerm.id}`;
  const [sessions, setSessions] = useState<Record<string, AgentSession>>({});
  const session = sessions[scopeKey] ?? createSession();
  const update = (change: (current: AgentSession) => AgentSession) => setSessions((current) => ({
    ...current,
    [scopeKey]: change(current[scopeKey] ?? createSession()),
  }));
  const value = useMemo<AgentSessionContextValue>(() => ({
    ...session,
    setMessages: (next) => update((current) => ({ ...current, messages: typeof next === "function" ? next(current.messages) : next })),
    setDraft: (next) => update((current) => ({ ...current, draft: typeof next === "function" ? next(current.draft) : next })),
    setUnavailableTimes: (next) => update((current) => ({ ...current, unavailableTimes: typeof next === "function" ? next(current.unavailableTimes) : next })),
    setPending: (next) => update((current) => ({ ...current, pending: typeof next === "function" ? next(current.pending) : next })),
  }), [session, scopeKey]);
  return <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>;
}

export function useAgentSession() {
  const context = useContext(AgentSessionContext);
  if (!context) throw new Error("useAgentSession must be used inside AgentSessionProvider");
  return context;
}

export type { AgentResponse };
