import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useCatalog } from "./CatalogContext";
import { useSchedule } from "./ScheduleContext";
import { CourseDetail } from "./CourseDetail";
import { ExplorerWeek } from "./ExplorerWeek";
import { ExplorerPanels, type ExplorerView } from "./ExplorerPanels";
import { dayLabel, detectTimeConflicts, formatMinute, parseMeeting } from "./schedule";
import type { Course, CourseOffering } from "./types";

const filters = [["all", "All courses"], ["scheduled", "In your week"], ["planned", "Planned"], ["in-progress", "In progress"], ["completed", "Completed"]] as const;

// Manus supplies the split catalog/week idea; all records and writes use the existing providers.
export function Courses() {
  const { catalog, plans, takenCourseIds } = useCatalog();
  const { selectedOfferings, isSelected, hasSelectedComponent, selectOffering, removeOffering } = useSchedule();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Course | null>(null);
  const [detailPointer, setDetailPointer] = useState(false);
  const [preview, setPreview] = useState<CourseOffering | null>(null);
  const [view, setView] = useState<ExplorerView>("split");
  const [notice, setNotice] = useState(selectedOfferings.length ? "Your saved week is ready. Keep shaping it." : "Choose a course. Find a section. Make it your week.");
  const [pointerMotion, setPointerMotion] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const previewOrigin = useRef<HTMLButtonElement | null>(null);
  const scheduledCodes = useMemo(() => new Set(selectedOfferings.map(offering => offering.courseCode)), [selectedOfferings]);
  const savedConflicts = useMemo(() => detectTimeConflicts(selectedOfferings).length, [selectedOfferings]);
  const savedUntimed = useMemo(() => selectedOfferings.filter(offering => parseMeeting(offering).status !== "scheduled").length, [selectedOfferings]);
  const offeringsByCode = useMemo(() => {
    const result = new Map<string, CourseOffering[]>();
    for (const offering of catalog.offerings) {
      const bucket = result.get(offering.courseCode);
      if (bucket) bucket.push(offering); else result.set(offering.courseCode, [offering]);
    }
    return result;
  }, [catalog.offerings]);
  const matchesStatus = (course: Course, value: string) => value === "all" || (value === "scheduled" ? scheduledCodes.has(course.code) : value === "completed" ? takenCourseIds.has(course.id) : !takenCourseIds.has(course.id) && plans[course.id]?.status === value);
  const courses = catalog.courses.filter(course => `${course.code} ${course.title}`.toLowerCase().includes(query.trim().toLowerCase()) && matchesStatus(course, status));
  const update = (key: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  // A provider refresh must not leave a preview pointing at an old catalog record.
  useEffect(() => { setPreview(null); }, [catalog]);
  useEffect(() => {
    if (preview && selectedOfferings.some(offering => offering.classNumber === preview.classNumber)) setPreview(null);
  }, [selectedOfferings, preview]);
  const choose = (offering: CourseOffering) => {
    const selected = isSelected(offering.classNumber);
    if (selected) removeOffering(offering.classNumber); else selectOffering(offering);
    setPreview(null);
    setNotice(`${offering.courseCode} · Section ${offering.sectionNumber} ${selected ? "removed from" : "added to"} your week.`);
  };
  const remove = (offering: CourseOffering) => {
    removeOffering(offering.classNumber);
    setNotice(`${offering.courseCode} · Section ${offering.sectionNumber} removed from your week.`);
  };
  const browse = () => {
    setView("split");
    requestAnimationFrame(() => search.current?.focus());
  };
  const returnToSections = () => {
    setView("split");
    requestAnimationFrame(() => {
      previewOrigin.current?.focus({ preventScroll: true });
      previewOrigin.current?.scrollIntoView({ block: "center", behavior: pointerMotion ? "smooth" : "instant" });
    });
  };
  const cancelPreview = () => {
    setPreview(null);
    setNotice("Preview dismissed. Your saved week is unchanged.");
    if (window.matchMedia("(max-width:760px)").matches) returnToSections();
  };
  const trySection = (offering: CourseOffering, origin: HTMLButtonElement) => {
    if (preview?.classNumber === offering.classNumber) { cancelPreview(); return; }
    previewOrigin.current = origin;
    setView("split");
    setPreview(offering);
    setNotice(`Previewing ${offering.courseCode} section ${offering.sectionNumber}. Your saved week is unchanged.`);
    if (window.matchMedia("(max-width:760px)").matches) requestAnimationFrame(() => {
      document.getElementById("explorer-week")?.scrollIntoView({ block: "start", behavior: pointerMotion ? "smooth" : "instant" });
      document.getElementById("cx-week-heading")?.focus({ preventScroll: true });
    });
  };

  return <main className="cx-page" data-motion={pointerMotion ? "pointer" : "keyboard"} onPointerDown={() => setPointerMotion(true)} onKeyDown={() => setPointerMotion(false)}>
    <header className="cx-intro">
      <div><h1>Build a week<br /><span>that fits.</span></h1><p>Browse the catalog, compare sections, and watch your<br className="cx-desktop-break" /> next semester take shape in real time.</p></div>
      <div className="cx-intro-aside"><span className="cx-aside-number">01</span><p>ONE SECTION<br />AT A TIME</p><svg className="cx-arrow-down-line" viewBox="0 0 48 94" fill="none" aria-hidden="true"><path d="M1 1v40c0 20 12 31 31 31h14" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" /><path d="m41 67 5 5-5 5" stroke="currentColor" strokeWidth="1" /></svg></div>
    </header>

    <ExplorerPanels term={catalog.currentTerm.name} view={view} onViewChange={setView} sectionCount={selectedOfferings.length} conflictCount={savedConflicts} untimedCount={savedUntimed} catalog={
      <section className="cx-catalog" aria-labelledby="cx-catalog-heading">
        <div className="cx-catalog-title"><h2 id="cx-catalog-heading">Find your next course.</h2><span>{catalog.courses.length} courses</span></div>
        <label className="cx-search"><MagnifyingGlass size={18} aria-hidden="true" /><input ref={search} aria-label="Search courses by code or title" placeholder="Course code or something you’re curious about" value={query} onChange={event => update("q", event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => { update("q", ""); search.current?.focus(); }}><X size={15} /></button>}</label>
        <div className="cx-filters" role="group" aria-label="Filter courses by status">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => update("status", value === "all" ? "" : value)}>{label}<span>{catalog.courses.filter(course => matchesStatus(course, value)).length}</span></button>)}</div>
        <div className="cx-results-caption"><span role="status">{courses.length} {courses.length === 1 ? "course" : "courses"}{query.trim() ? ` matching “${query.trim()}”` : " in your program"}</span><span>Units</span></div>
        <div className="cx-course-list">
          {courses.map(course => {
            const offerings = offeringsByCode.get(course.code) ?? [];
            const open = expanded === course.id;
            const courseStatus = takenCourseIds.has(course.id) ? "Completed" : plans[course.id]?.status === "planned" ? "Planned" : plans[course.id]?.status === "in-progress" ? "In progress" : null;
            return <article className={`cx-course${open ? " cx-expanded" : ""}`} key={course.id}>
              <button className="cx-course-trigger" type="button" aria-expanded={open} aria-controls={`sections-${course.id}`} onClick={() => { setExpanded(open ? null : course.id); setPreview(null); }}>
                <span className="cx-course-copy"><strong>{course.code}{scheduledCodes.has(course.code) && <Check size={13} aria-label="In your week" />}{courseStatus && <small>{courseStatus}</small>}</strong><span>{course.title}</span></span><span className="cx-course-units">{course.units}</span><CaretDown size={15} aria-hidden="true" />
              </button>
              {open && <div className="cx-course-content" id={`sections-${course.id}`}>
                <div className="cx-section-intro"><span>{offerings.length} listed {offerings.length === 1 ? "section" : "sections"}</span><button type="button" onClick={(event) => { setDetailPointer(event.detail > 0); setDetail(course); }}>Requirements & details <ArrowRight size={13} /></button></div>
                {!offerings.length && <p className="cx-no-sections">No listed sections for {catalog.currentTerm.name}. You can still review requirements and add this course to your semester plan.</p>}
                {offerings.map(offering => {
                  const selected = isSelected(offering.classNumber);
                  const isPreview = preview?.classNumber === offering.classNumber;
                  const others = selectedOfferings.filter(item => item.courseCode !== offering.courseCode || item.component !== offering.component);
                  const conflicts = detectTimeConflicts([...others, offering]).filter(conflict => conflict.left.classNumber === offering.classNumber || conflict.right.classNumber === offering.classNumber);
                  const meeting = parseMeeting(offering);
                  const meetingKnown = meeting.status === "scheduled";
                  const meetingLabel = meetingKnown ? meeting.patterns.map(pattern => `${pattern.days.map(day => dayLabel(day).slice(0, 3)).join(" / ")} · ${formatMinute(pattern.startMinute)}–${formatMinute(pattern.endMinute)}`).join("; ") : `${offering.days || "TBA"} · ${offering.times || "Time to be announced"}`;
                  return <div className={`cx-section${selected ? " cx-section-selected" : ""}${isPreview ? " cx-section-preview" : ""}`} key={offering.classNumber}>
                    <div className="cx-section-top"><strong>Section {offering.sectionNumber} <span>{offering.component}</span></strong><span className={offering.openSeats > 0 ? "cx-seats" : "cx-seats cx-seats-full"}>{offering.openSeats > 0 ? `${offering.openSeats} open seats` : "No open seats"}</span></div>
                    <p className="cx-section-time">{meetingLabel}</p>
                    <p>{offering.instructors?.join(", ") || "Instructor to be announced"}</p><p>{offering.mode}{offering.location ? ` · ${offering.location}` : ""}</p>
                    <p className={`cx-fit${conflicts.length || !meetingKnown ? " cx-fit-warning" : ""}`}>{conflicts.length ? `Overlaps ${[...new Set(conflicts.map(conflict => conflict.left.classNumber === offering.classNumber ? conflict.right.courseCode : conflict.left.courseCode))].join(", ")}` : !meetingKnown ? "Meeting time needs review" : "No overlap with your selected sections"}</p>
                    <div className="cx-section-actions"><button type="button" aria-pressed={isPreview} disabled={selected} onClick={event => trySection(offering, event.currentTarget)}>{isPreview ? "Cancel preview" : selected ? "In your week" : "Preview section"}</button><button className="cx-add" type="button" aria-pressed={selected} onClick={() => choose(offering)}>{selected ? <Check size={14} /> : <Plus size={14} />}{selected ? "Remove" : hasSelectedComponent(offering) ? "Replace section" : "Add to week"}</button></div>
                  </div>;
                })}
              </div>}
            </article>;
          })}
          {!courses.length && <div className="cx-empty-results"><MagnifyingGlass size={24} /><h3>No courses found.</h3><p>Try a course code or a different filter.</p><button type="button" onClick={() => { setParams({}); search.current?.focus(); }}>Clear search & filters <ArrowRight size={14} /></button></div>}
        </div>
      </section>} week={
      <ExplorerWeek preview={preview} onCancelPreview={cancelPreview} onReturnToSections={returnToSections} onConfirmPreview={() => preview && choose(preview)} onRemove={remove} onBrowse={browse} onInspect={offering => { const course = catalog.courses.find(item => item.code === offering.courseCode); if (course) { setDetailPointer(false); setDetail(course); } }} notice={notice} />
    } />
    <p className="cx-source-note">Section times and seats reflect the published snapshot. <a href={catalog.currentTerm.sourceUrl} target="_blank" rel="noreferrer">Verify with SJSU <ArrowRight size={12} /></a><span>Section selections save in this browser. Semester plans are session drafts.</span></p>
    {detail && <CourseDetail variant="roadmap" animateEntry={detailPointer} course={detail} onClose={() => setDetail(null)} />}
  </main>;
}


