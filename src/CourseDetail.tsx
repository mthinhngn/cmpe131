import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { GraduationCap } from "@phosphor-icons/react/dist/csr/GraduationCap";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { parseSlot, slotLabel } from "./academicProfile";
import { useCatalog } from "./CatalogContext";
import type { Course, CourseOffering } from "./types";
import { useSchedule } from "./ScheduleContext";
import { scheduleSourceDate, termName } from "./scheduleTerms";
import { ProfessorReviewLink } from "./ProfessorReviewLink";
import { CourseFeedback } from "./CourseFeedback";

export function CourseDetail({ course, onClose, variant, animateEntry = true }: { course: Course; onClose: () => void; variant?: "roadmap"; animateEntry?: boolean }) {
  const isRoadmap = variant === "roadmap";
  const { catalog, courseById, takenCourseIds, toggleTakenCourse, plans, setPlan, removePlan, termOrder, startingTerm } = useCatalog();
  const { isSelected, hasSelectedComponent, selectOffering, removeOffering, offerings: importedOfferings, termLabel, activeTerm, terms, setActiveTerm, sectionData, sectionStatus, pending } = useSchedule();
  const dialog = useRef<HTMLElement>(null);
  const handingOff = useRef(false);
  const sectionLock = useRef(false);
  const [changingSection, setChangingSection] = useState<string | null>(null);
  const [sectionFeedback, setSectionFeedback] = useState<{ id: string; message: string; error: boolean } | null>(null);
  const changeSection = async (offering: CourseOffering) => {
    if (sectionLock.current || pending) return;
    sectionLock.current = true;
    setChangingSection(offering.classNumber);
    setSectionFeedback(null);
    try {
      const result = await (isSelected(offering.classNumber) ? removeOffering(offering.classNumber) : selectOffering(offering));
      setSectionFeedback({ id: offering.classNumber, message: result.message, error: result.status === "error" });
    } catch {
      setSectionFeedback({ id: offering.classNumber, message: "The section could not be saved. Please try again.", error: true });
    } finally { sectionLock.current = false; setChangingSection(null); }
  };
  useEffect(() => {
    if (sectionFeedback) dialog.current?.querySelector(".detail-schedule-feedback[role]")?.scrollIntoView({ block: "nearest" });
  }, [sectionFeedback]);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = () => {
    if (!isRoadmap || !animateEntry) { onClose(); return; }
    if (closing) return;
    const sheet = dialog.current;
    if (sheet) {
      const style = getComputedStyle(sheet);
      const from = { transform: style.transform, opacity: style.opacity };
      sheet.getAnimations().forEach(animation => animation.cancel());

      const curve = style.getPropertyValue("--ease-out").trim() || "cubic-bezier(.23,1,.32,1)";
      sheet.animate([from, { transform: "translateX(28px)", opacity: 0 }], { duration: 200, easing: curve, fill: "forwards" });
      const layer = sheet.parentElement;
      if (layer) {
        const opacity = getComputedStyle(layer).opacity;
        layer.getAnimations().forEach(animation => animation.cancel());
        layer.animate([{ opacity }, { opacity: 0 }], { duration: 200, easing: curve, fill: "forwards" });
      }
    }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useLayoutEffect(() => {
    const sheet = dialog.current;
    if (!isRoadmap || !animateEntry || !sheet) return;

    const curve = getComputedStyle(sheet).getPropertyValue("--ease-out").trim() || "cubic-bezier(.23,1,.32,1)";
    const arrival = sheet.animate([
      { transform: "translateX(28px)", opacity: 0 },
      { transform: "translateX(0)", opacity: 1 },
    ], { duration: 250, easing: curve });
    const backdrop = sheet.parentElement?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: curve });
    return () => { arrival.cancel(); backdrop?.cancel(); };
  }, [isRoadmap, animateEntry]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (pending?.courseId !== course.id) return;
    handingOff.current = true;
    closeRef.current();
  }, [pending?.courseId, course.id]);
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, summary, input') ?? []).filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", listener);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", listener); if (!handingOff.current) origin?.focus(); };
  }, []);
  const isTaken = takenCourseIds.has(course.id);
  const requirementNote = catalog.requirementGroups.flatMap(group => group.items).find(item => item.courseId === course.id)?.description;
  const hasTermData = sectionStatus === "available";
  const prerequisites = course.prerequisiteCourseIds
    .map((id) => courseById.get(id))
    .filter((item): item is Course => Boolean(item));
  const corequisites = course.corequisiteCourseIds
    .map((id) => courseById.get(id))
    .filter((item): item is Course => Boolean(item));
  const offerings = importedOfferings.filter(o => o.courseCode === course.code && (o.listed !== false || isSelected(o.classNumber)));
  const listedCount = offerings.filter(o => o.listed !== false).length;
  const sourceDate = sectionData?.sourceUpdatedOn;
  const scheduleUrl = sectionData?.sourceUrl ?? (activeTerm === catalog.currentTerm.id ? catalog.currentTerm.sourceUrl : undefined);

  return (
    <div className={`drawer-layer${isRoadmap ? " roadmap-detail-layer" : ""}`} data-closing={closing || undefined} data-motion={animateEntry ? "pointer" : "keyboard"} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && dismiss()}>
      <aside ref={dialog} className={`detail-drawer${isRoadmap ? " roadmap-course-detail" : ""}`} role="dialog" aria-modal="true" aria-labelledby="course-title">
        <header className="drawer-header">
          <div className="drawer-title"><span className="course-code">{course.code}</span><h2 id="course-title">{course.title}</h2></div>
          <button className="icon-button" onClick={(event) => { if (event.detail === 0) onClose(); else dismiss(); }} aria-label="Close course details"><X size={20} /></button>
          {isRoadmap && <div className="detail-summary"><span><strong>{course.unitsText === "" ? "TBA" : course.unitsText ?? course.units}</strong> {course.units === 1 ? "unit" : "units"}</span>{course.recommendedSemester > 0 && <span>Recommended <strong>Semester {course.recommendedSemester}</strong></span>}<a href={course.sourceUrl} target="_blank" rel="noreferrer">SJSU source <ArrowSquareOut size={13}/></a></div>}
        </header>
        <div className="drawer-content">
          {isRoadmap && <section className="detail-about"><h3>What you’ll study</h3><p>{course.description}</p>{requirementNote && <p>{requirementNote}</p>}</section>}
          {isRoadmap && <div className="detail-plan-heading"><h3>Your plan</h3><span>{isTaken ? "Completed" : plans[course.id] ? plans[course.id].status === "in-progress" ? "In progress" : "Planned" : "Not planned"}</span></div>}
          <section className="taken-control" aria-label="Course completion">
            <button type="button" aria-pressed={isTaken} onClick={() => { toggleTakenCourse(course.id); }}>
              <CheckCircle size={19} weight={isTaken ? "fill" : "regular"} />
              {isRoadmap ? isTaken ? "Completed · Undo" : "Mark complete" : isTaken ? "Already taken · Undo" : "Mark as already taken"}
            </button>
            <p role="status">{isRoadmap ? isTaken ? "This course is marked complete on your roadmap." : "Track this course in your degree plan." : <>{isTaken ? "Marked with a red line on your chart." : "Mark this course to cross it out on your chart."} Marks save with your workspace.</>}</p>
          </section>
          <section className="plan-controls" aria-label="Plan this course">
            <label>Plan semester<select value={plans[course.id]?.semester ?? ""} onChange={event => { if (event.target.value) setPlan(course.id, parseSlot(event.target.value), plans[course.id]?.status); else removePlan(course.id); }}><option value="">Not planned</option>{termOrder.map(slot => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}</select></label>
            {plans[course.id] && <label>Course status<select value={plans[course.id].status} onChange={event => setPlan(course.id, plans[course.id].semester, event.target.value as "planned" | "in-progress")}><option value="planned">Planned</option><option value="in-progress">In progress</option></select></label>}
            {!isRoadmap && <p>Session draft · Changes reset on refresh. Planning does not enroll you.</p>}
          </section>
          {!isRoadmap && <><div className="course-facts">
            <span><BookOpen size={17} />{course.units} {course.units === 1 ? "unit" : "units"}</span>
            {course.recommendedSemester > 0 && <span><GraduationCap size={17} />Recommended semester {course.recommendedSemester}</span>}
          </div>
          <p>{course.description}</p>
          {requirementNote && <p>{requirementNote}</p>}</>}
          <section className="prerequisite-section">
            <h3>Prerequisites</h3>
            {prerequisites.length ? (
              <div className="prerequisite-list">
                {prerequisites.map((item) => (
                  <div key={item.id}><strong>{item.code}</strong><span>{item.title}</span>{isRoadmap && <small>{takenCourseIds.has(item.id) ? "Completed" : "Recorded prerequisite"}</small>}</div>
                ))}
              </div>
            ) : <div className="no-prerequisite"><CheckCircle size={19} weight="fill" />No roadmap course prerequisite recorded.</div>}
            {course.prerequisiteText && <p>{course.prerequisiteText}</p>}
          </section>
          {corequisites.length > 0 && <section className="prerequisite-section"><h3>Corequisites</h3><div className="prerequisite-list">{corequisites.map((item) => <div key={item.id}><strong>{item.code}</strong><span>{item.title}</span></div>)}</div></section>}
          <CourseFeedback courseCode={course.code} />
          <section className="offerings-section">
            {isRoadmap && <div className="detail-section-heading"><h3>Listed sections</h3><span>{hasTermData ? `${listedCount} ${listedCount === 1 ? "section" : "sections"}` : "Data unavailable"}</span></div>}
            <header className="offerings-header">
              <div><span className="current-term-label">Semester</span>
                <details className="semester-picker" onKeyDown={(event) => {
                  if (event.key === "Escape") { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
                }} onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
                }}>
                  <summary>{termLabel} <CaretDown size={16} /></summary>
                  <div className="semester-options" role="group" aria-label="Choose semester">
                    {terms.map((term) => <button type="button" key={term} aria-pressed={activeTerm === term} onClick={(event) => {
                      setActiveTerm(term);
                      const picker = event.currentTarget.closest("details");
                      if (picker) { picker.open = false; picker.querySelector("summary")?.focus(); }
                    }}><span>{termName(term)}</span>{term === catalog.currentTerm.id && <small>Current</small>}</button>)}
                  </div>
                </details>
              </div>
              {!isRoadmap && <span>{hasTermData ? `${listedCount} listed` : "Data pending"}</span>}
            </header>
            {hasTermData && <p className="offerings-note">Open seats from SJSU’s public schedule{sourceDate && ` · SJSU updated ${scheduleSourceDate(sourceDate)}`}.</p>}
            {offerings.length ? <div className="offering-list">
              {offerings.map((offering) => {
                const isOpen = offering.openSeats > 0;
                const selectedForSchedule = isSelected(offering.classNumber);
                const replacesComponent = !selectedForSchedule && hasSelectedComponent(offering);
                return <article className={`offering-card${selectedForSchedule ? " section-selected" : ""}`} key={offering.classNumber} onClick={(event) => {
                  if (isRoadmap) return;
                  if ((event.target as HTMLElement).closest("a, button, summary, details")) return;
                  const details = event.currentTarget.querySelector("details");
                  if (details) details.open = !details.open;
                }}>
                  <header>
                    <div><strong>Section {offering.sectionNumber}</strong><span>Class #{offering.classNumber} · {offering.component}</span></div>
                    {offering.listed !== false && <span className={`seat-status ${isOpen ? "open" : "full"}`}>{offering.seatsKnown === false ? "Seats unpublished" : isOpen ? `${offering.openSeats} open` : "0 open seats"}</span>}
                  </header>
                  <dl>
                    <div><dt><Clock size={15} />Meeting</dt><dd>{offering.days || "TBA"} · {offering.times || "TBA"}</dd></div>
                    <div><dt><MapPin size={15} />Mode</dt><dd>{offering.mode}{offering.location ? ` · ${offering.location}` : ""}</dd></div>
                    <div><dt><CalendarBlank size={15} />Dates</dt><dd>{offering.dates}</dd></div>
                    <div><dt><UsersThree size={15} />Professor</dt><dd>{offering.instructors?.join(", ") || "Not announced"}</dd></div>
                  </dl>
                  <div className="offering-schedule-action">
                    <button type="button" aria-pressed={selectedForSchedule} disabled={!!changingSection || !!pending || (offering.scheduleReview && !selectedForSchedule)} onClick={() => { void changeSection(offering); }}>
                      {selectedForSchedule ? <CheckCircle size={17} weight="fill" /> : <Plus size={17} />}
                      {changingSection === offering.classNumber ? "Saving…" : selectedForSchedule ? "Added to schedule" : replacesComponent ? `Replace ${offering.component} section` : "Add to schedule"}
                    </button>
                    {offering.scheduleReview && <p className="detail-schedule-feedback">{offering.listed === false ? "No longer listed by SJSU" : "Verify this section with SJSU before selecting it."}</p>}
                    {sectionFeedback?.id === offering.classNumber && <p className="detail-schedule-feedback" role={sectionFeedback.error ? "alert" : "status"}>{sectionFeedback.message}{sectionFeedback.error && !startingTerm && <> <a href="/account">Set your first semester in Account</a>.</>}</p>}
                  </div>
                  <details className="professor-links">
                    <summary>{isRoadmap ? "Professor reviews" : `Section ${offering.sectionNumber} · Rate My Professors`}</summary>
                    {offering.instructors?.length ? offering.instructors.map((name) => (
                      <div key={name}><span>{name} · </span><ProfessorReviewLink name={name} /></div>
                    )) : <p>SJSU has not announced a professor for this section.</p>}
                  </details>
                </article>;
              })}
            </div> : <div className="no-offerings" role="status">{sectionStatus === "loading" ? "Loading sections…" : hasTermData ? `This course is not listed in the ${termLabel} schedule.` : `${termLabel} section data is unavailable.`}</div>}
          </section>
        </div>
        <footer className="drawer-footer">
          {isRoadmap && <span className="detail-draft-note">Session draft · Resets on refresh. Planning does not enroll you.</span>}
          {hasTermData && scheduleUrl ? <a href={scheduleUrl} target="_blank" rel="noreferrer">Open {termLabel} schedule <ArrowSquareOut size={16} /></a> : <a href={course.sourceUrl} target="_blank" rel="noreferrer">Open course catalog <ArrowSquareOut size={16} /></a>}
        </footer>
      </aside>
    </div>
  );
}
