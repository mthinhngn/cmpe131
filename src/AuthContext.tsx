import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { accountResponse, apiEndpoint } from "./api";
import "./account.css";
import "./chat-session";
import { PageLoading } from "./PageLoading";
import { staticPreview } from "./static-preview";

export type AccountUser = { id: string; email: string; name: string; major: string; startingSemester: string };
export function profileComplete(user: AccountUser) {
  return !!user.name.trim() && /^[a-z0-9-]{1,120}$/.test(user.major)
    && /^(Spring|Summer|Fall|Winter) (19\d{2}|20\d{2}|2100)$/.test(user.startingSemester);
}
export async function authRequest(path: string, body?: unknown) {
  const response = await fetch(apiEndpoint(`auth/${path}`), { credentials: "include", cache: "no-store", method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  return accountResponse(response);
}
type SignInDelivery = "log" | "resend" | "unavailable";
const AuthContext = createContext<{ user: AccountUser | null; signInDelivery: SignInDelivery; update: (user: AccountUser) => void; logout: () => Promise<void> } | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [signInDelivery, setSignInDelivery] = useState<SignInDelivery>(staticPreview ? "resend" : "unavailable");
  const [ready, setReady] = useState(staticPreview);
  const [error, setError] = useState("");
  const load = () => { setError(""); void authRequest("me").then(result => { setUser(result.user); setSignInDelivery(result.signInDelivery ?? "unavailable"); setReady(true); }).catch(e => setError(e.message)); };
  useEffect(() => { if (!staticPreview) load(); }, []);
  const logout = async () => { await authRequest("logout", {}); window.location.assign("/"); };
  const needsSetup = ready && user && !profileComplete(user) && window.location.pathname.replace(/\/$/, "") !== "/account";
  useEffect(() => { if (needsSetup) window.location.replace("/account?setup=required"); }, [needsSetup]);
  if (needsSetup) return <div className="account-connection" role="status">Opening your account setup… <a href="/account?setup=required">Complete your profile</a></div>;
  // Do not mount planning stores until identity is known; guest data must never initialize an account.
  if (!ready && !error) return <PageLoading detail="Checking your account" />;
  if (!ready) return <div className="account-connection" role={error ? "alert" : "status"}>{error || "Checking your account…"}{error && <><button onClick={load}>Retry connection</button><button onClick={() => { void logout().catch(e => setError(e.message)); }}>Sign out and continue as guest</button></>}</div>;
  return <AuthContext.Provider value={{ user, signInDelivery, update: setUser, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("Account provider missing"); return value; }
export function AccountLink() {
  const { user } = useAuth();
  return <a className="account-link" href="/account">{user ? "My profile" : "Sign in"}</a>;
}
