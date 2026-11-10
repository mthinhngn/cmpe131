import { useState } from "react";
import { useCatalog } from "./CatalogContext";

export function ProgramRequirements() {
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const programs = catalog.selectedPrograms ?? [];
  return <section className="program-requirements" aria-label="Selected program requirements">
    {programs.length > 1 && <p>{programs.map(p => p.title).join(" + ")}</p>}
    {catalog.sequenceKind === "draft" && <p className="program-draft"><strong>Draft semester sequence</strong> · Generated from official program requirements. Confirm prerequisites, availability, repeat-course credit and shared-credit rules with your advisor. Your saved plan is unchanged.</p>}
    <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Official program requirements</summary>{open && <div className="program-requirement-evidence">
      {programs.map(p => <p key={p.slug}><a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.title} · Official catalog ↗</a></p>)}
      {catalog.requirementEvidence?.length ? catalog.requirementEvidence.map((s, i) => <section key={`${s.program}-${i}`}><h3>{programs.length > 1 ? `${s.program} · ` : ""}{s.title}</h3><p>{s.text}</p></section>) : catalog.requirementGroups.map(g => <section key={g.id}><h3>{g.title}</h3><p>{g.description}</p><ul>{g.items.map(i => <li key={i.id}>{i.courseId ? catalog.courses.find(c => c.id === i.courseId)?.code : i.label}{i.description ? ` · ${i.description}` : ""}</li>)}</ul></section>)}
    </div>}</details>
  </section>;
}
