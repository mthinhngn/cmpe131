import json
from pathlib import Path
p=Path('.impeccable/design.json')
p.write_text(json.dumps({'schemaVersion':2,'generatedAt':'2026-10-26T00:00:00Z','title':'Course Radar — Steep landing','extensions':{'motion':{'easeOut':'cubic-bezier(.23,1,.32,1)','pathDraw':'2.6s','courseArrival':'850ms'},'breakpoints':{'stack':'760px','compactDesktop':'1100px'},'shadows':{'course':'0 12px 36px -12px #17191c24','week':'0 12px 36px -12px #17191c1a'}},'narrative':{'northStar':'A little clarity','overview':'White editorial product clarity with serif headlines, pill actions and one peach proposal panel.'}},indent=2),encoding='utf-8')
p=Path('docs/surfaces/landing.md')
s=p.read_text(encoding='utf-8-sig'); p.write_text('> Superseded for route `/` on 2026-10-26 by [landing-steep.md](landing-steep.md), following the user-supplied Steep reference. The historical notes below are retained for traceability.\n\n'+s,encoding='utf-8')
