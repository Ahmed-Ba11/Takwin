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

## Round 2 (done)
Block editor (`blocks.js`, `editor.js`): contenteditable row per block, source still plain markup (`??`/`!!` = card front/back). Flip cards (`.fc`, 3D) + `study.js`. SVG logo, back button, View Transitions, scroll reveal, «ترتيب سريع» (`arrange`). RTL: Arabic-Indic digits + isolated ٪ (`localDigits`). html2canvas cannot do 3D flips, so PDF cards print front above back (`.fc-print`).

## Round 3 (done): blank start vs examples
«ابدأ الكتابة» (`[data-new]`) always opens a blank doc; the previous draft is stashed under localStorage `takween-v5-prev` and offered via the «متابعة مسودتك السابقة» chip (`#resume`). «شاهد مثالًا» / the try-row open an example flagged `state.example` (banner `#example-banner`: «ابدأ نصّي الخاص» / «انسخ المثال لأعدّل عليه»); examples never overwrite a real draft. Reloading `#write` continues the current doc. Logic: `newDoc`, `openExample`, `syncDocUI` in app.js.

## Round 4 (done): «مدونتي» library + clear text
`library.js`: `createLibrary(backend)` (list/get/save/remove/restore/duplicate/exportAll/importAll, subscribe), backends `autoBackend()` (IndexedDB -> localStorage fallback) and `memoryBackend()` for tests; swap the backend to move to a server later. Route `#library` (app.js `renderLibrary`, thumbnails = scaled `renderDocument`), header link + count badge, search/filter chips, delete with undo toast, backup export/import (merge by id, newer never overwritten). Save: «حفظ في مدونتي» (`saveToLibrary`), doc linked via `state.libId` then autosaves (`scheduleLibSave`; empty docs are never autosaved; examples save as a copy). Clear: «مسح النص» (`clearText`, toast with undo, Ctrl/Cmd+Shift+Backspace); editor Ctrl+A + Delete and cross-block delete (`editor.js`: `allSel`, `deleteAcross`, `clearAll`). New files must be added to `tools/build.mjs` `files` (cache-busting `?v=` hash).

## Round 5 (done): edit directly in the preview
The preview is another view of the editor's block model. `renderDocument({...state, blocks: editor.getBlocks()})` stamps every text element with `data-block-id` (+ `data-part`/`data-sep` for stats and derived flashcard faces; `data-toc-for` on TOC links; `data-title` for the free title). `preview-edit.js`: contenteditable on those elements, `input` -> `editor.setTextById` (no preview rebuild), Enter/Backspace via `beforeinput` -> `editor.splitById/backspaceById`, then `afterPreviewOp` re-renders and `focusTarget` restores the caret. `editor.js` id-based API (`retypeById` splits partial selections, `removeById`, `deleteRange`, quiet mode = no focus stealing) + shared undo/redo (`undo(true)`, `redo(true)`, redo button). `mini.js`: one floating type toolbar (colours + «حذف») for editor selections and preview focus/selection; docked above the keyboard on mobile. Flashcards: tapping text edits, the «اقلب» button (or empty card area) flips; study mode stays read-only. PDF/library renders get no ids (`renderPdfModel` strips blocks). Fixed: reading time now «٣ دقائق»; headings with المرحلة/الخطوة are never altered (tests; could not reproduce the glued «المرحلة العادات الهدف» in the current parser, likely from the removed old step layout).

## State
Home, workspace (desktop + 375px), 3 forms × 3 themes and PDF export verified (see docs/QA.md). Not verified: real iOS/Safari, share sheet.

## TODO (priority)
0. Real-device test of the block editor (Android/iOS keyboards, IME, `beforeinput` Enter/Backspace), study swipe on touch.
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
