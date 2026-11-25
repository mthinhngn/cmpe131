import { useEffect, useMemo, useState } from "react";
import { apiEndpoint } from "./api";
import { useCatalog } from "./CatalogContext";
import "./program-mode.css";

type Program = { slug: string; title: string; kind: string };

export function ProgramModeBar() {
  const { currentMajor, isWhatIf, previewProgram, startWhatIf, exitWhatIf, whatIfStatus, whatIfError } = useCatalog();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [directoryError, setDirectoryError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(apiEndpoint("bootstrap/programs"), { signal: AbortSignal.timeout(15000) })
      .then(async response => {
        if (!response.ok) throw Error("Could not load the SJSU program directory.");
        return (await response.json()).programs as Program[];
      })
      .then(items => { if (active) setPrograms(items); })
      .catch(error => { if (active) setDirectoryError(error instanceof Error ? error.message : "Could not load programs."); });
    return () => { active = false; };
  }, []);

  const majors = useMemo(() => programs.filter(program => ["bachelor", "master", "doctoral", "combined"].includes(program.kind)), [programs]);
  const titleFor = (slug: string | null) => programs.find(program => program.slug === slug)?.title ?? slug?.split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ") ?? "Not set";
  const currentTitle = titleFor(currentMajor);
  const previewTitle = titleFor(previewProgram);
  const alternatives = majors.filter(program => program.slug !== currentMajor);
  const error = whatIfError || directoryError;

  return <section className={`program-mode${isWhatIf ? " is-what-if" : ""}`} aria-label="Major and What-if mode">
    <div className="program-mode-copy">
      <span className="program-mode-kicker">{isWhatIf ? "WHAT-IF MAJOR" : "CURRENT MAJOR"}</span>
      {isWhatIf ? <>
        <strong>Previewing {previewTitle}</strong>
        <small>Your saved current major is still {currentTitle}. This read-only preview does not replace it.</small>
      </> : <>
        <strong>{currentTitle}</strong>
        <small>This is your actual/current major. Use What-if Major to preview another program without changing it.</small>
      </>}
    </div>

    <div className="program-mode-actions">
      {isWhatIf ? <button type="button" className="program-mode-exit" onClick={exitWhatIf}>Exit What-if</button>
        : <label className="program-mode-select"><span>What-if Major</span><select value="" disabled={whatIfStatus === "loading" || !alternatives.length} onChange={event => { if (event.target.value) void startWhatIf(event.target.value); }}>
          <option value="">{whatIfStatus === "loading" ? "Loading preview…" : alternatives.length ? "Preview another major…" : "No other majors available"}</option>
          {alternatives.map(program => <option key={program.slug} value={program.slug}>{program.title}</option>)}
        </select></label>}
    </div>
    {error && <p className="program-mode-error" role="alert">{error}</p>}
  </section>;
}
