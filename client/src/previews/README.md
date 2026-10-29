# Reading journey concept preview

Run `npm run preview:journey --prefix client` from the repository root, then open
`http://127.0.0.1:3152/reading-journey.html`.

This isolated Vite entry is not imported by the deployed application. It simulates
338 pages in 40 seconds, with a three-second hold for each end's two pages. The
sun/moon is a keyboard-accessible pointer slider. Dragging it seeks the simulated
reading position and resumes playback on release. Starting at night reverses the
lighting and swaps the departing/arriving companion. The sky blends continuously;
control foregrounds and surfaces stay paired for contrast.

The book displays two fixed local sample images, not a real navigation or audio
session. The preview middleware serves only the existing page-11/page-12 PNGs from
`build/page-previews/`; it never serves the PDF, database or credentials. If the
optional local samples are absent, the existing reader text fallback is used.

`npm run test:journey --prefix client` checks end holds, reversed lighting, seeking,
preview time conversion and companion thresholds. The preview also honors reduced
motion, suspends its clock while the document is hidden, and cancels pointer drags.
