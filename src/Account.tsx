import { ProductHeader } from "./ProductHeader";
import { ProgramFields } from "./ProgramFields";
import { SelectionMenu } from "./components/ui/selection-menu";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CourseRadarBrand } from "./CourseRadarBrand";
import { authRequest, profileComplete, useAuth, type AccountUser } from "./AuthContext";

import { CatalogProvider, useCatalog } from "./CatalogContext";
import { PageReady } from "./PageReady";

const googleError = new URLSearchParams(window.location.search).get("google_error");
if (googleError) window.history.replaceState(null, "", window.location.pathname);

const terms = ["Spring", "Summer", "Fall", "Winter"] as const;
const thisYear = new Date().getFullYear();
const years = (keep: string) => [...new Set([...Array.from({ length: 12 }, (_, i) => String(thisYear - 10 + i)), ...(keep ? [keep] : [])])].sort();
const splitSemester = (value: string) => { const [term = "", year = ""] = value.split(" "); return { term, year }; };

/** Shared busy/error/status handling for one form. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<string | void>) {
    setBusy(true); setError(""); setMessage("");
    try { const done = await action(); if (done) setMessage(done); }
    catch (e) { setError(e instanceof Error ? e.message : "Please retry."); }
    finally { setBusy(false); }
  }
  return { busy, error, message, run };
}

function Feedback({ error, message }: { error: string; message: string }) {
  return <>
    {error && <p className="acct-error" role="alert">{error}</p>}
    {message && <p className="acct-status" role="status">{message}</p>}
  </>;
}

const GoogleIcon = () => <svg className="acct-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
const ChevronIcon = () => <svg className="acct-chev" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>;
const TRANSCRIPT_PENDING = "Transcript upload is coming soon. Enter your details to finish setting up.";

/** Local PDF picker; the file is not sent anywhere until the transcript API exists. */
function TranscriptDrop({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const take = (next?: File) => {
    if (!next) return;
    if (next.type !== "application/pdf" && !/\.pdf$/i.test(next.name)) { setError("That file isn’t a PDF. Save the transcript from MySJSU as a PDF and try again."); return; }
    if (next.size > 10 * 1024 * 1024) { setError("That PDF is larger than 10 MB."); return; }
    setError(""); onFile(next);
  };
  if (file) return <div className="acct-drop is-file">
    <div className="acct-file"><span className="acct-pdf" aria-hidden="true">PDF</span><div><b>{file.name}</b><small>{Math.max(1, Math.round(file.size / 1024))} KB · ready</small></div><button type="button" className="acct-btn acct-btn-ghost" onClick={() => { onFile(null); if (input.current) input.current.value = ""; }}>Remove</button></div>
  </div>;
  return <>
    <div className={`acct-drop${over ? " is-over" : ""}${error ? " is-error" : ""}`} role="button" tabIndex={0} aria-label="Choose a transcript PDF"
      onClick={() => input.current?.click()} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => take(e.target.files?.[0])} />
      <span className="acct-doc" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg></span>
      <strong>Drop your PDF here</strong>
      <p>or <span className="acct-fake-link">choose a file</span> · PDF up to 10 MB</p>
    </div>
    {error && <p className="acct-error" role="alert">{error}</p>}
  </>;
}

const BackIcon = () => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>;

export default function Account() {
  const { user } = useAuth();
  const needsSetup = !!user && !profileComplete(user);
  return <div className="account-page">
    {needsSetup ? <header className="account-header"><CourseRadarBrand /></header> : <ProductHeader activePath="/account" />}
    {user ? needsSetup ? <ProfileSetup user={user} /> : <AccountSettings user={user} />
      : <SignIn />}
  </div>;
}

function SignIn() {
  const { busy, error, message, run } = useAction();
  const startGoogle = () => { void run(async () => { const result = await authRequest("google/start", {}); window.location.assign(result.url); }); };

  return <main className="acct-desk">
    <h1>Sign in</h1>
    <p className="acct-lede">Keep your courses, semester plans and schedule with your account.</p>
    <button type="button" className="acct-btn acct-btn-line acct-btn-block" onClick={startGoogle} disabled={busy}><GoogleIcon />{busy ? "Connecting…" : "Continue with Google"}</button>
    <p className="acct-hint acct-center">Use your Google account.</p>
    {googleError && <p className="acct-error" role="alert">{googleError === "canceled" ? "Google sign-in was canceled. You can try again." : "Google sign-in could not be completed. Please try again."}</p>}
    <Feedback error={error} message={message} />
    <div className="acct-after"><span>New accounts start with an empty plan.</span><a href="/schedule">Continue as guest</a></div>
    <CatalogProvider key="guest"><PageReady><GuestWorkspace /></PageReady></CatalogProvider>
  </main>;
}

/** Segmented single choice built on native radios, so required validation and arrow keys work. */
function Segmented({ name, legend, options, value, onChange, disabled, className = "" }: { name: string; legend: ReactNode; options: readonly (readonly [string, string])[]; value: string; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  return <fieldset className={`acct-fieldset ${className}`} disabled={disabled}>
    <legend className="acct-legend">{legend}</legend>
    <div className="acct-seg">{options.map(([v, label]) => <label key={v}><input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} required /><span>{label}</span></label>)}</div>
  </fieldset>;
}

function ProfileSetup({ user }: { user: AccountUser }) {
  const { update } = useAuth();
  const { busy, error, message, run } = useAction();
  const initial = splitSemester(user.startingSemester);
  const [name, setName] = useState(user.name);
  const [major, setMajor] = useState(user.major);
  const [additional, setAdditional] = useState<string[]>([]);
  const [term, setTerm] = useState(initial.term);
  const [year, setYear] = useState(initial.year || String(thisYear));
  const first = user.name.trim().split(/\s+/)[0];
  const [step, setStep] = useState<"choose" | "upload" | "details">("choose");
  const [file, setFile] = useState<File | null>(null);
  const [transcriptNote, setTranscriptNote] = useState(false);
  const go = (next: typeof step) => { setStep(next); setTranscriptNote(false); window.scrollTo({ top: 0 }); };
  const steps = (n: 1 | 2) => <><div className="acct-steps" aria-hidden="true"><i className="on" /><i className={n === 2 ? "on" : ""} /></div><p className="acct-steps-label">Step {n} of 2</p></>;
  const back = <button type="button" className="acct-back" onClick={() => go("choose")}><BackIcon />Back</button>;

  if (step === "choose") return <main className="acct-desk acct-wide">
    {steps(1)}
    <h1>{first ? `Welcome, ${first}.` : "Welcome."}</h1>
    <p className="acct-lede">Set up your workspace before you start planning. You can change any of this later in Account settings.</p>
    <div className="acct-choices">
      <button type="button" className="acct-choice" onClick={() => go("upload")}><span className="acct-ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5" /></svg></span><span><strong>Upload your transcript</strong><small>Unofficial transcript PDF from MySJSU.</small></span><ChevronIcon /></button>
      <button type="button" className="acct-choice" onClick={() => go("details")}><span className="acct-ic" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg></span><span><strong>Enter details yourself</strong><small>Your major and first semester at SJSU.</small></span><ChevronIcon /></button>
    </div>
    <PageReady detail="Account details loaded">{null}</PageReady>
  </main>;

  if (step === "upload") return <main className="acct-desk acct-wide">
    {back}
    {steps(2)}
    <h1>Upload your transcript</h1>
    <p className="acct-lede">Save your unofficial transcript from MySJSU as a PDF, then add it here.</p>
    <TranscriptDrop file={file} onFile={f => { setFile(f); setTranscriptNote(false); }} />
    <details className="acct-help"><summary>Where do I find my transcript?</summary><p>Sign in to MySJSU, open your unofficial transcript, then save or print it as a PDF. Official transcripts aren’t needed.</p></details>
    {transcriptNote && <p className="acct-pending" role="status">{TRANSCRIPT_PENDING}</p>}
    <div className="acct-actions"><button type="button" className="acct-btn acct-btn-primary" disabled={!file} onClick={() => setTranscriptNote(true)}>Save and open planner</button><button type="button" className="acct-btn acct-btn-ghost" onClick={() => go("details")}>Enter details instead</button></div>
    <PageReady detail="Account details loaded">{null}</PageReady>
  </main>;

  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => { const result = await authRequest("profile", { name, major, additionalPrograms: additional, startingSemester: `${term} ${year}` }); update(result.user); window.location.assign("/planner"); }); };
  return <main className="acct-desk acct-wide">
    {back}
    {steps(2)}
    <h1>Your details</h1>
    <p className="acct-lede">Your major sets the degree roadmap. Your first semester numbers your plan.</p>
    <form onSubmit={save}>
      <label className="acct-field"><span>Name</span><input className="acct-input" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={busy} /></label>
      <label className="acct-field"><span>Email</span><input className="acct-input" type="email" value={user.email} readOnly /></label>
      <ProgramFields value={major} onChange={slug => { setMajor(slug); setAdditional([]); }} additional={additional} onAdditional={setAdditional} disabled={busy} />
      <div className="acct-row2">
        <Segmented name="term" legend="First semester at SJSU" options={terms.map(t => [t, t] as const)} value={term} onChange={setTerm} disabled={busy} />
        <div className="acct-field acct-year"><span className="sr-only">Year</span><SelectionMenu label="Year" value={year} onChange={setYear} options={years(year).map(y => ({ slug:y, title:y }))} disabled={busy} /></div>
      </div>
      <button className="acct-btn acct-btn-primary acct-btn-block acct-submit" disabled={busy}>{busy ? "Saving…" : "Save and open planner"}</button>
    </form>
    <Feedback error={error} message={message} />
    <PageReady detail="Account details loaded">{null}</PageReady>
  </main>;
}

function AccountSettings({ user }: { user: AccountUser }) {
  return <main className="acct-set">
    <h1>Account settings</h1>
    <p className="acct-lede">Your courses, plans and schedule are saved to this account.</p>
    <ProfileSection user={user} />
    <CatalogProvider key={user.id}><PageReady><DegreeSection user={user} /></PageReady></CatalogProvider>
    <TranscriptSection />
    <SessionSection />
  </main>;
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  const id = `acct-${title.toLowerCase()}`;
  return <section className="acct-sec" aria-labelledby={id}><div><h2 id={id}>{title}</h2><p>{sub}</p></div><div>{children}</div></section>;
}

function ProfileSection({ user }: { user: AccountUser }) {
  const { update } = useAuth();
  const { busy, error, message, run } = useAction();
  const [name, setName] = useState(user.name);
  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => { const result = await authRequest("profile", { name, major: user.major, startingSemester: user.startingSemester }); update(result.user); return "Profile saved."; }); };
  return <Section title="Profile" sub="How you appear in Course Radar.">
    <div className="acct-who"><span className="acct-avatar" aria-hidden="true">{(user.name.trim()[0] || user.email[0] || "?").toUpperCase()}</span><div><b>{user.name}</b><small>{user.email}</small></div></div>
    <form onSubmit={save}>
      <label className="acct-field"><span>Name</span><input className="acct-input" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={busy} /></label>
      <button className="acct-btn acct-btn-line" disabled={busy || name.trim() === user.name}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
    <Feedback error={error} message={message} />
  </Section>;
}

function DegreeSection({ user }: { user: AccountUser }) {
  const { update } = useAuth();
  const { catalog, planningStore, additionalPrograms } = useCatalog();
  const { busy, error, message, run } = useAction();
  const initial = splitSemester(user.startingSemester);
  const [major, setMajor] = useState(user.major);
  const [additional, setAdditional] = useState(additionalPrograms);
  const [term, setTerm] = useState(initial.term);
  const [year, setYear] = useState(initial.year);
  const changed = JSON.stringify(additional) !== JSON.stringify(additionalPrograms) || major !== user.major || `${term} ${year}` !== user.startingSemester;
  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => { const result = await authRequest("profile", { name: user.name, major, additionalPrograms: additional, startingSemester: `${term} ${year}` }); update(result.user); await planningStore.load(); return "Degree saved."; }); };
  return <Section title="Degree" sub="Sets your roadmap and numbers your semesters.">
    <form onSubmit={save}>
      <ProgramFields value={major} onChange={slug => { setMajor(slug); setAdditional(planningStore.getState().additionalPrograms?.[slug] ?? []); }} additional={additional} onAdditional={setAdditional} disabled={busy} />
      <fieldset className="acct-fieldset" disabled={busy}><legend className="acct-legend">First semester at SJSU</legend><div className="acct-row2">
        <SelectionMenu label="Term" value={term} onChange={setTerm} options={terms.map(t => ({ slug:t, title:t }))} disabled={busy} />
        <SelectionMenu label="Year" value={year} onChange={setYear} options={years(year).map(y => ({ slug:y, title:y }))} disabled={busy} />
      </div></fieldset>
      <dl className="acct-dl"><div><dt>Catalog</dt><dd>{catalog.catalogYear}</dd></div><div><dt>Sections</dt><dd>{catalog.currentTerm.name} snapshot, not live enrollment</dd></div></dl>
      <button className="acct-btn acct-btn-line" disabled={busy || !changed}>{busy ? "Saving…" : "Save degree"}</button>
    </form>
    <Feedback error={error} message={message} />
  </Section>;
}

function TranscriptSection() {
  const [file, setFile] = useState<File | null>(null);
  return <Section title="Transcript" sub="Unofficial transcript PDF from MySJSU.">
    <TranscriptDrop file={file} onFile={setFile} />
    {file && <p className="acct-pending" role="status">Transcript upload is coming soon. This file stays on your computer for now.</p>}
  </Section>;
}

function SessionSection() {
  const { logout } = useAuth();
  const { busy, error, message, run } = useAction();
  return <Section title="Session" sub="Signed in on this browser.">
    <p className="acct-muted">Signing out returns to guest mode. Your account plan stays saved.</p>
    <button className="acct-btn acct-btn-line" disabled={busy} onClick={() => void run(logout)}>{busy ? "Signing out…" : "Sign out"}</button>
    <Feedback error={error} message={message} />
  </Section>;
}

function GuestWorkspace() {
  const { catalog, program, startingTerm, planningStore, additionalPrograms } = useCatalog();
  const { busy, error, message, run } = useAction();
  const [major, setMajor] = useState(program);
  const [additional, setAdditional] = useState(additionalPrograms);
  const [start, setStart] = useState(startingTerm || "");
  useEffect(() => { setMajor(program); setAdditional(additionalPrograms); }, [program, JSON.stringify(additionalPrograms)]);
  useEffect(() => setStart(startingTerm || ""), [startingTerm]);
  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    for (const [kind, args] of [["selectProgram", { program: major, additionalPrograms: additional }], ["setStartingTerm", { term: start || null }]] as const) {
      const result = await planningStore.command(kind, args);
      if (result.status === "error") throw Error(result.message);
    }
    return "Guest settings updated for this tab.";
  }); };
  return <section className="acct-guest" aria-labelledby="acct-guest-heading">
    <h2 id="acct-guest-heading">Guest workspace</h2>
    <p className="acct-muted">Temporary in this tab · Close the tab to discard · {catalog.catalogYear} catalog · {catalog.currentTerm.name} sections</p>
    <form onSubmit={save}>
      <ProgramFields value={major} onChange={slug => { setMajor(slug); setAdditional(planningStore.getState().additionalPrograms?.[slug] ?? []); }} additional={additional} onAdditional={setAdditional} disabled={busy} />
      <div className="acct-field"><span>First semester</span><SelectionMenu label="First semester" value={start} onChange={setStart} disabled={busy} options={[{ slug:"", title:"Not set" }, ...Array.from({ length:21 }, (_,i) => thisYear - 10 + i).flatMap(y => ["spring", "summer", "fall", "winter"].map(t => ({ slug:`${t}-${y}`, title:`${t[0].toUpperCase() + t.slice(1)} ${y}` })))]} /></div>
      <button className="acct-btn acct-btn-line" disabled={busy}>{busy ? "Updating…" : "Apply guest settings"}</button>
    </form>
    <Feedback error={error} message={message} />
  </section>;
}
