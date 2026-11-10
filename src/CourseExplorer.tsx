import { ProductPageHeading } from "./ProductPageHeading";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ProfessorReviewLink } from "./ProfessorReviewLink";
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
import { CourseFilterControls } from "./CourseFilterPanel";
import { DEFAULT_FILTERS, filterGroups, hasSectionFilters, indexSections, readCourseFilters, selectFilteredCourses, subjectFor, writeCourseFilters, type CourseFilters } from "./courseFilters";

const SEARCH_PAGE_SIZE = 30;
const INITIAL_COURSE_COUNT = 8;

// N1 Graphite presentation; records and writes stay with the shared providers.
export function Courses() {
  const { catalog, allCourses, plans, takenCourseIds, storageStatus, program, termToSlot } = useCatalog();
  const { selectedOfferings, isSelected, hasSelectedComponent, selectOffering, removeOffering, offerings: termOfferings, activeTerm, termLabel, sourceUrl, choiceNotice, sectionStatus, retrySections } = useSchedule();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const searchQuery = useDeferredValue(query).trim().toLowerCase();
  const searching = query.trim().toLowerCase() !== searchQuery;
  const filterKey = new URLSearchParams([...params].filter(([key]) => key !== "q" && key !== "profile")).toString();
  const applied = useMemo(() => readCourseFilters(new URLSearchParams(filterKey)), [filterKey]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);
  const resultKey = JSON.stringify([program, activeTerm, searchQuery, applied]);
  const [page, setPage] = useState({ key: resultKey, limit: INITIAL_COURSE_COUNT });
  const limit = page.key === resultKey ? page.limit : INITIAL_COURSE_COUNT;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Course | null>(null);
  const [detailPointer, setDetailPointer] = useState(false);
  const [preview, setPreview] = useState<CourseOffering | null>(null);
  const [view, setView] = useState<ExplorerView>("split");
  const [notice, setNotice] = useState(selectedOfferings.length ? "Schedule loaded." : "No sections selected.");
  const [saving, setSaving] = useState(false);
  const [pointerMotion, setPointerMotion] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const appendPending = useRef(false);
  const lastScrollTop = useRef(0);
  const previewOrigin = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]"))) return;
      event.preventDefault(); setView("split"); requestAnimationFrame(() => search.current?.focus());
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const scheduledCodes = useMemo(() => new Set(selectedOfferings.map(offering => offering.courseCode)), [selectedOfferings]);
  const offeringsByCode = useMemo(() => {
    const result = new Map<string, CourseOffering[]>();
    for (const offering of termOfferings) {
      const bucket = result.get(offering.courseCode);
      if (bucket) bucket.push(offering); else result.set(offering.courseCode, [offering]);
    }
    return result;
  }, [termOfferings]);
  const expandedCourse = expanded ? allCourses.find(course => course.id === expanded) : undefined;
  const sectionDetails = useMemo(() => new Map((offeringsByCode.get(expandedCourse?.code ?? "") ?? []).map(offering => {
    const others = selectedOfferings.filter(item => item.courseCode !== offering.courseCode || item.component !== offering.component);
    return [offering.classNumber, {
      meeting: parseMeeting(offering),
      conflicts: others.flatMap(other => detectTimeConflicts([other, offering])),
    }];
  })), [expandedCourse, offeringsByCode, selectedOfferings]);
  const sectionIndex = useMemo(() => indexSections(termOfferings), [termOfferings]);
  const courseText = useMemo(() => new Map(allCourses.map(course => [course.id, `${course.code} ${course.title}`.toLowerCase()])), [allCourses]);
  const filterContext = useMemo(() => ({ degreeIds: new Set(catalog.courses.map(course => course.id)), scheduledCodes, sections: sectionIndex, courseText }), [catalog.courses, scheduledCodes, sectionIndex, courseText]);
  const subjects = useMemo(() => [...new Set(allCourses.map(course => subjectFor(course.code)))].sort(), [allCourses]);
  const components = useMemo(() => [...new Set(termOfferings.map(o => o.component.toUpperCase() || "UNLISTED"))].sort(), [termOfferings]);
  const instructors = useMemo(() => [...new Set(termOfferings.flatMap(o => o.instructors))].sort(), [termOfferings]);
  const degreeSuggestions = useMemo(() => {
    const degreeIds = new Set(catalog.courses.map(course => course.id));
    const slot = /^(winter|summer)-/.test(activeTerm) ? activeTerm : termToSlot[activeTerm];
    const priority = (course: Course) => plans[course.id] ? plans[course.id].semester === slot ? 0 : 1 : 2;
    return allCourses.filter(course => !takenCourseIds.has(course.id) && (degreeIds.has(course.id) || plans[course.id]))
      .sort((a, b) => priority(a) - priority(b) || (a.recommendedSemester || 99) - (b.recommendedSemester || 99) || a.code.localeCompare(b.code));
  }, [allCourses, catalog.courses, plans, takenCourseIds, activeTerm, termToSlot]);
  const browseCourses = useMemo(() => {
    const suggestedIds = new Set(degreeSuggestions.map(course => course.id));
    return [...degreeSuggestions, ...allCourses.filter(course => !suggestedIds.has(course.id))];
  }, [degreeSuggestions, allCourses]);
  const suggestions = !searchQuery && applied.scope !== "scheduled";
  const browseEmpty = suggestions && !filterGroups(applied).length;
  const searchPool = searchQuery ? allCourses : browseCourses;
  const filtered = useMemo(() => selectFilteredCourses(searchPool, searchQuery, applied, filterContext), [searchPool, searchQuery, applied, filterContext]);
  const courses = filtered.courses;
  const sectionFilters = hasSectionFilters(applied);
  const sectionFiltersUnavailable = sectionFilters && sectionStatus !== "available";
  const counts = useMemo(() => ({
    all: selectFilteredCourses(searchPool, searchQuery, { ...applied, scope: "all" }, filterContext).courses.length,
    scheduled: selectFilteredCourses(searchPool, searchQuery, { ...applied, scope: "scheduled" }, filterContext).courses.length,
    open: selectFilteredCourses(searchPool, searchQuery, { ...applied, availability: "open" }, filterContext).courses.length,
  }), [searchPool, searchQuery, applied, filterContext]);
  const applyFilters = (value: CourseFilters) => { setParams(previous => writeCourseFilters(previous, value)); setFiltersOpen(false); };
  const visibleCourses = courses.slice(0, limit);
  const appendCourses = () => {
    if (searching || appendPending.current || limit >= courses.length) return;
    appendPending.current = true;
    setPage({ key: resultKey, limit: Math.min(limit + SEARCH_PAGE_SIZE, courses.length) });
  };
  useEffect(() => { appendPending.current = false; }, [page, resultKey]);
  useEffect(() => {
    setPage({ key: resultKey, limit: INITIAL_COURSE_COUNT });
    setShowAllSections(false);
    lastScrollTop.current = 0;
    if (list.current) list.current.scrollTop = 0;
  }, [resultKey]);
  const update = (key: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  }, { replace: true });

  // A provider refresh must not leave a preview pointing at an old catalog record.
  useEffect(() => { setPreview(null); }, [catalog, activeTerm]);
  useEffect(() => {
    if (preview && selectedOfferings.some(offering => offering.classNumber === preview.classNumber)) setPreview(null);
  }, [selectedOfferings, preview]);
  const choose = useCallback(async (offering: CourseOffering) => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await (isSelected(offering.classNumber) ? removeOffering(offering.classNumber) : selectOffering(offering));
      setNotice(result.message);
      if (result.status !== "error") setPreview(null);
    } catch { setNotice("The change could not be saved. Please try again."); }
    finally { setSaving(false); }
  }, [saving, isSelected, removeOffering, selectOffering]);
  const remove = useCallback(async (offering: CourseOffering) => {
    if (saving) return;
    setSaving(true);
    try { const result = await removeOffering(offering.classNumber); setNotice(result.message); }
    catch { setNotice("The change could not be saved. Please try again."); }
    finally { setSaving(false); }
  }, [saving, removeOffering]);
  const browse = useCallback(() => {
    setView("split");
    requestAnimationFrame(() => search.current?.focus());
  }, []);
  const returnToSections = useCallback(() => {
    setView("split");
    requestAnimationFrame(() => {
      previewOrigin.current?.focus({ preventScroll: true });
      previewOrigin.current?.scrollIntoView({ block: "center", behavior: pointerMotion ? "smooth" : "instant" });
    });
  }, [pointerMotion]);
  const cancelPreview = useCallback(() => {
    setPreview(null);
    setNotice("Preview dismissed. Your saved schedule is unchanged.");
    if (window.matchMedia("(max-width:760px)").matches) returnToSections();
  }, [returnToSections]);
  const confirmPreview = useCallback(() => { if (preview) void choose(preview); }, [preview, choose]);
  const inspectOffering = useCallback((offering: CourseOffering) => {
    const course = allCourses.find(item => item.code === offering.courseCode);
    if (course) { setDetailPointer(false); setDetail(course); }
  }, [allCourses]);
  const trySection = (offering: CourseOffering, origin: HTMLButtonElement) => {
    if (preview?.classNumber === offering.classNumber) { cancelPreview(); return; }
    previewOrigin.current = origin;
    setView("split");
    setPreview(offering);
    setNotice(`Previewing ${offering.courseCode} section ${offering.sectionNumber}. Your saved schedule is unchanged.`);
    if (window.matchMedia("(max-width:760px)").matches) requestAnimationFrame(() => {
      document.getElementById("explorer-week")?.scrollIntoView({ block: "start", behavior: pointerMotion ? "smooth" : "instant" });
      document.getElementById("cx-week-heading")?.focus({ preventScroll: true });
    });
  };

  return <main className="cx-page" data-motion={pointerMotion ? "pointer" : "keyboard"} onPointerDown={() => setPointerMotion(true)} onKeyDown={() => setPointerMotion(false)}>
    <ProductPageHeading title="Schedule">
      <button className="cx-focus-button" type="button" aria-pressed={view === "week"} onClick={() => setView(view === "week" ? "split" : "week")}>{view === "week" ? "Show catalog" : "Expand schedule"}</button>
    </ProductPageHeading>

    <ExplorerPanels view={view} onViewChange={setView} catalog={
      <section className="cx-catalog" aria-labelledby="cx-catalog-heading">
        <div className="cx-catalog-title sr-only"><h2 id="cx-catalog-heading">Course catalog</h2><span>{allCourses.length} courses</span></div>
        <label className="cx-search"><MagnifyingGlass size={18} aria-hidden="true" /><input ref={search} aria-label="Search courses by code or title" aria-describedby="cx-search-guidance" placeholder="Search all courses" value={query} onChange={event => update("q", event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => { update("q", ""); search.current?.focus(); }}><X size={15} /></button>}<kbd aria-hidden="true">/</kbd></label>
        <CourseFilterControls applied={applied} onApply={applyFilters} open={filtersOpen} onOpenChange={setFiltersOpen} subjects={subjects} components={components} instructors={instructors} counts={{ all: sectionFiltersUnavailable ? "—" : counts.all, scheduled: sectionFiltersUnavailable ? "—" : counts.scheduled, open: sectionStatus !== "available" ? "—" : counts.open }} termLabel={termLabel}/>
        <p id="cx-search-guidance" className="sr-only" role="status" aria-live="polite">{searching ? "Updating results…" : sectionFiltersUnavailable ? "Section filter results are not available yet." : searchQuery.length === 1 ? "Enter at least 2 characters" : `${visibleCourses.length} of ${courses.length} ${applied.scope === "scheduled" && !searchQuery ? "selected courses" : "courses"}.${suggestions ? " Degree plan courses first." : ""}${visibleCourses.length < courses.length ? " Scroll down for more." : ""}`}</p>
        <div className="cx-course-list" hidden={filtersOpen} ref={list} aria-busy={searching} tabIndex={0} aria-label="Course results"
          onScroll={event => {
            const element = event.currentTarget;
            const movingDown = element.scrollTop > lastScrollTop.current;
            lastScrollTop.current = element.scrollTop;
            if (movingDown && element.scrollHeight - element.scrollTop - element.clientHeight < 160) appendCourses();
          }}
          onWheel={event => {
            // Eight initial rows may fit without a scrollbar; downward intent starts the next batch.
            if (event.deltaY > 0 && event.currentTarget.scrollHeight <= event.currentTarget.clientHeight + 1) appendCourses();
          }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (["ArrowDown", "PageDown", "End", " "].includes(event.key) && event.currentTarget.scrollHeight <= event.currentTarget.clientHeight + 1) {
              event.preventDefault();
              appendCourses();
            }
          }}>
          {visibleCourses.map((course, index) => {
            const allOfferings = offeringsByCode.get(course.code) ?? [];
            const restricted = sectionFilters || !!searchQuery && !(courseText.get(course.id) ?? "").includes(searchQuery);
            const matchingOfferings = filtered.matchingSections.get(course.code) ?? [];
            const offerings = restricted && !showAllSections ? matchingOfferings : allOfferings;
            const open = expanded === course.id;
            const courseStatus = takenCourseIds.has(course.id) ? "Completed" : plans[course.id]?.status === "planned" ? "Planned" : plans[course.id]?.status === "in-progress" ? "In progress" : null;
            return <article className={`cx-course${open ? " cx-expanded" : ""}`} key={course.id} style={{ "--i": Math.min(index, 16) } as CSSProperties}>
              <button className="cx-course-trigger" type="button" aria-expanded={open} aria-controls={`sections-${course.id}`} onClick={() => { setExpanded(open ? null : course.id); setPreview(null); setShowAllSections(false); }}>
                <i className={`cx-course-dot${scheduledCodes.has(course.code) ? " is-selected" : ""}`} aria-hidden="true" /><span className="cx-course-copy"><strong>{course.code}{scheduledCodes.has(course.code) && <Check size={13} aria-label="In your week" />}{courseStatus && <small>{courseStatus}</small>}</strong><span>{course.title}</span></span><span className="cx-course-units">{course.unitsText === "" ? "TBA" : `${course.unitsText ?? course.units}u`}</span><CaretDown size={15} aria-hidden="true" />
              </button>
              {open && <div className="cx-course-content" id={`sections-${course.id}`}>
                <div className="cx-section-intro"><span>{offerings.length} {restricted && !showAllSections ? "matching" : "listed"} {offerings.length === 1 ? "section" : "sections"}</span><button type="button" onClick={(event) => { setDetailPointer(event.detail > 0); setDetail(course); }}>Requirements & details <ArrowRight size={13} /></button></div>
                {restricted && matchingOfferings.length < allOfferings.length && <p className="cx-section-match-note">Required companion sections stay available when you add a course. <button type="button" className="cx-section-filter-toggle" onClick={() => setShowAllSections(value => !value)}>{showAllSections ? "Show matching sections" : `Show all ${allOfferings.length} sections`}</button></p>}
                {!offerings.length && <p className="cx-no-sections">No listed sections for {termLabel}. You can still review requirements and add this course to your semester plan.</p>}
                {offerings.map(offering => {
                  const selected = isSelected(offering.classNumber);
                  const isPreview = preview?.classNumber === offering.classNumber;
                  const { conflicts, meeting } = sectionDetails.get(offering.classNumber)!;
                  const meetingKnown = meeting.status === "scheduled";
                  const meetingLabel = meetingKnown ? meeting.patterns.map(pattern => `${pattern.days.map(day => dayLabel(day).slice(0, 3)).join(" / ")} · ${formatMinute(pattern.startMinute)}–${formatMinute(pattern.endMinute)}`).join("; ") : `${offering.days || "TBA"} · ${offering.times || "Time to be announced"}`;
                  return <div className={`cx-section${selected ? " cx-section-selected" : ""}${isPreview ? " cx-section-preview" : ""}`} key={offering.classNumber}>
                    <div className="cx-section-top"><strong>Section {offering.sectionNumber} <span>{offering.component}</span></strong><span className={offering.openSeats > 0 ? "cx-seats" : "cx-seats cx-seats-full"}>{offering.seatsKnown === false ? "Seats not listed" : offering.openSeats > 0 ? `${offering.openSeats} open seats` : "No open seats"}</span></div>
                    {offering.scheduleReview && <p className="cx-fit cx-fit-warning">Section details need review with SJSU before selection.</p>}{offering.notes && <p>{offering.notes}</p>}<p className="cx-section-time">{meetingLabel}</p>
                    <p className="cx-section-instructors">{offering.instructors?.length ? offering.instructors.map(name => <span className="cx-section-instructor" key={name}><span>{name}</span><ProfessorReviewLink name={name} /></span>) : "Instructor to be announced"}</p><p>{offering.mode}{offering.location ? ` · ${offering.location}` : ""}</p>
                    <p className={`cx-fit${conflicts.length || !meetingKnown ? " cx-fit-warning" : ""}`}>{conflicts.length ? `Overlaps ${[...new Set(conflicts.map(conflict => conflict.left.classNumber === offering.classNumber ? conflict.right.courseCode : conflict.left.courseCode))].join(", ")}` : !meetingKnown ? "Meeting time needs review" : "No overlap with your selected sections"}</p>
                    <div className="cx-section-actions"><button type="button" aria-pressed={isPreview} disabled={selected || saving} onClick={event => trySection(offering, event.currentTarget)}>{isPreview ? "Cancel preview" : selected ? "In your week" : "Preview section"}</button><button className="cx-add" type="button" disabled={saving || offering.scheduleReview} aria-pressed={selected} onClick={() => choose(offering)}>{selected ? <Check size={14} /> : <Plus size={14} />}{selected ? "Remove" : hasSelectedComponent(offering) ? "Replace section" : "Add to week"}</button></div>
                  </div>;
                })}
              </div>}
            </article>;
          })}
          {sectionFiltersUnavailable && <div className="cx-filter-data-notice" role="status">{sectionStatus === "loading" ? "Loading sections for these filters..." : "Section filters are unavailable for this term. Your saved schedule is unchanged."}{sectionStatus === "unavailable" && <button type="button" onClick={() => retrySections()}>Retry sections</button>}</div>}
          {!courses.length && !sectionFiltersUnavailable && <div className="cx-empty-results"><MagnifyingGlass size={24} /><h3>{searchQuery.length === 1 ? "Keep typing to search" : browseEmpty ? "Search the full catalog" : "No matching courses"}</h3><p>{searchQuery.length === 1 ? "Enter at least 2 characters of a course code or title." : browseEmpty ? "Find courses by code or title, or try a different filter." : "Try a course code or a different filter."}</p><button type="button" onClick={() => { setParams(previous => { const next = writeCourseFilters(previous, DEFAULT_FILTERS); next.delete("q"); return next; }); search.current?.focus(); }}>Clear search & filters <ArrowRight size={14} /></button></div>}
        </div>
      </section>} week={
      <ExplorerWeek preview={preview} onCancelPreview={cancelPreview} onReturnToSections={returnToSections} onConfirmPreview={confirmPreview} saving={saving} onRemove={remove} onBrowse={browse} onInspect={inspectOffering} notice={choiceNotice || notice} />
    } />
    <p className="cx-source-note">Section times and seats reflect the published snapshot. <a href={sourceUrl ?? catalog.currentTerm.sourceUrl} target="_blank" rel="noreferrer">Verify with SJSU <ArrowRight size={12} /></a><span>{storageStatus === "saved" ? "Changes saved to your workspace." : "Changes use your shared planning workspace."}</span></p>
    {detail && <CourseDetail variant="roadmap" animateEntry={detailPointer} course={detail} onClose={() => setDetail(null)} />}
  </main>;
}


