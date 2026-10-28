from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json
out=Path('exports/courseradar-design-2026-10-26')
for name in ['courseradar-frontend','courseradar-landing']:
 folder=out/name
 with (folder/'IMPLEMENTATION.md').open('a',encoding='utf-8') as f:f.write('\nTypeScript strict check passed. Vite production build passed (5.09 seconds); compiled dist/ included. Builds used the installed workspace runtime/dependencies matching the exported package versions. Fresh npm installation and rendered browser interaction were not independently verified.\n')
 archive=out/(name+'.zip')
 with ZipFile(archive,'w',ZIP_DEFLATED) as z:
  for file in sorted(folder.rglob('*')):
   if file.is_file():z.write(file,Path(name)/file.relative_to(folder))
 with ZipFile(archive) as z:
  assert z.testzip() is None
  assert name+'/dist/index.html' in z.namelist()
  assert not any('node_modules/' in p or '/.env' in p for p in z.namelist())
 print(json.dumps({'zip':str(archive.resolve()),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
