import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { PageLoading } from "./PageLoading";
import { staticPreview } from "./static-preview";

/** Mount inside Suspense so confirmation starts only after the screen can render. */
export function PageReady({ children, detail }: { children: ReactNode; detail?: string }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"ready" | "leaving" | "done">("ready");
  useEffect(() => {
    const leave = window.setTimeout(() => setPhase("leaving"), 650);
    const done = window.setTimeout(() => setPhase("done"), 850);
    return () => { window.clearTimeout(leave); window.clearTimeout(done); };
  }, []);
  return <>
    <div className="cr-page-reveal-content" inert={phase !== "done"} aria-hidden={phase !== "done" ? true : undefined}>{children}</div>
    {phase !== "done" && <PageLoading ready leaving={phase === "leaving"} detail={detail ?? (staticPreview ? "Preview ready" : user ? "Saved to your account" : "Guest workspace restored")} />}
  </>;
}
