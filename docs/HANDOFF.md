# Handoff — Takween

Prompt for the next agent: continue Takween in `C:\Users\Ahmed\Desktop\Projects\Takwin` (branch main, repo Ahmed-Ba11/Takwin). Reply to the user in Saudi-friendly Arabic.

## Rules (user decisions)
Simple clear MSA copy everywhere (no slogans, no English decorative labels); NO slides; PDF-only export (no HTML export); keep glass identity (cream, ink #203f36, accent #b2874d, themes mist/sand/olive, Thmanyah fonts); no AI; every commit pushed (`git push origin main`); never commit `desktop.ini`, `.claude/`, fonts binaries; commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; do not touch `fonts.css` or `legacy-v3.html`.

## Built
- `core.js`: `parseBlocks`, `buildModel`, `renderDocument` (interactive screen HTML), `renderPdfModel` (head + non-splittable units), `examples`, `sanitizeState`, `fileName`.
- `app.js`: routes `#home` / `#write`, live preview (120ms debounce), localStorage key `takween-v5`, markup toolbar (execCommand so native undo works), mobile tabs + sticky PDF bar, home demo cycling 3 forms.
- `pdf.js`: `paginate` (A4 794x1123 px, never splits a unit; oversize unit scaled to ≥0.5), `buildPdf` (html2canvas scale 2 → JPEG 0.95 → jsPDF), `deliver` (share on touch, else download).
- `styles.css`: shared rules for `.preview` and `.pdf-page` (no backdrop-filter inside cards, so PDF = preview).
- html2canvas gotchas: no `::marker`, no CSS `counter()` content → use explicit `.n` spans; no inset shadows.

## State
Home, workspace (desktop + 375px), 3 forms × 3 themes and PDF export verified (see docs/QA.md). Not verified: real iOS/Safari, share sheet.

## TODO (priority)
1. Test on a real phone (iOS Safari + Android Chrome): download/share, memory on long texts.
2. Cards PDF wastes space when card heights differ (grid rows); consider masonry/column packing.
3. Summary hoists stats away from their section; consider keeping order.
4. Optional: selectable text in PDF (vector) instead of images.
5. Update GitHub Pages workflow if `pdf.js`/`vendor` paths change (build copies them).

## Commands
```
node tools/serve.mjs        # dev server on 4318 (use preview config "takween")
npm test
pdftoppm -r 60 -png file.pdf out   # rasterise a PDF to check it
```
