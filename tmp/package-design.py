from pathlib import Path
import json, shutil
root=Path.cwd(); out=root/'exports'/'courseradar-design-2026-10-26'; out.mkdir(parents=True,exist_ok=True)
files=['ReferenceLanding.tsx','LandingCourseNetwork.tsx','reference-landing.css','landing-hero.css']
package=json.loads((root/'package.json').read_text())
for name,full in [('courseradar-frontend',True),('courseradar-landing',False)]:
 folder=out/name; (folder/'src').mkdir(parents=True,exist_ok=True)
 for file in files+(['ReferenceOverview.tsx','PrerequisiteMap.tsx','reference-overview.css'] if full else []): shutil.copy2(root/'src'/file,folder/'src'/file)
 entry=(root/'src/reference-entry.tsx').read_text(encoding='utf-8')
 if not full:
  entry=entry.replace('import Overview from "./ReferenceOverview";','').replace('import PrerequisiteMap from "./PrerequisiteMap";','').replace('import "./reference-overview.css";','')
  start=entry.index('const pathname =')
  entry=entry[:start]+'document.title = "Course Radar";\ncreateRoot(document.getElementById("root")!).render(<StrictMode><Home /></StrictMode>);\n'
  p=folder/'src/ReferenceLanding.tsx'; s=p.read_text(encoding='utf-8').replace('href="/overview"','href="#why-radar"').replace('href="/prerequisites"','href="#course-map"');p.write_text(s,encoding='utf-8')
 (folder/'src/main.tsx').write_text(entry,encoding='utf-8')
 (folder/'index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Course Radar</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>''',encoding='utf-8')
 deps={k:json.loads((root/'node_modules'/k/'package.json').read_text(encoding='utf-8'))['version'] for k in ['react','react-dom','lucide-react','tw-animate-css']}
 devs={k:json.loads((root/'node_modules'/k/'package.json').read_text(encoding='utf-8'))['version'] for k in ['vite','typescript','@vitejs/plugin-react','@tailwindcss/vite','tailwindcss','@types/react','@types/react-dom']}
 manifest={'name':name,'version':'1.0.0','private':True,'type':'module','scripts':{'dev':'vite --host 0.0.0.0','build':'tsc --noEmit && vite build','preview':'vite preview --host 0.0.0.0'},'dependencies':deps,'devDependencies':devs}
 (folder/'package.json').write_text(json.dumps(manifest,indent=2)+'\n')
 (folder/'vite.config.ts').write_text('import {defineConfig} from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwindcss from "@tailwindcss/vite";\nexport default defineConfig({plugins:[react(),tailwindcss()]});\n')
 (folder/'tsconfig.json').write_text(json.dumps({'compilerOptions':{'target':'ES2022','lib':['ES2022','DOM','DOM.Iterable'],'module':'ESNext','moduleResolution':'Bundler','jsx':'react-jsx','strict':True,'skipLibCheck':True,'esModuleInterop':True,'noEmit':True},'include':['src']},indent=2))
 (folder/'vercel.json').write_text(json.dumps({'rewrites':[{'source':'/(.*)','destination':'/index.html'}]},indent=2))
 (folder/'.gitignore').write_text('node_modules/\ndist/\n.env*\n')
 scope='Home `/`, Overview `/overview`, Prerequisites `/prerequisites` (with `/prerequisite-chart` alias).' if full else 'Standalone Home landing, including the shaded Hero and interactive course-map preview. Overview and Prerequisites navigation links scroll to landing sections instead of opening separate pages.'
 (folder/'README.md').write_text(f'''# Course Radar — {'Frontend design' if full else 'Standalone landing'}

{scope}

## Run

Use Node.js 22.12+ (or Node.js 24).

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

`dist/` includes the compiled version. Serve it through an HTTP server; opening index.html directly via file:// is not supported. For multi-page routes, configure the host to fall back to index.html; vercel.json is provided.

## Contents and boundaries

React + Vite + TypeScript, Tailwind v4 and Lucide. Current shaded landing, shortened window and separated map footer are included. UI data is illustrative; this is a frontend design export with no backend, authentication, production SJSU catalog connection or secrets. Google Fonts loads Inter, Manrope and DM Mono over the network. No node_modules is bundled. Exact dependency versions are recorded in package.json. No changes to the working app are required to use this package.

See IMPLEMENTATION.md for packaging and actual validation.
''',encoding='utf-8')
 (folder/'IMPLEMENTATION.md').write_text('''# Export implementation report

Source copied from the active Course Radar reference frontend on 2026-10-26. The full package keeps the three approved pages and existing document navigation. The landing package keeps only Home and its interactive preview, with subpage links changed to section anchors. Shared styling and Hero shade remain unchanged.

No backend or private configuration is included. Google Fonts remains an external dependency. No mobile redesign or visual regression verification was performed during export.

Validation results are appended after compilation.
''',encoding='utf-8')
 print(folder)
