from pathlib import Path
import re
nav='''<nav className={`primary-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation"><a href="/overview" onClick={() => setMenuOpen(false)}>Overview</a><a href="/prerequisites" onClick={() => setMenuOpen(false)}>Prerequisites</a></nav>'''
for name in ['ReferenceLanding','PrerequisiteMap']:
 p=Path('src/'+name+'.tsx');s=p.read_text(encoding='utf-8')
 s=re.sub(r'<nav\b[\s\S]*?</nav>',lambda _:nav,s,count=1)
 if name=='ReferenceLanding':
  s=s.replace('href="#top" aria-label="Course Radar home"','href="/" aria-label="Course Radar home"')
  s=re.sub(r'<div className="footer-links">[\s\S]*?</div>', '<div className="footer-links"><a href="/overview">Overview</a><a href="/prerequisites">Prerequisites</a><span>© 2026 Course Radar</span></div>',s)
  s=re.sub(r'<a className="wordmark footer-wordmark"[\s\S]*?</a>', '<span className="wordmark footer-wordmark"><RadarMark small /><span>Course<span className="wordmark-light">Radar</span></span></span>',s)
 else:
  s=s.replace('href="/catalog-prerequisites"','href="/prerequisites#map-workspace"')
  s=re.sub(r'<a className="back-link"[\s\S]*?</a>','<a className="back-link" href="/overview">Back to overview</a>',s)
 p.write_text(s,encoding='utf-8')
p=Path('src/ReferenceOverview.tsx');s=p.read_text(encoding='utf-8')
s=re.sub(r'<nav className="ov3-nav"[\s\S]*?</nav>', '<nav className="ov3-nav" aria-label="Product navigation"><a className="active" href="/overview">Overview</a><a href="/prerequisites">Prerequisites</a></nav>',s,count=1)
s=s.replace('<a href="/catalog-overview">SJSU workspace</a>','<a href="/prerequisites">Prerequisites</a>')
s=re.sub(r'href="/(?:courses|planner|roadmap|recommendations|catalog-overview)(?:\?[^\"]*)?"','href="/prerequisites"',s)
s=s.replace('href={`/courses?q=${encodeURIComponent(course.code)}`}','href="/prerequisites"')
s=s.replace('<a className="ov3-brand" href="/"><RadarMark /><span>Course<span>Radar</span></span></a>', '<span className="ov3-brand"><RadarMark /><span>Course<span>Radar</span></span></span>')
s=s.replace('<a href="/">Landing page</a>','<a href="/overview">Overview</a>')
p.write_text(s,encoding='utf-8')
