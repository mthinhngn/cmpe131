# Course Radar — Frontend design

Home `/`, Overview `/overview`, Prerequisites `/prerequisites` (with `/prerequisite-chart` alias).

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
