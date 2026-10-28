from pathlib import Path
p=Path('src/ReferenceOverview.tsx');s=p.read_text(encoding='utf-8');s=s.replace('Plus, Sparkles }','Plus }');s=s.replace('<span>NEXT DECISIONS</span><Sparkles size={16} />','<span>NEXT DECISIONS</span>');p.write_text(s,encoding='utf-8')
p=Path('IMPLEMENTATION.md')
s=p.read_text(encoding='utf-8',errors='surrogateescape')
s+='\n## Overview Next decisions icon - 2026-10-27\n\nRemoved the decorative Sparkles icon beside NEXT DECISIONS in the active ReferenceOverview and removed its unused import. The existing heading, spacing, decision content, and links are retained. This presentation-only edit uses the existing component and changes no state or architecture. Verified the rendered desktop panel contains its text heading and zero SVG icons; browser inspection at 1242px confirms the removal. No new tests or dependencies required.\n'
p.write_bytes(s.encode('utf-8',errors='surrogateescape'))
