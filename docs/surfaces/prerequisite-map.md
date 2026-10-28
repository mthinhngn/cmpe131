# Prerequisite Map

Mode: Operate. Routes: `/prerequisite-chart`, `/prerequisites`, including trailing slashes.

The current landing (`ReferenceLanding.tsx`, `LandingCourseNetwork.tsx`, `reference-landing.css`) is the visual authority. The Manus export `courseradarui.zip` provides the surrounding full-page composition and planning sidebar. Keep the landing's Inter chrome, Manrope course data, DM Mono captions, white/limestone surfaces, mint grid, teal connections, original course coordinates and relationships, and shared interactive chart implementation.

The user's browser corrections require a single-line “Prerequisite map” heading; no heading description, back-link/catalog-link topline, or divider; and narrower course cards on the dedicated page. The optional `density="compact"` uses the export's 150-unit card width and centers edge endpoints on those cards. The landing retains its default 190-unit width. This explicit correction supersedes exact width equality for the dedicated page only; do not introduce an independent graph renderer or skin.

The full page shows the export's “INTERACTIVE DEGREE PLAN” frame label and its existing planning sidebar above 820px. The sidebar is an illustrative summary, not an interactive year selector. At narrower widths use the shared mobile course presentation and site menu. No new motion: course exploration is frequent Operate work and should remain immediate; inherited shared status feedback remains.

The eight-course Computer Science graph is the supplied example, not SJSU catalog data. Keep the example disclosure. `/catalog-prerequisites` retains the original SJSU graph, program switching, course details, official-source access, completion state and session planning. Other workspace routes continue using their existing providers and styles.

Verification script: `node tmp/verify-prerequisite-map.cjs`. Evidence: `.impeccable/review/prerequisite-map/`. Test shared graph styles and positions, explicit width override and edge anchors, search/list/empty states, mouse and keyboard selection, zoom/reset, term picker, navigation, sidebar presence, responsive overflow, and retained catalog graph. Do not describe the whole page as pixel-identical to the landing: its viewport/sidebar and latest requested card width intentionally differ.
