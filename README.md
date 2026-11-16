# تكوين — Takween Studio

Arabic-first, local text-to-visual studio. Glass surfaces, warm backgrounds, Thmanyah typography, editable scene structures, article/cards/slides views, standalone animated HTML and browser PDF export.

## Run

```sh
npm run build
npm start
# http://127.0.0.1:4318
```

No backend or npm dependencies required. Build simply copies the static application into dist/. `index.html`, `app.js`, `core.js`, `styles.css`, and `fonts.css` are the application. Serve over HTTP rather than opening the module-based editor with file://.

## Verification

```sh
npm test
python tests/browser.py
python tests/export_parity.py
python tests/screens.py
```

Browser suites require Python Playwright, `/usr/bin/chromium`, `pdffonts`, `pdfinfo`. Artifacts go to ignored `.test-artifacts/`. See `docs/QA.md` for observed results and limits.

## Local formatting

Paragraph/list/step recognition runs locally with deterministic rules, without AI, model downloads, API keys, or external requests. The original text is preserved. There are no arbitrary eight-scene/350-character truncation limits. Users control scene layout and ordering.

## Export

- HTML: embedded fonts/styles, original source and editable project data, shared render function, local navigation/motion. No external assets or network dependency. Original source is included: review it before sharing.
- PDF: opens a print window containing all scenes. Choose Save as PDF, enable background graphics, and disable browser headers/footers. PDF is static and cannot preserve HTML/CSS animation. It uses the same content and fonts, with A4 pagination; paper layout is not pixel-identical to every responsive viewport.
- Data remains in the current browser's localStorage. Quota failures are surfaced. HTML download is the portable backup.

## Fonts

The user supplied and authorized the Thmanyah family. Four original WOFF2 files are embedded byte-for-byte in the generated `fonts.css`; individual binaries are excluded from Git. SHA-256 values are recorded in `docs/font-hashes.json`. Rebuilding requires the original files in ignored `thmanyah/`, followed by `python build_fonts.py`. Embedding is packaging, not encryption or prevention of extraction. No claim of sponsorship by the typeface owner.

## Scope

The active UI is Arabic; Arabic, English and mixed content and manual RTL/LTR direction are supported. The previous bilingual v3 prototype is preserved unchanged as `legacy-v3.html`, outside the active application. No accounts, cloud publication, analytics, backend, or third-party scripts are used. Push to GitHub does not itself publish GitHub Pages.
