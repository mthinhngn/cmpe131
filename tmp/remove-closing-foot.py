from pathlib import Path
import re
p=Path('src/ReferenceLanding.tsx')
s=p.read_text(encoding='utf-8')
s,n=re.subn(r'\s*<div className="closing-foot"><span>Clarity, course by course\.</span><span>Made for students building what’s next\.</span></div>', '', s)
if n!=1: raise SystemExit(f'Expected one closing-foot, found {n}')
p.write_text(s,encoding='utf-8')
