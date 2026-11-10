/* Landing showcase engine: four mini pages, each with a short scripted scene (cursor, typing,
   counters, blocks), played as a loop. Clicking a page name jumps to it; hovering the window
   pauses. Versions pick the handoff: "glide", "depth" or "reveal" (reveal adds a story layer:
   captions and a moving spotlight). Illustrative data only. */
window.Showcase = (() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = k => `var(--s-${k})`;
  const EASE = { out: "cubic-bezier(0.23, 1, 0.32, 1)", inOut: "cubic-bezier(0.77, 0, 0.175, 1)", drawer: "cubic-bezier(0.32, 0.72, 0, 1)" };
  const A = (el, kf, o) => el.animate(kf, reduce ? { ...o, duration: 1, delay: 0 } : o);

  /* ---------- a pausable clock that fires scene steps ---------- */
  class Clock {
    constructor() { this.t = 0; this.steps = []; this.playing = false; this.last = 0; this.raf = 0; }
    at(ms, fn) { this.steps.push({ ms, fn }); }
    start(onTick) {
      this.t = 0; this.steps.sort((a, b) => a.ms - b.ms); this.onTick = onTick; this.playing = true; this.last = performance.now();
      cancelAnimationFrame(this.raf);
      if (reduce) { while (this.steps.length) this.steps.shift().fn(); }
      const tick = now => {
        if (this.playing) this.t += now - this.last;
        this.last = now;
        while (this.steps.length && this.steps[0].ms <= this.t) this.steps.shift().fn();
        this.raf = requestAnimationFrame(tick);
        this.onTick && this.onTick(this.t);
      };
      this.raf = requestAnimationFrame(tick);
    }
    stop() { cancelAnimationFrame(this.raf); this.steps = []; }
  }

  /* ---------- data ---------- */
  const term = [["MATH 32", "Calculus III", "Opens ISE 130", "math"], ["BIOL 10", "The Living World", "3 units", "science"], ["MATH 42", "Discrete Mathematics", "Opens CMPE 126", "math"], ["PHYS 51", "Electricity and Magnetism", "Opens EE 98", "science"]];
  const subjects = [["major", "Major", 8, 45], ["math", "Math", 7, 16], ["science", "Science", 4, 11], ["eng", "Engineering", 3, 15], ["writing", "Writing", 6, 6], ["choice", "Choices", 3, 27]];
  const load = [
    [["CMPE 30", 4, "major", 1], ["MATH 30", 3, "math", 1], ["ENGR 10", 3, "eng", 1], ["ENGL 1A", 3, "writing", 1]],
    [["CMPE 50", 4, "major", 1], ["MATH 31", 4, "math", 1], ["PHYS 50", 4, "science", 1], ["ENGL 1B", 3, "writing", 1]],
    [["MATH 32", 3, "math"], ["MATH 42", 3, "math"], ["PHYS 51", 4, "science"], ["BIOL 10", 3, "science"]],
    [["CMPE 70", 3, "major"], ["EE 98", 3, "eng"], ["MATH 33LA", 3, "math"]],
    [["CMPE 125", 4, "major"], ["ENGR 100W", 3, "eng"]],
    [["CMPE 110", 4, "major"], ["CMPE 127", 3, "major"], ["CMPE 142", 3, "major"]],
    [["CMPE 140", 3, "major"], ["CMPE 146", 3, "major"], ["CMPE 195A", 2, "major"]],
    [["CMPE 148", 3, "major"], ["CMPE 195B", 3, "major"], ["ISE 130", 3, "eng"]],
  ];
  const blk = ([code, u, k, done]) => `<span class="blk${done ? " done" : ""}" style="--u:${u};--c:${C(k)}">${code}${u > 2 ? `<small style="float:right;opacity:.7">${u}</small>` : ""}</span>`;
  const sum = list => list.reduce((a, b) => a + b[1], 0);

  /* ---------- pages ---------- */
  const pages = [
    {
      id: "overview", label: "Overview", duration: 7000,
      render: () => {
        const R = 48, CIRC = 2 * Math.PI * R, total = subjects.reduce((a, s) => a + s[3], 0);
        let acc = 0, arcs = "";
        subjects.forEach(([k, , done, tot]) => {
          const f = tot / total, df = done / total, off = -acc * CIRC;
          arcs += `<circle data-k="${k}" cx="60" cy="60" r="${R}" stroke="${C(k)}" stroke-opacity=".22" stroke-dasharray="${f * CIRC - 2} ${CIRC}" stroke-dashoffset="${off}"/>`;
          arcs += `<circle data-k="${k}" cx="60" cy="60" r="${R}" stroke="${C(k)}" stroke-dasharray="${Math.max(0, df * CIRC - 2)} ${CIRC}" stroke-dashoffset="${off}"/>`;
          acc += f;
        });
        return `<h3 class="pg-title">Overview <span>· Computer Engineering</span></h3>
          <div class="ov-grid">
            <section class="card ov-term"><h4><i></i>This term</h4><div class="ov-big"><b class="n-units">0</b> units <span>in motion</span></div><p class="ov-sub">Fall 2026 · Semester 3 of 8 · 4 courses in progress</p>
              <div class="ov-cards">${term.map(([c, t, o, k]) => `<div class="nc" data-code="${c}" style="--c:${C(k)}"><b>${c}</b><span>${t}</span><small>${o} →</small></div>`).join("")}</div></section>
            <section class="card ov-ring"><h4><i></i>Units by subject</h4><div class="ring"><svg viewBox="0 0 120 120">${arcs}</svg><div class="c"><span><b class="n-pct">0</b>%</span><small>of units done</small></div></div>
              <ul class="subj">${subjects.map(([k, l, d, t]) => `<li data-k="${k}" style="--c:${C(k)}"><i></i><span>${l}</span><small>${d}/${t}u</small></li>`).join("")}</ul></section>
            <section class="card ov-load"><h4><i></i>Semester load</h4><div class="load">${load.map((s, i) => `<div class="col${i === 2 ? " now" : ""}">${s.map(blk).join("")}</div>`).join("")}</div>
              <div class="load-x">${load.map((s, i) => `<span>S${i + 1} · ${sum(s)}u</span>`).join("")}</div></section>
          </div>`;
      },
      scene: (x) => {
        x.caption(0, "See this term at a glance");
        x.count(".n-units", 13, 250, 1000); x.count(".n-pct", 26, 400, 1300);
        x.at(200, () => {
          x.$$(".ring circle").forEach((c, i) => { const d = c.getAttribute("stroke-dasharray"); A(c, [{ strokeDasharray: `0 ${d.split(" ")[1]}` }, { strokeDasharray: d }], { duration: 1300, delay: 120 + i * 40, easing: EASE.out, fill: "backwards" }); });
          x.$$(".load .blk").forEach((b, i) => A(b, [{ opacity: 0, transform: "translateY(-12px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 200 + i * 26, easing: EASE.out, fill: "backwards" }));
          x.$$(".nc").forEach((n, i) => A(n, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 520, delay: 150 + i * 60, easing: EASE.out, fill: "backwards" }));
        });
        x.cursor.show(1300, ".ov-load", .5, .9);
        x.cursor.move(1500, '.nc[data-code="MATH 32"]', .55, .55, 820);
        x.click(2450, () => { x.$('.nc[data-code="MATH 32"]').classList.add("sel"); x.pop('.nc[data-code="MATH 32"]', "<b>MATH 32 · Calculus III</b>In progress · opens ISE 130", "above"); });
        x.caption(2500, "Every course shows what it opens");
        x.spot(2450, '.nc[data-code="MATH 32"]');
        x.cursor.move(3600, '.subj li[data-k="math"]', .3, .5, 760);
        x.click(4400, () => {
          x.unpop(); x.$('.subj li[data-k="math"]').classList.add("on"); x.$(".subj").classList.add("filter");
          x.$$(".ring circle").forEach(c => c.style.opacity = c.dataset.k === "math" ? 1 : .25);
        });
        x.caption(4450, "Filter progress by subject");
        x.spot(4400, ".ov-ring");
        x.cursor.move(5600, ".load .col.now", .5, .4, 700);
        x.spot(5600, ".ov-load");
      },
    },
    {
      id: "schedule", label: "Schedule", duration: 7000,
      render: () => {
        const rows = [["CMPE 125", "Digital Design", 4], ["CMPE 126", "Algorithms & Data Structures", 3], ["CMPE 131", "Software Engineering I", 3], ["CMPE 142", "Operating Systems", 3], ["ENGR 100W", "Engineering Reports", 3], ["MATH 33LA", "Differential Equations", 3], ["PHYS 52", "Optics and Modern Physics", 3]];
        const ev = [["MATH 32", "MW 9:00", 0, 9, 1.25, "math"], ["MATH 32", "", 2, 9, 1.25, "math"], ["PHYS 51", "TTh 12:00", 1, 12, 1.25, "science"], ["PHYS 51", "", 3, 12, 1.25, "science"], ["BIOL 10", "MW 1:30", 0, 13.5, 1.25, "science"], ["BIOL 10", "", 2, 13.5, 1.25, "science"], ["MATH 42", "F 10:00", 4, 10, 2, "math"]];
        const pos = (d, s, len) => `left:calc(34px + (100% - 34px) * ${d} / 5 + 3px);width:calc((100% - 34px) / 5 - 6px);top:calc(20px + (100% - 20px) * ${s - 8} / 9 + 2px);height:calc((100% - 20px) * ${len} / 9 - 4px)`;
        const hours = Array.from({ length: 9 }, (_, i) => i + 8);
        return `<div class="sc-wrap">
          <aside class="cat"><div class="cat-search">⌕ <span class="ph">Find a course</span><span class="search-entry"><span class="typed"></span><span class="caret" hidden></span></span></div>
            <div class="cat-chips"><span class="on">All 31</span><span>In your week 4</span><span>Open seats</span><span>Years 1–2</span></div>
            <div class="cat-list">${rows.map(([c, t, u]) => `<div class="row" data-code="${c}"><div><b>${c}</b><span>${t}</span></div><em>${u}u</em></div>`).join("")}</div></aside>
          <section class="week"><div class="week-head"><div><b>Weekly schedule</b><small>Fall 2026 · 4 sections selected</small></div><div class="kpis"><div><b class="k-u">13</b><small>units</small></div><div><b class="k-h">9</b><small>hours</small></div><div><b>5</b><small>days</small></div></div></div>
            <div class="grid5"><span></span>${["Mon", "Tue", "Wed", "Thu", "Fri"].map(d => `<span class="hd">${d}</span>`).join("")}
              ${hours.map(h => `<span class="hr">${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}</span>${"<span class='cell'></span>".repeat(5)}`).join("")}
              ${ev.map(([c, t, d, s, l, k]) => `<div class="ev" style="--c:${C(k)};${pos(d, s, l)}">${c}<small>${t}</small></div>`).join("")}
              <div class="ev new" data-n="1" style="--c:${C("major")};${pos(1, 10.5, 1.25)};opacity:0">CMPE 126<small>TTh 10:30 · Sec 01</small></div>
              <div class="ev new" data-n="2" style="--c:${C("major")};${pos(3, 10.5, 1.25)};opacity:0">CMPE 126<small>Sec 01</small></div>
            </div></section></div>`;
      },
      scene: (x) => {
        x.caption(0, "Build a week from listed sections");
        x.at(100, () => {
          x.$$(".ev:not(.new)").forEach((e, i) => A(e, [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: 120 + i * 50, easing: EASE.out, fill: "backwards" }));
          x.$$(".row").forEach((r, i) => A(r, [{ opacity: 0, transform: "translateX(-8px)" }, { opacity: 1, transform: "none" }], { duration: 460, delay: 80 + i * 40, easing: EASE.out, fill: "backwards" }));
        });
        x.cursor.show(700, ".week", .4, .5);
        x.cursor.move(900, ".cat-search", .35, .5, 760);
        x.click(1700, () => { x.$(".cat-search .ph").hidden = true; x.$(".cat-search .caret").hidden = false; });
        x.spot(1700, ".cat");
        x.type(".cat-search .typed", "CMPE 126", 1850, 95, typed => x.$$(".row").forEach(r => r.classList.toggle("hide", !r.dataset.code.startsWith(typed.trim()) && typed.length > 3)));
        x.caption(1900, "Search the catalog as you type");
        x.at(2700, () => { x.$(".cat-search .caret").hidden = true; });
        x.cursor.move(2700, '.row[data-code="CMPE 126"] em', .5, .5, 700);
        x.click(3450, () => {
          x.$('.row[data-code="CMPE 126"]').classList.add("hot");
          x.$$(".ev.new").forEach((e, i) => { e.style.opacity = ""; A(e, [{ opacity: 0, transform: "translateY(-14px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 620, delay: i * 90, easing: EASE.drawer, fill: "backwards" }); });
        });
        x.count(".k-u", 16, 3500, 700, 13); x.count(".k-h", 12, 3500, 700, 9);
        x.caption(3500, "Sections drop straight into your week");
        x.spot(3450, ".week");
        x.cursor.move(4500, '.ev.new[data-n="1"]', .5, .6, 760);
        x.at(5300, () => x.pop('.ev.new[data-n="1"]', "<b>CMPE 126 · Section 01</b>TTh 10:30–11:45 · ENG 337 · 12 seats", "right"));
        x.spot(5300, '.ev.new[data-n="1"]');
      },
    },
    {
      id: "planner", label: "Planner", duration: 8200,
      render: () => `<div class="pl">
          <div class="pl-chart">${load.map((s, i) => `<div class="col${i === 2 ? " now" : ""}" data-i="${i}">${s.map(blk).join("")}</div>`).join("")}</div>
          <div><div class="pl-x">${load.map((s, i) => `<span>S${i + 1} · <b class="u" data-i="${i}">${sum(s)}</b>u<small>${i % 2 ? "SPRING" : "FALL"}</small></span>`).join("")}</div>
          <div class="cmd"><div class="sheet"><h5>Course library <span style="font-weight:400;color:#8A8780">· Adding to Semester 5</span></h5><div class="pills">${[["CMPE 126", "major"], ["CMPE 131", "major"], ["CMPE 135", "major"], ["MATH 129A", "math"], ["ENGR 195A", "eng"], ["PHYS 52", "science"], ["ENGL 100A", "writing"], ["CMPE 120", "major"]].map(([c, k]) => `<span class="pill" data-code="${c}" style="--c:${C(k)}">${c}<em>+</em></span>`).join("")}</div></div>
            <div class="reply"><div class="me">Is Semester 5 balanced?</div><p class="ans" style="margin:0"></p></div>
            <div class="cmd-bar"><span class="cmd-mode"><i></i><span class="m-c on">Courses</span><span class="m-a">Ask</span></span><span class="cmd-text">Find a course…</span><span class="cmd-go">↑</span></div></div></div>
        </div>`,
      scene: (x) => {
        x.caption(0, "Plan every semester in one view");
        x.at(100, () => x.$$(".pl .blk").forEach((b, i) => A(b, [{ opacity: 0, transform: "translateY(-22px)" }, { opacity: 1, transform: "none" }], { duration: 560, delay: 100 + i * 28, easing: "cubic-bezier(0.34, 1.3, 0.64, 1)", fill: "backwards" })));
        x.cursor.show(1300, ".pl-chart", .5, .5);
        x.cursor.move(1500, ".cmd-bar", .55, .5, 760);
        x.click(2300, () => { x.$(".cmd").classList.add("open"); x.$(".sheet").classList.add("open"); x.$(".cmd-text").textContent = "Add a course to Semester 5…"; x.$('.col[data-i="4"]').classList.add("target"); });
        x.caption(2350, "Find a course, drop it in a semester");
        x.spot(2300, ".cmd");
        x.cursor.move(3000, '.pill[data-code="CMPE 131"]', .5, .5, 640);
        x.click(3700, () => {
          const pill = x.$('.pill[data-code="CMPE 131"]'), col = x.$('.col[data-i="4"]');
          const v = x.vp.getBoundingClientRect(), p = pill.getBoundingClientRect(), c = col.getBoundingClientRect();
          const fly = pill.cloneNode(true); fly.style.cssText += `;position:absolute;z-index:15;left:${p.left - v.left}px;top:${p.top - v.top}px;margin:0`;
          x.vp.append(fly); pill.style.opacity = ".35";
          const top = col.lastElementChild ? col.lastElementChild.getBoundingClientRect().top : c.bottom; const dx = c.left - p.left + 3, dy = top - 3 - 39 - p.top;
          A(fly, [{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(.92)`, opacity: .9 }], { duration: 640, easing: EASE.inOut, fill: "forwards" }).onfinish = () => {
            fly.remove();
            const b = document.createElement("span"); b.className = "blk"; b.style.cssText = `--u:3;--c:${C("major")}`; b.innerHTML = `CMPE 131<small style="float:right;opacity:.7">3</small>`;
            col.append(b); A(b, [{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: EASE.out });
            x.$('.u[data-i="4"]').textContent = "10";
          };
        });
        x.at(4500, () => { x.$(".sheet").classList.remove("open"); x.$('.col[data-i="4"]').classList.remove("target"); });
        x.spot(4400, '.col[data-i="4"]');
        x.cursor.move(4800, ".m-a", .5, .5, 600);
        x.click(5450, () => { x.$(".cmd-mode i").style.transform = "translateX(60px)"; x.$(".cmd-mode i").style.width = "36px"; x.$(".m-c").classList.remove("on"); x.$(".m-a").classList.add("on"); x.$(".cmd-text").textContent = ""; x.$(".cmd-text").classList.add("typed"); });
        x.caption(5500, "Or ask the assistant about your plan");
        x.type(".cmd-text", "Is Semester 5 balanced?", 5600, 42);
        x.at(6650, () => x.$(".cmd-go").classList.add("ready"));
        x.cursor.move(6550, ".cmd-go", .5, .5, 320);
        x.click(6950, () => { x.$(".reply").classList.add("open"); x.$(".cmd-text").textContent = ""; x.$(".cmd-go").classList.remove("ready"); });
        x.words(".ans", "Yes. Semester 5 has 10 units across three courses, below the 15 unit full load, so there is room for one more.", 7150);
        x.spot(6950, ".cmd");
      },
    },
    {
      id: "roadmap", label: "Roadmap", duration: 7000,
      render: () => {
        const st = { done: "#1F9D72", now: "#168873", ready: "#9FC4B4", next: "#BFCBC5" };
        const cards = [["CMPE 30", "Programming Concepts", 4, "Completed", "done", 1, 2], ["MATH 30", "Calculus I", 3, "Completed", "done", 1, 3],
          ["CMPE 50", "Object-Oriented Programming", 4, "In progress", "now", 2, 2], ["MATH 31", "Calculus II", 4, "Ready to take", "ready", 2, 3], ["MATH 42", "Discrete Mathematics", 3, "Ready to take", "ready", 2, 4],
          ["CMPE 126", "Algorithms", 3, "Up next", "next", 3, 2], ["CMPE 142", "Operating Systems", 3, "Up next", "next", 4, 3]];
        const sems = [["YEAR 1", "Fall"], ["YEAR 1", "Spring"], ["YEAR 2", "Fall"], ["YEAR 2", "Spring"]];
        return `<div class="rm"><div class="rm-map"><svg class="rm-svg"></svg>
            ${sems.map(([y, s], i) => `<div class="rm-sem" style="grid-row:${i + 1};grid-column:1"><small>${y}</small><b>${s} semester</b></div>`).join("")}
            ${cards.map(([c, t, u, sl, s, r, col]) => `<div class="rc" data-code="${c}" style="--st:${st[s]};--c:${C(c.startsWith("MATH") ? "math" : "major")};grid-row:${r};grid-column:${col}"><b>${c}</b><small>${u} u</small><span>${t}</span><em>${sl}</em></div>`).join("")}
          </div>
          <div class="rm-strip"><span class="lab">Up next</span><b class="s-code">CMPE 126</b><span class="s-title">Algorithms</span><span class="req-list">Requires <span>CMPE 50</span><span>MATH 42</span></span></div></div>`;
      },
      edges: [["CMPE 30", "CMPE 50"], ["MATH 30", "MATH 31"], ["CMPE 50", "CMPE 126"], ["MATH 42", "CMPE 126"], ["CMPE 126", "CMPE 142"], ["MATH 31", "CMPE 142"]],
      scene: (x, page) => {
        const map = x.$(".rm-map"), svg = x.$(".rm-svg");
        const card = c => x.$(`.rc[data-code="${c}"]`);
        svg.innerHTML = page.edges.map(([a, b]) => {
          const A1 = card(a), B1 = card(b);
          // Keep fractional card anchors in the SVG's coordinate space, including scaled previews.
          const inverse = svg.getScreenCTM().inverse();
          const source = A1.getBoundingClientRect(), target = B1.getBoundingClientRect();
          const start = new DOMPoint(source.x + source.width / 2, source.bottom).matrixTransform(inverse);
          const end = new DOMPoint(target.x + target.width / 2, target.top).matrixTransform(inverse);
          const x1 = start.x, y1 = start.y, x2 = end.x, y2 = end.y;
          const my = (y1 + y2) / 2;
          return `<path data-a="${a}" data-b="${b}" d="M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}"/>`;
        }).join("");
        x.caption(0, "Follow every prerequisite chain");
        x.at(100, () => {
          x.$$(".rc").forEach((c, i) => A(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, delay: 80 + i * 70, easing: EASE.out, fill: "backwards" }));
          x.$$(".rm-svg path").forEach((p, i) => { const L = p.getTotalLength(); A(p, [{ strokeDasharray: `${L}`, strokeDashoffset: L }, { strokeDasharray: `${L}`, strokeDashoffset: 0 }], { duration: 900, delay: 500 + i * 90, easing: EASE.inOut, fill: "backwards" }); });
        });
        const focus = (code, reqs, title, at) => x.click(at, () => {
          x.$$(".rc").forEach(c => c.classList.remove("sel", "req"));
          card(code).classList.add("sel"); reqs.forEach(r => card(r).classList.add("req")); map.classList.add("focus");
          x.$$(".rm-svg path").forEach(p => p.classList.toggle("hot", p.dataset.b === code));
          x.$(".s-code").textContent = code; x.$(".s-title").textContent = title;
          const list = x.$(".req-list"); list.innerHTML = "Requires " + reqs.map(r => `<span>${r}</span>`).join("");
          list.querySelectorAll("span").forEach((s, i) => A(s, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: i * 60, easing: EASE.out, fill: "backwards" }));
        });
        x.cursor.show(1700, ".rm-map", .8, .2);
        x.cursor.move(1900, '.rc[data-code="CMPE 126"]', .5, .5, 820);
        focus("CMPE 126", ["CMPE 50", "MATH 42"], "Algorithms", 2850);
        x.caption(2900, "See exactly what a course requires");
        x.spot(2850, '.rc[data-code="CMPE 126"]');
        x.cursor.move(4200, '.rc[data-code="CMPE 142"]', .5, .5, 760);
        focus("CMPE 142", ["CMPE 126", "MATH 31"], "Operating Systems", 5050);
        x.spot(5050, '.rc[data-code="CMPE 142"]');
      },
    },
  ];

  /* ---------- mount ---------- */
  function mount(root, opts) {
    const mode = opts.mode, story = !!opts.story;
    root.innerHTML = `<div class="sx">
      <div class="sx-window"><div class="sx-bar"><span class="sx-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18.6 5.4" stroke-linecap="round"/></svg>CourseRadar</span><span class="sx-crumb">/ COMPUTER ENGINEERING · B.S.</span>
        <span class="sx-nav">${pages.map(p => `<span>${p.label}</span>`).join("")}</span><span class="sx-chip">Fall 2026 ▾</span></div>
        <div class="sx-viewport">${pages.map(p => `<section class="sx-page" data-id="${p.id}" aria-hidden="true"></section>`).join("")}
          <div class="sx-cursor" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
          ${story ? '<div class="sx-spot" aria-hidden="true"></div><p class="sx-caption" aria-live="polite"></p>' : ""}</div></div>
      <div class="sx-tabs" role="tablist" aria-label="Product pages">${pages.map((p, i) => `<button type="button" class="sx-tab" role="tab" data-i="${i}" aria-selected="false">${p.label}<span class="sx-prog"><i></i></span></button>`).join("")}</div></div>`;
    const sx = root.querySelector(".sx"), vp = root.querySelector(".sx-viewport"), win = root.querySelector(".sx-window");
    const els = [...root.querySelectorAll(".sx-page")], tabs = [...root.querySelectorAll(".sx-tab")], navs = [...root.querySelectorAll(".sx-nav span")];
    const cursorEl = root.querySelector(".sx-cursor"), spotEl = root.querySelector(".sx-spot"), capEl = root.querySelector(".sx-caption");
    let index = -1, clock = new Clock(), progress = null, cursorPos = { x: 0, y: 0 }, paused = false, popEl = null, startTimer = 0, cleanupTimer = 0;

    const point = (target, ax = .5, ay = .5) => {
      const el = typeof target === "string" ? els[index].querySelector(target) : target;
      if (!el) return cursorPos;
      const v = vp.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - v.left + r.width * ax, y: r.top - v.top + r.height * ay, r: { x: r.left - v.left, y: r.top - v.top, w: r.width, h: r.height } };
    };
    const setCursor = p => { cursorPos = p; cursorEl.style.transform = `translate(${p.x - 5}px, ${p.y - 3}px)`; };

    function ctx(page) {
      const pageEl = els[index];
      const x = {
        vp, page: pageEl,
        at: (ms, fn) => clock.at(ms, fn),
        $: s => pageEl.querySelector(s), $$: s => [...pageEl.querySelectorAll(s)],
        cursor: {
          show: (ms, target, ax, ay) => clock.at(ms, () => { setCursor(point(target, ax, ay)); cursorEl.classList.add("show"); }),
          move: (ms, target, ax, ay, dur = 700) => clock.at(ms, () => {
            const from = cursorPos, to = point(target, ax, ay);
            A(cursorEl, [{ transform: `translate(${from.x - 5}px, ${from.y - 3}px)` }, { transform: `translate(${to.x - 5}px, ${to.y - 3}px)` }], { duration: dur, easing: EASE.inOut });
            setCursor(to);
          }),
        },
        click: (ms, fn) => clock.at(ms, () => {
          cursorEl.classList.add("down"); setTimeout(() => cursorEl.classList.remove("down"), 150);
          const rip = document.createElement("span"); rip.className = "sx-ripple"; rip.style.left = `${cursorPos.x}px`; rip.style.top = `${cursorPos.y}px`; vp.append(rip);
          A(rip, [{ opacity: .9, transform: "scale(.4)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 560, easing: EASE.out }).onfinish = () => rip.remove();
          fn && fn();
        }),
        type: (sel, text, ms, per = 80, onChar) => [...text].forEach((_, i) => clock.at(ms + i * per, () => { const t = text.slice(0, i + 1); x.$(sel).textContent = t; onChar && onChar(t); })),
        count: (sel, to, ms, dur, from = 0) => { const n = 18; for (let i = 0; i <= n; i++) clock.at(ms + dur * i / n, () => { const k = 1 - Math.pow(1 - i / n, 3); x.$(sel).textContent = Math.round(from + (to - from) * k); }); },
        words: (sel, text, ms) => clock.at(ms, () => { const el = x.$(sel); el.innerHTML = text.split(" ").map((w, i) => `<span class="w" style="animation-delay:${Math.min(i, 30) * 26}ms">${w}</span>`).join(" "); requestAnimationFrame(() => el.querySelectorAll(".w").forEach(w => w.classList.add("in"))); }),
        pop: (target, html, side) => {
          x.unpop(); const p = point(target); popEl = document.createElement("div"); popEl.className = "pop"; popEl.innerHTML = html; vp.append(popEl);
          const w = popEl.offsetWidth, h = popEl.offsetHeight;
          const left = side === "right" ? p.r.x + p.r.w + 10 : Math.min(vp.clientWidth - w - 12, Math.max(12, p.r.x + p.r.w / 2 - w / 2));
          const top = side === "right" ? p.r.y : p.r.y - h - 10;
          popEl.style.left = `${left}px`; popEl.style.top = `${top}px`;
          A(popEl, [{ opacity: 0, transform: side === "right" ? "translateX(-6px) scale(.97)" : "translateY(6px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE.out });
        },
        unpop: () => { if (!popEl) return; const el = popEl; popEl = null; A(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE.out }).onfinish = () => el.remove(); },
        caption: (ms, text) => { if (!story) return; clock.at(ms, () => {
          if (!capEl.textContent) { capEl.textContent = text; A(capEl, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: EASE.out, fill: "forwards" }); return; }
          A(capEl, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px)" }], { duration: 160, easing: EASE.out, fill: "forwards" }).onfinish = () => {
            capEl.textContent = text; A(capEl, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: EASE.out, fill: "forwards" });
          };
        }); },
        spot: (ms, target) => { if (!story) return; clock.at(ms, () => { const p = point(target); const r = Math.max(p.r.w, p.r.h) / 2 + 26; spotEl.style.setProperty("--sx", `${p.x}px`); spotEl.style.setProperty("--sy", `${p.y}px`); spotEl.style.setProperty("--sr", `${r}px`); spotEl.classList.add("on"); }); },
      };
      return x;
    }

    /* handoffs between pages */
    function handoff(fromEl, toEl, dir) {
      if (!fromEl || reduce) {
        if (fromEl) { A(fromEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }); }
        A(toEl, [{ opacity: 0 }, { opacity: 1 }], { duration: fromEl ? 240 : 1, fill: "forwards" });
        return 240;
      }
      if (mode === "glide") {
        const d = dir > 0 ? 1 : -1;
        A(fromEl, [{ transform: "none" }, { transform: `translateX(${-d * 100}%)` }], { duration: 820, easing: EASE.inOut, fill: "forwards" });
        A(toEl, [{ transform: `translateX(${d * 100}%)`, opacity: 1 }, { transform: "none", opacity: 1 }], { duration: 820, easing: EASE.inOut, fill: "forwards" });
        return 820;
      }
      if (mode === "depth") {
        A(fromEl, [{ opacity: 1, transform: "none", filter: "blur(0)" }, { opacity: 0, transform: "scale(.94)", filter: "blur(8px)" }], { duration: 480, easing: EASE.out, fill: "forwards" });
        A(toEl, [{ opacity: 0, transform: "scale(1.04)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 820, delay: 140, easing: EASE.drawer, fill: "both" });
        return 960;
      }
      const d = dir > 0 ? 1 : -1;
      A(fromEl, [{ transform: "none", opacity: 1 }, { transform: `translateX(${-d * 8}%)`, opacity: .35 }], { duration: 900, easing: EASE.inOut, fill: "forwards" });
      A(toEl, [{ clipPath: d > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }], { duration: 900, easing: EASE.inOut, fill: "forwards" });
      toEl.style.zIndex = 3; fromEl.style.zIndex = 2;
      return 900;
    }

    function go(next, dir = 1) {
      const prev = index, fromEl = els[prev];
      // Cancel pending work from the previous visit, including rapid back-and-forth clicks.
      clearTimeout(startTimer); clearTimeout(cleanupTimer);
      clock.stop(); index = next;
      els.forEach(el => el.getAnimations({ subtree: true }).forEach(a => a.cancel()));
      const page = pages[next], toEl = els[next];
      toEl.getAnimations().forEach(a => a.cancel());
      toEl.innerHTML = page.render(); toEl.setAttribute("aria-hidden", "false");
      els.forEach((e, i) => { if (i !== next && i !== prev) { e.getAnimations().forEach(a => a.cancel()); e.style.opacity = 0; e.style.zIndex = 1; e.setAttribute("aria-hidden", "true"); } });
      if (fromEl && fromEl !== toEl) fromEl.setAttribute("aria-hidden", "true");
      toEl.style.opacity = ""; toEl.style.zIndex = 3;
      cursorEl.classList.remove("show"); if (popEl) { popEl.remove(); popEl = null; }
      if (spotEl) spotEl.classList.remove("on");
      if (capEl) { capEl.getAnimations().forEach(a => a.cancel()); capEl.textContent = ""; capEl.style.opacity = 0; }
      tabs.forEach((t, i) => t.setAttribute("aria-selected", String(i === next)));
      navs.forEach((n, i) => n.classList.toggle("on", i === next));
      opts.onChange?.(page.id);
      const lead = handoff(fromEl && fromEl !== toEl ? fromEl : null, toEl, dir);
      // once the handoff lands, the outgoing page leaves the stack entirely
      if (fromEl && fromEl !== toEl) cleanupTimer = setTimeout(() => { if (index === next) { fromEl.getAnimations().forEach(an => an.cancel()); fromEl.style.opacity = 0; fromEl.style.zIndex = 1; } }, lead + 40);
      // the scene starts as the page settles; the active tab's line fills like a video scrubber
      progress && progress.cancel();
      const bar = tabs[next].querySelector(".sx-prog i");
      clock = new Clock();
      page.scene(ctx(page), page);
      if (mode === "depth") A(toEl, [{ transform: "none" }, { transform: "scale(1.025)" }], { duration: page.duration + lead, delay: lead, easing: "linear", fill: "none", composite: "add" });
      progress = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: page.duration + lead, easing: "linear", fill: "forwards" });
      startTimer = setTimeout(() => {
        if (index !== next) return;
        clock.start(t => { if (t >= page.duration && index === next) { clock.stop(); go((next + 1) % pages.length, 1); } });
      }, lead * .55);
    }

    const setPaused = on => {
      if (reduce || paused === on) return; paused = on; clock.playing = !on;
      if (!on) clock.last = performance.now();
      sx.getAnimations({ subtree: true }).forEach(a => on ? a.pause() : a.play());
    };
    tabs.forEach((t, i) => t.addEventListener("click", () => { if (i !== index) { setPaused(false); go(i, i > index ? 1 : -1); } }));
    tabs.forEach((t, i) => t.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[n].focus(); tabs[n].click();
    }));
    if (opts.pauseOnHover !== false) {
      win.addEventListener("pointerenter", () => setPaused(true));
      win.addEventListener("pointerleave", () => setPaused(false));
    }
    document.addEventListener("visibilitychange", () => setPaused(document.hidden));
    go(0);
  }
  return { mount };
})();
