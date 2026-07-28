# Solar-Cell Integration Notes

The Solar Cells module is now a ready module in the Semiconductor Learning Hub.

## Added

- `modules/Solar_Cells/index.html` — complete interactive ebook for solid-state electronics
- `modules/Solar_Cells/assets/solar_cell_hydraulic_metaphor.png` — supplied high-resolution hydraulic head–flow poster
- `modules/Solar_Cells/modules/solar_cell_loop_metaphor.html` — editable standalone Photovoltaic Waterworks simulator
- main-hub navigation links for the hydraulic metaphor, photon energy and bandgap, illuminated J–V and power, and optical-stack/TMM lessons

## Navigation

- Use **Main Hub** in the solar-cell ebook to return to `index.html`.
- The standalone simulator includes links back to both the solar-cell ebook and the main learning hub.
- The former `modules/Solar_Cells.html` URL redirects to the integrated ebook for backward compatibility.

## Theme synchronization v2.1

- One canonical key: `maestra_hub_settings_v1`
- Storage events from legacy keys are ignored by the synchronizer.
- Externally applied themes are not persisted again.
- MutationObserver echo is explicitly suppressed.
- Historical theme keys are mirrored only for startup compatibility.
