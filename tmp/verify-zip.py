from pathlib import Path
from zipfile import ZipFile
base=Path('tmp/courseradar-reference-20261026/client')
html=(base/'index.html').read_text().replace('<script src="/api/platform/config.js"></script>','').replace('src="/src/main.tsx"','src="/reference-check.tsx"')
(base/'reference-check.html').write_text(html)
with ZipFile('C:/Users/thinh/Downloads/courseradar.zip') as z:
 for source,dest in [('client/src/index.css','src/reference-landing.css'),('client/src/components/CourseNetwork.tsx','src/LandingCourseNetwork.tsx')]:
  print(dest,'EXACT BYTES' if z.read(source)==Path(dest).read_bytes() else 'DIFFERENT')
 expected=z.read('client/src/pages/Home.tsx').decode().replace('"@/components/CourseNetwork"','"./LandingCourseNetwork"')
 print('Home.tsx', 'EXACT except local import' if expected==Path('src/ReferenceLanding.tsx').read_text(encoding='utf-8') else 'DIFFERENT')

