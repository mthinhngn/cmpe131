import { useEffect, useMemo, useState } from "react";
import { apiEndpoint } from "./api";
import { staticPreview } from "./static-preview";
import { SelectionMenu } from "./components/ui/selection-menu";

type Program = { slug: string; title: string; kind: string };
let directory: Promise<Program[]> | undefined;
function loadPrograms() {
  if (staticPreview) return Promise.resolve([
    { slug: "computer-engineering", title: "Computer Engineering", kind: "bachelor" },
    { slug: "software-engineering", title: "Software Engineering", kind: "bachelor" },
  ]);
  return directory ??= fetch(apiEndpoint("bootstrap/programs"), { signal: AbortSignal.timeout(15000) }).then(async response => {
    if (!response.ok) throw Error("Could not load the SJSU program directory.");
    return (await response.json()).programs as Program[];
  }).catch(error => { directory = undefined; throw error; });
}
const groups: Record<string, string> = { bachelor: "Bachelor’s degrees", master: "Master’s degrees", doctoral: "Doctoral degrees", combined: "Combined degrees", minor: "Minors", certificate: "Certificates", credential: "Credentials and authorizations" };

/** Guests, setup and signed-in settings share one cached program directory. */
export function ProgramFields({ value, onChange, additional, onAdditional, disabled = false }: {
  value: string; onChange: (slug: string) => void; additional: string[]; onAdditional: (slugs: string[]) => void; disabled?: boolean;
}) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void loadPrograms().then(data => { if (active) setPrograms(data); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);
  const ordered = useMemo(() => Object.keys(groups).flatMap(kind => programs.filter(p => p.kind === kind)), [programs]);
  const extras = useMemo(() => ordered.filter(p => ["minor", "certificate"].includes(p.kind) && p.slug !== value && !additional.includes(p.slug)), [ordered, value, additional]);
  return <div className="acct-program-fields">
    <div className="acct-field"><span>Degree program</span><SelectionMenu searchable label="Degree program" options={ordered} groups={groups} value={value} onChange={slug => { onChange(slug); setExtra(""); }} placeholder="Select your program" disabled={disabled || !programs.length} /></div>
    {!programs.length && !error && <p role="status" className="acct-muted">Loading SJSU programs…</p>}
    {error && <p role="alert" className="acct-error">{error} <button type="button" className="acct-btn acct-btn-ghost" onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
    <fieldset className="acct-fieldset" disabled={disabled || !programs.length}><legend className="acct-legend">Minors and certificates (optional)</legend>
      <div className="acct-row2"><SelectionMenu searchable label="Additional minor or certificate" options={extras} groups={groups} value={extra} onChange={setExtra} placeholder="Choose an additional program" disabled={disabled || !programs.length} /><button type="button" className="acct-btn acct-btn-line" disabled={!extra || additional.length >= 10} onClick={() => { onAdditional([...additional, extra]); setExtra(""); }}>Add program</button></div>
      {!!additional.length && <ul className="acct-added-programs">{additional.map(key => <li key={key}><span>{programs.find(p => p.slug === key)?.title ?? key}</span><button type="button" className="acct-btn acct-btn-ghost" aria-label={`Remove ${programs.find(p => p.slug === key)?.title ?? key}`} onClick={() => onAdditional(additional.filter(p => p !== key))}>Remove</button></li>)}</ul>}
      <p className="acct-muted">Requirements appear together in Roadmap and Overview. Each primary program keeps its own saved plan and schedule.</p>
    </fieldset>
  </div>;
}
