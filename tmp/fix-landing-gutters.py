from pathlib import Path
p=Path('src/reference-landing.css')
s=p.read_text(encoding='utf-8-sig')
s=s.replace('width: min(100% - 64px, 1280px)', 'width: var(--landing-rail)').replace('width: min(100% - 64px, 1190px)', 'width: var(--landing-rail)')
s=s.replace('width: min(100% - 44px, 1280px)', 'width: var(--landing-rail)').replace('width: min(100% - 44px, 1190px)', 'width: var(--landing-rail)')
s=s.replace('width: min(100% - 36px, 1280px)', 'width: var(--landing-rail)').replace('width: min(100% - 40px, 1190px)', 'width: var(--landing-rail)')
s+='''
/* One shared content rail: avoid shrinking the reference inside a narrow frame. */
.zip-landing { --landing-gutters:80px; --landing-rail:min(1580px, calc(100% - var(--landing-gutters))); }
.zip-landing .closing-section { padding-inline:0; }
.zip-landing .closing-inner { width:var(--landing-rail); max-width:none; }
@media (max-width:1100px) { .zip-landing { --landing-gutters:48px; } }
@media (max-width:800px) { .zip-landing { --landing-gutters:32px; } }
'''
p.write_text(s,encoding='utf-8')
