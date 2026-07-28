# MAESTRA Semiconductor Learning Hub

A GitHub Pages-ready integration of solid-state electronics ebooks and simulations with the MAESTRA engineering learning-tool suite.

## Site structure

- `index.html` — integrated course and tool landing page
- `modules/` — semiconductor learning modules and simulators
- `maestra/` — EE Canvas, Student Workspace, Problem Set Builder, Instructor Workspace, and Assessment Grader
- `shared/maestra-bridge.js` — lesson context, tool launching, and return navigation
- `shared/theme-sync.js` — shared light/dark appearance across the hub and tools
- `shared/maestra-toolbar.css` — floating lesson/tool navigation

## Student workflow

Learn a concept → explore its simulation → open EE Canvas or Student Workspace from the lesson toolbar → return to the exact lesson.

## Instructor workflow

Open a lesson → launch Problem Set Builder or Instructor Workspace with lesson context → review or grade work in the Assessment Grader.

See `DEPLOY_TO_GITHUB_PAGES.md` for deployment instructions and the static-hosting security limitation.

## v4.1 theme stability fix

The shared appearance runtime now uses a single canonical storage event and suppresses storage-event echo between tabs and same-origin iframes. This removes the dark/bright blinking that could occur after a theme change. The runtime is versioned as `shared/theme-sync-v2.js` to avoid stale GitHub Pages browser caches.
