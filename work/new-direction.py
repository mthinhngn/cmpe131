from pathlib import Path
p=Path('src/Landing.tsx');s=p.read_text(encoding="utf-8-sig");a=s.index('function PlanningSignal(');b=s.index('export default function Landing()',a)
s=s[:a]+'''function PlanningSignal({ catalog }: { catalog: ProgramCatalog }) {
  const calculus = catalog.courses.find(course => course.title === "Calculus II");
  return <div data-hero className={s.heroArt}>
    <svg viewBox="0 0 620 560" className={s.signal} role="group" aria-label="Courses connect into a semester and a weekly schedule">
      <path data-signal-line d="M38 145 H270 Q290 145 290 165 V248 Q290 270 312 270 H540 Q570 270 570 300 V370 Q570 394 546 394 H70 Q46 394 46 418 V472 H560" fill="none" stroke="#e44a2e" strokeWidth="3" pathLength="1" />
      <a href="#explore" aria-label="Explore courses"><g data-signal-stage="courses"><text x="36" y="64">Courses</text><rect x="36" y="88" width="174" height="112" rx="16" fill="#171717"/><text x="56" y="135" style={{fill:"white"}}>Calculus I</text><path d="M56 172H185 M177 164L185 172L177 180" fill="none" stroke="white" strokeWidth="1.5"/></g></a>
      <a href="#your-plan" aria-label="Review a semester"><g data-signal-stage="semester"><text x="330" y="64">Semester</text><path d="M316 88H582 M316 150H582 M316 212H582 M316 274H582" stroke="#dededb"/><path d="M302 88H290V274H302" stroke="#171717" strokeWidth="2" fill="none"/></g></a>
      {[calculus?.title ?? "Calculus II", "Writing", "Physics"].map((label, i) => <a href="#your-plan" key={label} aria-label={`${label}, semester preview`}><g data-signal-course={i}><rect x="328" y={100+i*62} width={i === 1 ? 180 : 232} height="38" rx="12" fill={i === 0 ? "#eceae5" : "#f1f1ef"}/><text x="344" y={126+i*62}>{label}</text></g></a>)}
      <a href="#your-week" aria-label="Inspect the weekly schedule"><g data-signal-stage="week"><text x="36" y="354">Week</text><path d="M100 416V526 M212 416V526 M324 416V526 M436 416V526 M548 416V526 M36 444H584 M36 486H584 M36 526H584" stroke="#dededb" fill="none"/></g><g data-signal-meetings><rect x="112" y="422" width="88" height="52" rx="12" fill="#171717"/><rect x="224" y="462" width="88" height="52" rx="12" fill="#eceae5"/><rect x="336" y="422" width="88" height="52" rx="12" fill="#171717"/><rect x="448" y="462" width="88" height="52" rx="12" fill="#e44a2e"/></g></a>
    </svg>
  </div>;
}

'''+s[b:];s=s.replace('Make room for<br />what’s <em className={s.heroAccent}>next.</em>','A plan you<br />can <em className={s.heroAccent}>see.</em>');p.write_text(s,encoding='utf-8')
p=Path('src/landing.styles.ts');s=p.read_text(encoding="utf-8-sig");s=s.replace('cr:pr-[40px]','cr:pr-[40px] cr:pl-[clamp(0px,2vw,32px)]');s=s.replace('cr:pl-[24px]','cr:px-[28px]');s=s.replace('explore: `cr:py-[80px]`','explore: `cr:py-[80px] cr:grid cr:grid-cols-[.72fr_1.28fr] cr:gap-[80px] cr:items-start cr:[&>div:first-child]:grid-cols-1 cr:[&>div:first-child]:gap-[28px] cr:[&>div:first-child]:mb-0`');s=s.replace('explorer: `cr:bg-radar-fog cr:rounded-[20px] cr:p-[32px_40px]`','explorer: `cr:border-0 cr:border-t cr:border-solid cr:border-radar-ink cr:pt-[24px]`');s=s.replace('cr:w-[54%]','cr:w-full');s=s.replace('explorerTools: `cr:flex cr:items-center cr:justify-between cr:gap-[32px]','explorerTools: `cr:flex cr:flex-col cr:items-start cr:gap-[16px]');s=s.replace('cr:grid-cols-[150px_1fr] cr:[&>span]:items-baseline cr:[&>span]:gap-[24px]','cr:grid-cols-1 cr:[&>span]:items-baseline cr:[&>span]:gap-[4px]');s=s.replace('cr:min-h-[264px]','cr:min-h-[300px]');s=s.replace('pathBand: `cr:bg-radar-ash`','pathBand: `cr:bg-radar-fog`');s=s.replace('cr:bg-radar-fog cr:rounded-[18px] cr:px-[32px] cr:py-[8px]','cr:px-0 cr:py-[8px]');s=s.replace('week: `cr:bg-white cr:rounded-[20px] cr:p-[32px] cr:tabular-nums`','week: `cr:bg-white cr:rounded-[20px] cr:p-[32px] cr:tabular-nums`');p.write_text(s,encoding='utf-8')
p=Path('src/theme.css');s=p.read_text(encoding="utf-8-sig");a=s.index('@keyframes cr-signal-course');b=s.index('@media (hover:',a);s=s[:a]+'''@keyframes cr-signal-course {
  0% { opacity: 0; transform: translate(-292px, 126px); }
  30%, 48% { opacity: 1; transform: translate(-292px, 110px); }
  82%, 100% { opacity: 1; transform: translate(0, 0); }
}
[data-landing] [data-signal-course="2"] { animation-delay: 600ms; }
[data-landing] [data-signal-meetings] rect:nth-child(4) { animation-delay: 2360ms; }
'''+s[b:];p.write_text(s,encoding='utf-8')

