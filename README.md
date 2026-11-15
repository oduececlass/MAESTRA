# MAESTRA Semiconductor Learning Hub

Interactive solid-state electronics ebooks and simulations, integrated with the MAESTRA engineering learning tools. The site is static and ready for GitHub Pages.

## Structure

```text
index.html            Hub landing page (start here)
404.html              GitHub Pages "not found" page
.nojekyll             Serve files as-is on GitHub Pages
modules/              Ebooks and simulators, one numbered folder per topic
  1_Semiconductor_Basics/  1.1_Basic_Semiconductor, 1.2_Fermi_DOS_Concentration_Simulator
  2_PN_Diode/              2.1_PN_Diode_Chapter, 2.2_PN_Diode_Drift_Diffusion_Simulator,
                           2.3_Poisson_Rubber_Sheet, 2.4_Poisson_Rubber_Sheet_AI_HighRes
  3_BJT/                   3.1_Bipolar_Transistors, 3.2_BJT_Metaphor
  4_MOSFET/                4.1_MOS_Capacitor_and_MOSFET, 4.2_MOS_Water_Table_Metaphor,
                           4.3_MOS_Surface_Potential, 4.4_MOS_CV_Frequency, 4.5_nMOS_Device_Lab
  5_MESFET/                5.1_MESFET_Chapter, 5.2_Metal_Semiconductor_Contact_Lab,
                           5.3_Schottky_Thermionic_Emission, 5.4_Schottky_Contact_Simulator,
                           5.5_Frozen_Sluice_Lab, 5.6_MESFET_2D_Dynamic_Channel
  6_Solar_Cells/           6.1_Solar_Cells_Chapter, 6.2_Photovoltaic_Waterworks_Simulator

Each topic folder holds only its HTML pages; images are embedded in the pages that use them.
maestra/              EE Canvas, Student/Instructor Workspace, Problem Set Builder, Assessment Grader
shared/               Hub runtime used by every page
  maestra-bridge.js     lesson context, tool launching, return navigation
  theme-sync-v2.js      shared light/dark theme
  maestra-toolbar.css   floating lesson/tool toolbar
  maestra-design.css    shared look for all learning pages (hub fonts + palette)
  maestra-embed.js      shows embedded simulators at full height (no inner scrollbar)
  maestra-vlab.js/.css  guided virtual-lab engine (instrument, notebook, CSV export) used by the
                        labs in topics 1, 2 and 6; each chapter registers its own lab code inline
  maestra-ai.js/.css    AI Tutor pop-up for the six chapters (Google AI Studio / Gemini API)
  maestra-accessibility.js  generated control labels, keyboard tabs, and theme controls
docs/
  DEPLOY_TO_GITHUB_PAGES.md  upload and publishing instructions
tools/
  apply_shared_design.py    optional maintenance helper; not needed to run the site
.gitignore             excludes local secrets, caches, backups, and exports
```

## Shared look

Every learning page uses the Learning Hub's font and colours through `shared/maestra-design.css`. Each page is tagged `<html data-maestra-page="...">`, and the stylesheet points that page's own colour variables at the hub palette. Learning-page interfaces follow the shared light/dark theme. Some scientific drawings retain a fixed palette for their plotted elements. Chapter navigation reserves enough space for multi-level topic numbers.

After adding or replacing a page (for example copying in updated MESFET pages), run:

```text
python tools/apply_shared_design.py
```

New pages also need an entry in that script and, if they use their own colour variable names, a mapping block in `maestra-design.css`.

## Workflows

- **Students:** learn a concept → explore its simulation → return to the Learning Hub → open EE Canvas or the Student Workspace. The floating lesson launcher is currently disabled.
- **Instructors:** study a lesson → open the Problem Set Builder or Instructor Workspace from the hub → grade in the Assessment Grader.

## AI Tutor

Each chapter (1.1, 2.1, 3.1, 4.1, 5.1, 6.1) has an **AI Tutor** button that opens a pop-up chat powered by Google AI Studio (Gemini).

- **Students' own key.** On first use the tutor shows a one-time setup: paste a personal key from aistudio.google.com/apikey, choose a model, Save. By default the key lasts only for this tab session (`sessionStorage`). Choosing Remember stores it in this browser (`localStorage`) and shares it with the eight supported legacy simulator configurations. The solar-waterworks tutor and MAESTRA tools use separate configuration.
- **Knows where the student is.** The tutor reads the section on screen (and any virtual-lab readings and notebook rows) and answers in that context, in *Socratic hints* or *Explain* mode.
- **Movable.** Drag the AI Tutor button, or the chat window by its title bar, anywhere on the screen; the spot is remembered on every page. Double-click the title bar to put it back in the corner.
- **Chats** are saved automatically per chapter and can be renamed, reopened, deleted, exported (Markdown or JSON) and imported from the history view. If browser saving is unavailable, chats remain in the open tab and History shows an export reminder; export them before closing the tab.

There is no application server. When a tutor request is sent, the browser sends the question, recent chat history and available lesson/lab context to the selected AI provider. The shared chapter tutor defaults to a session-only key. Remembering a key also copies it into older simulator settings; disabling remember or removing the key clears those stored copies. Already-open legacy panels may retain a key in memory until closed. Older panels and MAESTRA tools have separate settings; use their own removal controls.

## Deploying

See [the deployment guide](docs/DEPLOY_TO_GITHUB_PAGES.md).

Upload the contents of this folder, preserving the `modules/`, `maestra/`, and `shared/` paths. No build step or Python execution is required for hosting. Keep `.nojekyll` at the repository root. Backups and audit reports are kept outside this project folder.
