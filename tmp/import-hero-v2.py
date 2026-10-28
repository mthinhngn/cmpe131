from pathlib import Path
base=Path('tmp/courseradar-reference-v2/client/src')
Path('src/ReferenceLanding.tsx').write_text((base/'pages/Home.tsx').read_text(encoding='utf-8').replace('"@/components/CourseNetwork"','"./LandingCourseNetwork"'),encoding='utf-8')
Path('src/LandingCourseNetwork.tsx').write_bytes((base/'components/CourseNetwork.tsx').read_bytes())
Path('src/reference-landing.css').write_bytes((base/'index.css').read_bytes())
