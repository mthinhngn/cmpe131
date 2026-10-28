import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Grid2X2,
  LayoutList,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";

type Meeting = { day: Day; start: number; end: number };
type Day = "MON" | "TUE" | "WED" | "THU" | "FRI";
type CourseStatus = "Open" | "Closed";
type StudentStatus = "Available" | "Planned" | "In progress";

type Section = {
  id: string;
  instructor: string;
  room: string;
  seats: number;
  capacity: number;
  meetings: Meeting[];
  type: "LEC" | "LAB";
};

type Course = {
  code: string;
  title: string;
  units: number;
  status: CourseStatus;
  studentStatus: StudentStatus;
  accent: string;
  description: string;
  sections: Section[];
};

const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_LABELS: Record<Day, string> = { MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday" };
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const STORAGE_KEY = "course-radar-explorer-schedule";

const courses: Course[] = [
  { code: "CMPE 30", title: "Programming Concepts and Methodology", units: 4, status: "Open", studentStatus: "Available", accent: "blue", description: "Build the fluency that everything else in your computer engineering path leans on.", sections: [
    { id: "01", instructor: "Ben Reed", room: "BBC004", seats: 18, capacity: 32, type: "LEC", meetings: [{ day: "MON", start: 10.5, end: 11.75 }, { day: "WED", start: 10.5, end: 11.75 }] },
    { id: "02", instructor: "Alicia Park", room: "BBC004", seats: 7, capacity: 32, type: "LEC", meetings: [{ day: "TUE", start: 13, end: 14.25 }, { day: "THU", start: 13, end: 14.25 }] },
  ] },
  { code: "ENGR 10", title: "Introduction to Engineering", units: 3, status: "Open", studentStatus: "Available", accent: "mint", description: "A studio-style introduction to the habits, systems, and people behind engineering work.", sections: [
    { id: "01", instructor: "Maya Chen", room: "ENGR 101", seats: 21, capacity: 36, type: "LEC", meetings: [{ day: "TUE", start: 9, end: 10.25 }, { day: "THU", start: 9, end: 10.25 }] },
    { id: "03", instructor: "Maya Chen", room: "ENGR 101", seats: 4, capacity: 36, type: "LEC", meetings: [{ day: "WED", start: 15, end: 16.25 }] },
  ] },
  { code: "ENGL 1A", title: "First Year Writing", units: 3, status: "Open", studentStatus: "Available", accent: "violet", description: "Learn to make a precise argument and give your ideas a shape other people can follow.", sections: [
    { id: "04", instructor: "Nora Ellis", room: "FOB 206", seats: 12, capacity: 24, type: "LEC", meetings: [{ day: "MON", start: 13, end: 14.25 }, { day: "WED", start: 13, end: 14.25 }] },
  ] },
  { code: "MATH 30", title: "Calculus I", units: 3, status: "Open", studentStatus: "Available", accent: "orange", description: "The first movement in a sequence about change, continuity, and the language of motion.", sections: [
    { id: "01", instructor: "Emilia Soto", room: "SCI 201", seats: 9, capacity: 40, type: "LEC", meetings: [{ day: "MON", start: 14.5, end: 15.75 }, { day: "WED", start: 14.5, end: 15.75 }] },
    { id: "02", instructor: "Emilia Soto", room: "SCI 201", seats: 2, capacity: 40, type: "LEC", meetings: [{ day: "TUE", start: 11, end: 12.25 }, { day: "THU", start: 11, end: 12.25 }] },
  ] },
  { code: "CMPE 50", title: "Intro to Data Structures and Object-Oriented Programming", units: 4, status: "Closed", studentStatus: "Planned", accent: "blue", description: "Move from writing programs to designing the structures that make programs work.", sections: [
    { id: "01", instructor: "David Kim", room: "BBC118", seats: 0, capacity: 30, type: "LEC", meetings: [{ day: "TUE", start: 10.5, end: 11.75 }, { day: "THU", start: 10.5, end: 11.75 }] },
  ] },
  { code: "ENGL 1B", title: "Argument and Analysis", units: 3, status: "Closed", studentStatus: "Planned", accent: "violet", description: "Read closely, write clearly, and make the evidence carry the weight of the claim.", sections: [{ id: "02", instructor: "Leo Martin", room: "FOB 111", seats: 0, capacity: 24, type: "LEC", meetings: [{ day: "MON", start: 11, end: 12.25 }, { day: "WED", start: 11, end: 12.25 }] }] },
  { code: "MATH 31", title: "Calculus II", units: 4, status: "Closed", studentStatus: "Planned", accent: "orange", description: "Continue the calculus sequence through integration, series, and new ways to model change.", sections: [{ id: "01", instructor: "Priya Shah", room: "SCI 205", seats: 0, capacity: 36, type: "LEC", meetings: [{ day: "MON", start: 9, end: 10.25 }, { day: "WED", start: 9, end: 10.25 }] }] },
  { code: "PHYS 50", title: "General Physics I: Mechanics", units: 4, status: "Closed", studentStatus: "In progress", accent: "mint", description: "The physics of motion, energy, and the systems that keep the physical world moving.", sections: [{ id: "01", instructor: "Owen Foster", room: "PHYS 102", seats: 0, capacity: 32, type: "LEC", meetings: [{ day: "TUE", start: 14.5, end: 15.75 }, { day: "THU", start: 14.5, end: 15.75 }] }] },
  { code: "MATH 32", title: "Calculus III", units: 3, status: "Open", studentStatus: "Available", accent: "orange", description: "Extend familiar calculus ideas into multiple dimensions and richer geometric spaces.", sections: [{ id: "01", instructor: "Priya Shah", room: "SCI 204", seats: 11, capacity: 30, type: "LEC", meetings: [{ day: "TUE", start: 16, end: 17.25 }, { day: "THU", start: 16, end: 17.25 }] }] },
  { code: "BIOL 10", title: "The Living World", units: 3, status: "Open", studentStatus: "Available", accent: "mint", description: "A systems view of the living world, from cells to ecosystems and the connections between them.", sections: [{ id: "01", instructor: "Tara Wells", room: "SCI 118", seats: 16, capacity: 40, type: "LEC", meetings: [{ day: "FRI", start: 10, end: 12.5 }] }] },
  { code: "MATH 42", title: "Discrete Mathematics", units: 3, status: "Open", studentStatus: "Available", accent: "orange", description: "The logic, structures, and patterns that become the grammar of computer science.", sections: [{ id: "01", instructor: "Jon Bell", room: "BBC 220", seats: 5, capacity: 28, type: "LEC", meetings: [{ day: "MON", start: 16, end: 17.25 }, { day: "WED", start: 16, end: 17.25 }] }] },
  { code: "PHYS 51", title: "General Physics II: Electricity and Magnetism", units: 4, status: "Closed", studentStatus: "Available", accent: "mint", description: "Fields, circuits, and the invisible forces that shape modern technology.", sections: [{ id: "01", instructor: "Owen Foster", room: "PHYS 102", seats: 0, capacity: 32, type: "LEC", meetings: [{ day: "MON", start: 12.5, end: 13.75 }, { day: "WED", start: 12.5, end: 13.75 }] }] },
  { code: "CMPE 70", title: "Assembly Language Programming", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "See the machine underneath the abstractions and learn how instructions become action.", sections: [{ id: "01", instructor: "Ravi Nair", room: "BBC 212", seats: 0, capacity: 26, type: "LEC", meetings: [{ day: "TUE", start: 12.5, end: 13.75 }, { day: "THU", start: 12.5, end: 13.75 }] }] },
  { code: "EE 97", title: "Introductory Electrical Engineering Laboratory", units: 1, status: "Open", studentStatus: "Available", accent: "mint", description: "Make the circuit real: measure, test, troubleshoot, and learn by building.", sections: [{ id: "01", instructor: "Ari Gomez", room: "EE LAB 2", seats: 8, capacity: 18, type: "LAB", meetings: [{ day: "FRI", start: 13, end: 16 }] }] },
  { code: "EE 98", title: "Introduction to Circuit Analysis", units: 3, status: "Closed", studentStatus: "Available", accent: "mint", description: "Understand the behavior of electrical networks through models you can calculate and trust.", sections: [{ id: "01", instructor: "Ari Gomez", room: "EE 101", seats: 0, capacity: 36, type: "LEC", meetings: [{ day: "MON", start: 15, end: 16.25 }, { day: "WED", start: 15, end: 16.25 }] }] },
  { code: "MATH 33LA", title: "Differential Equations and Linear Algebra", units: 3, status: "Closed", studentStatus: "Available", accent: "orange", description: "Build the mathematical toolkit for modeling dynamic systems and engineered behavior.", sections: [{ id: "01", instructor: "Nikhil Rao", room: "SCI 202", seats: 0, capacity: 30, type: "LEC", meetings: [{ day: "TUE", start: 9, end: 10.25 }, { day: "THU", start: 9, end: 10.25 }] }] },
  { code: "CMPE 125", title: "Digital Design", units: 4, status: "Closed", studentStatus: "Available", accent: "blue", description: "Translate logic into hardware with the systems mindset that powers every digital device.", sections: [{ id: "01", instructor: "Casey Li", room: "BBC 114", seats: 0, capacity: 26, type: "LEC", meetings: [{ day: "MON", start: 13, end: 14.75 }, { day: "WED", start: 13, end: 14.75 }] }] },
  { code: "CMPE 126", title: "Algorithms and Data Structure Design", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Turn structure into strategy: compare approaches, prove them, and make them efficient.", sections: [{ id: "01", instructor: "Ravi Nair", room: "BBC 118", seats: 0, capacity: 30, type: "LEC", meetings: [{ day: "TUE", start: 15, end: 16.25 }, { day: "THU", start: 15, end: 16.25 }] }] },
  { code: "ENGR 100W", title: "Engineering Reports", units: 3, status: "Closed", studentStatus: "Available", accent: "violet", description: "Write with the clarity and evidence that technical decisions deserve.", sections: [{ id: "01", instructor: "Nora Ellis", room: "ENGR 205", seats: 0, capacity: 22, type: "LEC", meetings: [{ day: "FRI", start: 9, end: 11.5 }] }] },
  { code: "CMPE 110", title: "Electronics for Computing Systems", units: 4, status: "Closed", studentStatus: "Available", accent: "blue", description: "Connect computation to the physical world through electronics, signals, and systems.", sections: [{ id: "01", instructor: "Casey Li", room: "BBC 114", seats: 0, capacity: 26, type: "LEC", meetings: [{ day: "MON", start: 10, end: 11.75 }, { day: "WED", start: 10, end: 11.75 }] }] },
  { code: "CMPE 127", title: "Microprocessor Design I", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Design around the processor: timing, memory, and the architecture of execution.", sections: [{ id: "01", instructor: "David Kim", room: "BBC 212", seats: 0, capacity: 24, type: "LEC", meetings: [{ day: "TUE", start: 10, end: 11.25 }, { day: "THU", start: 10, end: 11.25 }] }] },
  { code: "CMPE 131", title: "Software Engineering I", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Build software with a team, a process, and a point of view about quality.", sections: [{ id: "01", instructor: "Maya Chen", room: "BBC 204", seats: 0, capacity: 28, type: "LEC", meetings: [{ day: "MON", start: 14, end: 15.25 }, { day: "WED", start: 14, end: 15.25 }] }] },
  { code: "CMPE 142", title: "Operating Systems Design", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Understand how an operating system coordinates processes, memory, and the machine beneath.", sections: [{ id: "01", instructor: "Ravi Nair", room: "BBC 204", seats: 0, capacity: 28, type: "LEC", meetings: [{ day: "TUE", start: 14, end: 15.25 }, { day: "THU", start: 14, end: 15.25 }] }] },
  { code: "CMPE 140", title: "Computer Architecture and Design", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Understand the layers between a program and the machine that runs it.", sections: [{ id: "01", instructor: "Ravi Nair", room: "BBC 118", seats: 0, capacity: 24, type: "LEC", meetings: [{ day: "TUE", start: 13, end: 14.25 }, { day: "THU", start: 13, end: 14.25 }] }] },
  { code: "CMPE 146", title: "Real-Time Embedded System Co-Design", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Design at the edge where software meets timing, sensors, and the physical world.", sections: [{ id: "01", instructor: "Ari Gomez", room: "EE 206", seats: 0, capacity: 20, type: "LEC", meetings: [{ day: "MON", start: 11.5, end: 12.75 }, { day: "WED", start: 11.5, end: 12.75 }] }] },
  { code: "CMPE 195A", title: "Senior Design Project I", units: 2, status: "Closed", studentStatus: "Available", accent: "violet", description: "Make the first half of a real project: define the problem, test the idea, start the build.", sections: [{ id: "01", instructor: "Faculty Studio", room: "BBC 310", seats: 0, capacity: 16, type: "LEC", meetings: [{ day: "FRI", start: 14, end: 16 }] }] },
  { code: "ENGR 195A", title: "Global and Social Issues in Engineering", units: 1, status: "Closed", studentStatus: "Available", accent: "violet", description: "Put engineering decisions in context: people, systems, impact, and responsibility.", sections: [{ id: "01", instructor: "Maya Chen", room: "ENGR 101", seats: 0, capacity: 40, type: "LEC", meetings: [{ day: "THU", start: 15, end: 16 }] }] },
  { code: "CMPE 148", title: "Computer Networks I", units: 3, status: "Closed", studentStatus: "Available", accent: "blue", description: "Follow information as it moves: protocols, networks, and the architecture of connection.", sections: [{ id: "01", instructor: "David Kim", room: "BBC 212", seats: 0, capacity: 26, type: "LEC", meetings: [{ day: "MON", start: 13, end: 14.25 }, { day: "WED", start: 13, end: 14.25 }] }] },
  { code: "CMPE 195B", title: "Senior Design Project II", units: 3, status: "Closed", studentStatus: "Available", accent: "violet", description: "Carry a project across the finish line with rigor, craft, and a story worth sharing.", sections: [{ id: "01", instructor: "Faculty Studio", room: "BBC 310", seats: 0, capacity: 16, type: "LEC", meetings: [{ day: "FRI", start: 14, end: 16 }] }] },
  { code: "ENGR 195B", title: "Global and Social Issues in Engineering", units: 1, status: "Closed", studentStatus: "Available", accent: "violet", description: "A second lens on how technical choices shape the world around them.", sections: [{ id: "01", instructor: "Maya Chen", room: "ENGR 101", seats: 0, capacity: 40, type: "LEC", meetings: [{ day: "THU", start: 15, end: 16 }] }] },
  { code: "ISE 130", title: "Engineering Probability and Statistics", units: 3, status: "Closed", studentStatus: "Available", accent: "orange", description: "Use uncertainty as a tool: measure it, model it, and make better decisions with it.", sections: [{ id: "01", instructor: "Jon Bell", room: "SCI 208", seats: 0, capacity: 28, type: "LEC", meetings: [{ day: "MON", start: 12, end: 13.25 }, { day: "WED", start: 12, end: 13.25 }] }] },
];

const defaultSchedule = [{ courseCode: "CMPE 30", sectionId: "01" }];

function RadarMark() {
  return <svg className="radar-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true"><circle cx="18" cy="18" r="13.5" stroke="currentColor" strokeWidth="1.8" /><circle cx="18" cy="18" r="7.2" stroke="currentColor" strokeWidth="1.8" /><path d="M18 18 28.4 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="28.5" cy="7.4" r="3.1" fill="currentColor" /><circle cx="18" cy="18" r="2" fill="currentColor" /></svg>;
}

function formatTime(value: number) {
  const hour = Math.floor(value);
  const minutes = Math.round((value - hour) * 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes === 0 ? "00" : minutes} ${suffix}`;
}

function sectionKey(courseCode: string, sectionId: string) { return `${courseCode}::${sectionId}`; }
function findSection(courseCode: string, sectionId: string) {
  const course = courses.find((item) => item.code === courseCode);
  const section = course?.sections.find((item) => item.id === sectionId);
  return course && section ? { course, section } : null;
}

function App() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CourseStatus | StudentStatus>("all");
  const [selectedCode, setSelectedCode] = useState("CMPE 30");
  const [selectedSectionId, setSelectedSectionId] = useState("01");
  const [schedule, setSchedule] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) as { courseCode: string; sectionId: string }[] : defaultSchedule;
    } catch { return defaultSchedule; }
  });
  const [toast, setToast] = useState("Ready when you are.");
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [view, setView] = useState<"split" | "schedule">("split");

  const selectedCourse = courses.find((course) => course.code === selectedCode) ?? courses[0];
  const selectedSection = selectedCourse.sections.find((section) => section.id === selectedSectionId) ?? selectedCourse.sections[0];
  const selectedKey = sectionKey(selectedCourse.code, selectedSection.id);

  const filteredCourses = useMemo(() => courses.filter((course) => {
    const matchesSearch = `${course.code} ${course.title}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || course.status === filter || course.studentStatus === filter;
    return matchesSearch && matchesFilter;
  }), [filter, query]);

  const scheduledItems = useMemo(() => schedule.map((item: { courseCode: string; sectionId: string }) => findSection(item.courseCode, item.sectionId)).filter(Boolean) as { course: Course; section: Section }[], [schedule]);
  const totalCredits = scheduledItems.reduce((sum, item) => sum + item.course.units, 0);
  const conflicts = useMemo(() => {
    const meetingPairs: { a: Meeting; b: Meeting }[] = [];
    scheduledItems.forEach((left, index) => scheduledItems.slice(index + 1).forEach((right) => left.section.meetings.forEach((a) => right.section.meetings.forEach((b) => {
      if (a.day === b.day && a.start < b.end && b.start < a.end) meetingPairs.push({ a, b });
    }))));
    return meetingPairs.length;
  }, [scheduledItems]);

  function persist(next: { courseCode: string; sectionId: string }[]) {
    setSchedule(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function selectCourse(course: Course) {
    setSelectedCode(course.code);
    setSelectedSectionId(course.sections[0]?.id ?? "01");
    setView("split");
  }

  function toggleSection(course: Course, section: Section) {
    const key = sectionKey(course.code, section.id);
    const exists = schedule.some((item: { courseCode: string; sectionId: string }) => sectionKey(item.courseCode, item.sectionId) === key);
    if (exists) {
      persist(schedule.filter((item: { courseCode: string; sectionId: string }) => sectionKey(item.courseCode, item.sectionId) !== key));
      setToast(`${course.code} / Section ${section.id} removed from your week.`);
    } else if (course.status === "Open") {
      persist([...schedule, { courseCode: course.code, sectionId: section.id }]);
      setToast(`${course.code} / Section ${section.id} added to your week.`);
    }
  }

  function clearSchedule() {
    persist([]);
    setToast("Your week is clear. Start with one good fit.");
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="Course Radar home"><RadarMark /><span>Course<span className="wordmark-light">Radar</span></span></a>
      <nav aria-label="Main navigation"><a href="#overview">Overview</a><a className="active" href="/courses">Course explorer</a><a href="#roadmap">Degree roadmap</a><a href="#prerequisites">Prerequisites</a><a href="#planner">Semester planner</a><a href="#recommendations">Recommendations</a></nav>
      <div className="header-actions"><span className="sync-indicator"><i /> Catalog synced</span><button className="guide-link" type="button">Official guide <ExternalLink size={13} /></button><span className="avatar">CM</span></div>
    </header>

    <main>
      <section className="context-bar"><div><span>Workspace</span><b>/</b><strong>Course explorer</strong></div><div className="context-right"><span>Degree</span><strong>Computer Engineering — BS</strong><ChevronDown size={14} /><i /><span>Fall 2026</span><em><u /> Session draft</em></div></section>
      <section className="explorer-intro"><div><p className="eyebrow"><span /> COURSE PLANNING, IN CLEAR VIEW</p><h1>Build a week<br /><span>that fits.</span></h1><p className="intro-copy">Browse the catalog, compare sections, and watch your next semester take shape in real time.</p></div><div className="intro-aside"><div className="aside-number">01</div><p>ONE SECTION<br />AT A TIME</p><ArrowDownLine /><span>Fall 2026 / reviewed catalog</span></div></section>

      <section className="workspace-toolbar"><div className="search-wrap"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search course code or title..." aria-label="Search courses" /><kbd>/</kbd></div><div className="toolbar-actions"><span className="result-count"><strong>{filteredCourses.length}</strong> of {courses.length} courses</span><button className="filter-button" type="button"><Filter size={14} /> Filter <ChevronDown size={13} /></button></div></section>

      <section className={`explorer-workspace ${view === "schedule" ? "schedule-focus" : ""}`}>
        <aside className={`catalog-panel ${catalogOpen ? "is-open" : "is-collapsed"}`}>
          <div className="panel-heading"><div><span className="eyebrow-small">COURSE CATALOG</span><h2>Find your next move.</h2></div><button className="collapse-button" type="button" onClick={() => setCatalogOpen((open) => !open)} aria-label={catalogOpen ? "Collapse catalog" : "Expand catalog"}>{catalogOpen ? <ChevronRight size={16} /> : <LayoutList size={16} />}</button></div>
          {catalogOpen && <><div className="filter-tabs" role="tablist" aria-label="Course filters">{[["all", "All courses"], ["Open", "Open"], ["Planned", "Planned"], ["In progress", "In progress"]].map(([value, label]) => <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value as typeof filter)}>{label}<span>{value === "all" ? courses.length : courses.filter((course) => course.status === value || course.studentStatus === value).length}</span></button>)}</div><div className="catalog-list">{filteredCourses.map((course, index) => { const isSelected = selectedCourse.code === course.code; const scheduled = scheduledItems.some((item) => item.course.code === course.code); return <button key={course.code} type="button" className={`course-row ${isSelected ? "selected" : ""}`} onClick={() => selectCourse(course)}><span className={`course-accent ${course.accent}`} /><span className="course-index">{String(index + 1).padStart(2, "0")}</span><span className="course-copy"><strong>{course.code}</strong><span>{course.title}</span></span><span className="course-meta"><b>{course.units}</b><small>units</small></span><span className={`status-dot ${course.status.toLowerCase()}`} title={course.status}>{course.status === "Open" ? "Open" : "Closed"}</span>{scheduled && <span className="row-check"><Check size={12} /></span>}<ChevronRight className="row-chevron" size={15} /></button>; })}{filteredCourses.length === 0 && <div className="empty-state"><Search size={17} /><strong>No courses match that search.</strong><span>Try a code like CMPE 30 or a title like Calculus.</span></div>}</div></>}
          {!catalogOpen && <div className="collapsed-copy"><span>CATALOG</span><strong>{filteredCourses.length}</strong><small>courses</small></div>}
        </aside>

        <section className="schedule-panel">
          <div className="schedule-topline"><div><span className="eyebrow-small">WEEK THREAD / FALL 2026</span><h2>Let the week reply.</h2><p>{scheduledItems.length === 0 ? "Start with a section from the catalog." : `${scheduledItems.length} ${scheduledItems.length === 1 ? "section" : "sections"} in the thread · ${totalCredits} credits`}{conflicts > 0 && <span className="conflict-note"><Zap size={12} /> {conflicts} overlap{conflicts > 1 ? "s" : ""}</span>}</p></div><div className="schedule-tools"><button type="button" className="view-toggle" onClick={() => setView(view === "split" ? "schedule" : "split")} aria-label="Toggle schedule focus"><Grid2X2 size={15} /><span>{view === "split" ? "Focus schedule" : "Show catalog"}</span></button><button type="button" className="clear-button" onClick={clearSchedule} disabled={schedule.length === 0}><Trash2 size={14} /> Clear</button></div></div>
          <div className="week-summary"><span className="summary-mark"><Sparkles size={15} /></span><div><strong>{schedule.length === 0 ? "An open week" : `${schedule.length} ${schedule.length === 1 ? "message" : "messages"} in the thread`}</strong><small>{conflicts > 0 ? "Resolve the overlap before you commit." : "Saved in this browser · updates instantly"}</small></div><div className="summary-meter"><span style={{ width: `${Math.min(100, (totalCredits / 16) * 100)}%` }} /></div><b>{totalCredits}<small> / 16 cr</small></b></div>
          <div className="week-board"><div className="week-board-head"><div className="week-board-kicker">THREAD <span>05 DAYS</span></div>{DAYS.map((day) => <div key={day} className="chat-day-head"><i /><span data-short={DAY_LABELS[day].slice(0, 3)}>{DAY_LABELS[day]}</span><b>{day}</b></div>)}</div><div className="week-board-body"><div className="week-time-rail">{HOURS.slice(0, -1).map((hour) => <span key={hour}>{formatTime(hour)}</span>)}</div>{DAYS.map((day) => <div key={day} className="chat-day-lane"><div className="lane-grid">{HOURS.slice(0, -1).map((hour) => <i key={hour} />)}</div>{scheduledItems.flatMap(({ course, section }) => section.meetings.filter((meeting) => meeting.day === day).map((meeting) => <ScheduleBlock key={`${course.code}-${section.id}-${day}`} course={course} section={section} meeting={meeting} isSelected={sectionKey(course.code, section.id) === selectedKey} onRemove={() => toggleSection(course, section)} />))}{scheduledItems.every(({ section }) => !section.meetings.some((meeting) => meeting.day === day)) && <span className="day-empty">open space</span>}</div>)}</div><div className="week-composer"><span className="composer-orb"><Sparkles size={14} /></span><div><strong>What fits next?</strong><small>Choose a section from the catalog and it will join the conversation.</small></div><button type="button" onClick={() => setView("split")}>Browse courses <ArrowRight size={13} /></button></div></div>
        </section>
      </section>

      <section className="detail-drawer"><div className="detail-intro"><div className={`detail-course-mark ${selectedCourse.accent}`}>{selectedCourse.code.split(" ")[0].slice(0, 2)}</div><div><p className="eyebrow-small">SELECTED COURSE</p><h2>{selectedCourse.code} <span>{selectedCourse.title}</span></h2><p>{selectedCourse.description}</p></div></div><div className="detail-stats"><span><b>{selectedCourse.units}</b> units</span><span><b>{selectedCourse.sections.length}</b> sections</span><span><b>{selectedCourse.status}</b> this term</span></div></section>
      <section className="section-browser"><div className="section-browser-heading"><div><p className="eyebrow-small">AVAILABLE SECTIONS</p><h2>Choose the rhythm.</h2></div><span>Click a row to inspect. Add it to see the footprint.</span></div><div className="section-list">{selectedCourse.sections.map((section) => { const key = sectionKey(selectedCourse.code, section.id); const isAdded = schedule.some((item: { courseCode: string; sectionId: string }) => sectionKey(item.courseCode, item.sectionId) === key); const isChosen = selectedSectionId === section.id; return <article key={section.id} className={`section-card ${isChosen ? "chosen" : ""} ${isAdded ? "added" : ""}`} onClick={() => setSelectedSectionId(section.id)}><div className="section-id"><span>SECTION</span><strong>{section.id}</strong><small>{section.type}</small></div><div className="section-main"><div className="section-title"><strong>{section.instructor}</strong><span>{section.room}</span></div><div className="meeting-list">{section.meetings.map((meeting) => <span key={`${meeting.day}-${meeting.start}`}><b>{meeting.day}</b>{formatTime(meeting.start)} — {formatTime(meeting.end)}</span>)}</div></div><div className="section-capacity"><Users size={14} /><span>{section.seats > 0 ? `${section.seats} seats left` : "Full"}</span><small>{section.seats > 0 ? `${section.capacity - section.seats}/${section.capacity} filled` : "Waitlist only"}</small></div><button className={`section-action ${isAdded ? "added" : ""}`} type="button" onClick={(event) => { event.stopPropagation(); toggleSection(selectedCourse, section); }}>{isAdded ? <><Check size={14} /> In your week</> : selectedCourse.status === "Open" ? <><Plus size={14} /> Add to week</> : <>Closed</>}</button><ChevronRight className="section-chevron" size={16} /></article>})}</div></section>
    </main>
    <footer className="site-footer"><span className="wordmark"><RadarMark /><span>Course<span className="wordmark-light">Radar</span></span></span><span>Course explorer · Fall 2026</span><div><span className="toast-dot" /> {toast}</div></footer>
  </div>;
}

function ScheduleBlock({ course, section, meeting, isSelected, onRemove }: { course: Course; section: Section; meeting: Meeting; isSelected: boolean; onRemove: () => void }) {
  const top = ((meeting.start - 9) / 8) * 100;
  const height = ((meeting.end - meeting.start) / 8) * 100;
  return <div className={`schedule-block chat-block ${course.accent} ${isSelected ? "selected" : ""}`} style={{ top: `${top}%`, height: `${height}%` }} onClick={onRemove} role="button" tabIndex={0} title={`Remove ${course.code} section ${section.id}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onRemove(); }}><div className="block-top"><strong>{course.code}</strong><button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label={`Remove ${course.code} section ${section.id}`}><X size={12} /></button></div><span>Section {section.id} · {section.type}</span><b>{formatTime(meeting.start)} — {formatTime(meeting.end)}</b><small>{section.instructor}</small><em>{section.room}</em></div>;
}

function ArrowDownLine() { return <svg className="arrow-down-line" viewBox="0 0 48 94" fill="none" aria-hidden="true"><path d="M1 1v40c0 20 12 31 31 31h14" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" /><path d="m41 67 5 5-5 5" stroke="currentColor" strokeWidth="1" /></svg>; }

export default App;
