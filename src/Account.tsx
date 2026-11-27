import { ProductHeader } from "./ProductHeader";
import { ProgramFields } from "./ProgramFields";
import { SelectionMenu } from "./components/ui/selection-menu";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CourseRadarBrand } from "./CourseRadarBrand";
import { authRequest, profileComplete, useAuth, type AccountUser } from "./AuthContext";

import { CatalogProvider, useCatalog } from "./CatalogContext";
import { PageReady } from "./PageReady";
import type { State } from "./planning";
import { PersistentPlanningStore } from "./PersistentPlanningStore";
import { saveTranscriptCourses, transcriptRequest, transcriptRowIssue, type Transcript } from "./transcript-client";

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
/** Picking a file is local; processing requires the explicit consent control below. */
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
  const [importRows, setImportRows] = useState<string[] | null>(null);
  const [term, setTerm] = useState(initial.term);
  const [year, setYear] = useState(initial.year || String(thisYear));
  const first = user.name.trim().split(/\s+/)[0];
  const [step, setStep] = useState<"choose" | "upload" | "details">("choose");
  const go = (next: typeof step) => { setStep(next); window.scrollTo({ top: 0 }); };
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
    <TranscriptManager user={user} setup onSelection={setImportRows} />
    <details className="acct-help"><summary>Where do I find my transcript?</summary><p>Sign in to MySJSU, open your unofficial transcript, then save or print it as a PDF. Official transcripts aren’t needed.</p></details>
    <div className="acct-actions"><button type="button" className="acct-btn acct-btn-primary" onClick={() => go("details")}>Continue to your details</button></div>
    <PageReady detail="Account details loaded">{null}</PageReady>
  </main>;

  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => {
    const result = await authRequest("profile", { name, major, additionalPrograms: additional, startingSemester: `${term} ${year}` });
    if (importRows?.length) await importReviewedTranscript(result.user, await transcriptRequest(), importRows);
    update(result.user); window.location.assign("/planner");
  }); };
  return <main className="acct-desk acct-wide">
    {back}
    {steps(2)}
    <h1>Your details</h1>
    <p className="acct-lede">Choose the SJSU major you are actually enrolled in. This becomes your saved current major; What-if Major previews will not replace it. Your first semester numbers your plan.</p>
    <form onSubmit={save}>
      <label className="acct-field"><span>Name</span><input className="acct-input" name="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={busy} /></label>
      <label className="acct-field"><span>Email</span><input className="acct-input" type="email" value={user.email} readOnly /></label>
      <ProgramFields value={major} onChange={slug => { setMajor(slug); setAdditional([]); }} additional={additional} onAdditional={setAdditional} disabled={busy} />
      <div className="acct-row2">
        <Segmented name="term" legend="First semester at SJSU" options={terms.map(t => [t, t] as const)} value={term} onChange={setTerm} disabled={busy} />
        <div className="acct-field acct-year"><span className="sr-only">Year</span><SelectionMenu label="Year" value={year} onChange={setYear} options={years(year).map(y => ({ slug:y, title:y }))} disabled={busy} /></div>
      </div>
      <button className="acct-btn acct-btn-primary acct-btn-block acct-submit" disabled={busy}>{busy ? "Saving…" : importRows?.length ? "Save, import and open planner" : "Save and open planner"}</button>
    </form>
    <Feedback error={error} message={message} />
    <PageReady detail="Account details loaded">{null}</PageReady>
  </main>;
}

function AccountSettings({ user }: { user: AccountUser }) {
  return <main className="acct-set">
    <h1>Account settings</h1>
    <ProfileSection user={user} />
    <CatalogProvider key={user.id}><PageReady><DegreeSection user={user} /></PageReady></CatalogProvider>
    <TranscriptSection user={user} />
    <SessionSection />
  </main>;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const id = `acct-${title.toLowerCase()}`;
  return <section className="acct-sec" aria-labelledby={id}><div><h2 id={id}>{title}</h2>{sub && <p>{sub}</p>}</div><div>{children}</div></section>;
}

function ProfileSection({ user }: { user: AccountUser }) {
  const { update } = useAuth();
  const { busy, error, message, run } = useAction();
  const [name, setName] = useState(user.name);
  const save = (e: FormEvent) => { e.preventDefault(); void run(async () => { const result = await authRequest("profile", { name, major: user.major, startingSemester: user.startingSemester }); update(result.user); return "Profile saved."; }); };
  return <Section title="Profile">
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
  return <Section title="Degree" sub="What-if previews don’t change these.">
    <form onSubmit={save}>
      <ProgramFields value={major} onChange={slug => { setMajor(slug); setAdditional(planningStore.getState().additionalPrograms?.[slug] ?? []); }} additional={additional} onAdditional={setAdditional} disabled={busy} />
      <fieldset className="acct-fieldset" disabled={busy}><legend className="acct-legend">First semester at SJSU</legend><div className="acct-row2">
        <SelectionMenu label="Term" value={term} onChange={setTerm} options={terms.map(t => ({ slug:t, title:t }))} disabled={busy} />
        <SelectionMenu label="Year" value={year} onChange={setYear} options={years(year).map(y => ({ slug:y, title:y }))} disabled={busy} />
      </div></fieldset>
      <dl className="acct-dl"><div><dt>Catalog</dt><dd>{catalog.catalogYear}</dd></div><div><dt>Sections</dt><dd>{catalog.currentTerm.name} snapshot</dd></div></dl>
      <button className="acct-btn acct-btn-line" disabled={busy || !changed}>{busy ? "Saving…" : "Save degree"}</button>
    </form>
    <Feedback error={error} message={message} />
  </Section>;
}

function TranscriptSection({ user }: { user: AccountUser }) {
  return <Section title="Transcript" sub="Unofficial transcript PDF from MySJSU."><TranscriptManager user={user} /></Section>;
}

async function importReviewedTranscript(user: AccountUser, transcript: Transcript, selected: string[]) {
  const store = new PersistentPlanningStore(user.id); await store.load();
  if (store.getState().storageStatus !== "saved") throw Error(store.getState().storageError || "Your workspace could not be loaded.");
  const completed = await saveTranscriptCourses(store, transcript, selected, user.startingSemester.trim().toLowerCase().replace(/\s+/, "-"));
  try {
    return await transcriptRequest("CONFIRM", { document_id: transcript.document_id, row_ids: selected, completed_course_ids: completed });
  } catch (error) {
    throw Error(`Courses saved to Planner. Transcript search confirmation needs retry: ${(error as Error).message}`);
  }
}

function TranscriptManager({ user, setup = false, onSelection }: { user: AccountUser; setup?: boolean; onSelection?: (rows: string[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [transcript, setTranscript] = useState<Transcript>({ status: "none", courses: [] });
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<State>();
  const start = user.startingSemester.trim().toLowerCase().replace(/\s+/, "-");
  const choose = (rows: string[]) => { setSelected(rows); onSelection?.(rows); };
  const { busy, error, message, run } = useAction();
  const accept = (value: Transcript) => {
    setTranscript(value);
    choose(value.courses.filter(row => !transcriptRowIssue(row, value)).map(row => row.row_id));
  };
  useEffect(() => {
    let active = true;
    setLoadStatus("loading");
    void transcriptRequest()
      .then(value => {
        if (!active) return;
        accept(value);
        setLoadStatus("ready");
      })
      .catch(() => {
        if (active) setLoadStatus("error");
      });
    return () => { active = false; };
  }, [user.id, loadAttempt]);
  useEffect(() => {
    if (setup) return;
    const store = new PersistentPlanningStore(user.id);
    let active = true;
    void store.load().then(() => { if (active && store.getState().storageStatus === "saved") setWorkspace(store.getState()); });
    return () => { active = false; };
  }, [user.id, setup]);
  const issue = (row: Transcript["courses"][number]) => transcriptRowIssue(row, transcript, workspace, start);
  const importable = selected.filter(id => { const row = transcript.courses.find(row => row.row_id === id); return row && !issue(row); });
  const upload = () => void run(async () => {
    if (!file || !consent) return;
    const data = new FormData(); data.set("file", file); data.set("consent", "true"); data.set("program_id", user.major);
    accept(await transcriptRequest("POST", data)); setFile(null); return "Transcript processed. Review the course list before saving.";
  });
  const confirm = () => void run(async () => {
    accept(await importReviewedTranscript(user, transcript, importable));
    window.location.assign("/planner");
    return "Transcript courses saved to Planner.";
  });
  if (loadStatus === "loading") {
    return <p role="status">Checking for a saved transcript…</p>;
  }
  if (loadStatus === "error") {
    return (
      <>
        <p role="alert">We couldn’t load your transcript. Check your connection and try again.</p>
        <button type="button" className="acct-btn acct-btn-line" onClick={() => setLoadAttempt(attempt => attempt + 1)}>
          Retry
        </button>
      </>
    );
  }
  return <>
    <fieldset className="acct-fieldset" disabled={busy}>
      <TranscriptDrop file={file} onFile={setFile} />
      <label className="acct-hint"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> I agree to send this PDF to OpenAI for transcript extraction and search indexing.</label>
      <div className="acct-actions"><button type="button" className="acct-btn acct-btn-line" disabled={!file || !consent || transcript.status !== "none"} onClick={upload}>{busy ? "Processing…" : "Process transcript"}</button></div>
      {transcript.status !== "none" && <>
        <p className="acct-muted">{transcript.courses.length} rows found. Review them before importing.</p>
        <div className="acct-transcript-rows">{transcript.courses.map(row => <label key={row.row_id} className="acct-transcript-row">
          <input type="checkbox" checked={importable.includes(row.row_id)} disabled={!!issue(row)} onChange={event => choose(event.target.checked ? [...selected, row.row_id] : selected.filter(id => id !== row.row_id))} />
          <span><b>{row.code || "Unmatched course"}</b> {row.title}<small>{row.term || "Unknown term"} / {row.grade || "No grade"} / {row.units ?? "Unknown"} units / {row.status === "in_progress" ? "in progress" : row.status}{issue(row) ? ` / ${issue(row)}` : ""}</small></span>
        </label>)}</div>
        {setup ? <p className="acct-hint">Your selected courses will be imported when you save your account details. Check that your first semester includes their recorded terms.</p> : <button type="button" className="acct-btn acct-btn-primary" disabled={!importable.length || !workspace} onClick={confirm}>Import to Planner</button>}
        {transcript.status === "ready" && <p className="acct-status" role="status">Importing again won’t create duplicates.</p>}
        <p className="acct-hint">Deleting removes the PDF and its extracted data. Imported courses stay in your plan.</p>
        <button type="button" className="acct-btn acct-btn-ghost" onClick={() => void run(async () => { accept(await transcriptRequest("DELETE")); return "Transcript deleted."; })}>Delete transcript</button>
      </>}
    </fieldset>
    <Feedback error={error} message={message} />
  </>;
}

function SessionSection() {
  const { logout } = useAuth();
  const { busy, error, message, run } = useAction();
  return <Section title="Session">
    <p className="acct-muted">Your plan stays saved after you sign out.</p>
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
      <ProgramFields value={major} onChange={slug => { setMajor(slug); setAdditional(planningStore.getState().additionalPrograms?.[slug] ?? []); }} additional={additional} onAdditional={setAdditional} disabled={busy} primaryHelp="Saved in this tab only." />
      <div className="acct-field"><span>First semester</span><SelectionMenu label="First semester" value={start} onChange={setStart} disabled={busy} options={[{ slug:"", title:"Not set" }, ...Array.from({ length:21 }, (_,i) => thisYear - 10 + i).flatMap(y => ["spring", "summer", "fall", "winter"].map(t => ({ slug:`${t}-${y}`, title:`${t[0].toUpperCase() + t.slice(1)} ${y}` })))]} /></div>
      <button className="acct-btn acct-btn-line" disabled={busy}>{busy ? "Updating…" : "Apply guest settings"}</button>
    </form>
    <Feedback error={error} message={message} />
  </section>;
}
