# Verification report — 2026-11-15

## Environment and actual outcomes

Chromium 156 via Python Playwright in the managed Linux environment. The application is served over HTTP. Real localStorage was used. Original Thmanyah WOFF2 bytes were embedded and loaded.

- 6 Node unit tests: lossless long text, semantic list/step classification by rules, lossless slide segmentation and emoji boundaries, escaped user markup, stored-state normalization, >8 scenes.
- 45 browser assertions: example persistence after reload, editor/undo, presentation navigation/Escape, long-content tail retention, article/cards/slides at 360/393/768/1024/1440 widths, no scene clipping/horizontal page overflow, standalone export without network, malicious-looking text remaining inert, no runtime exceptions.
- 27 export assertions: identical document markup and rendered text between preview/HTML for all three formats; identical declared heading/body font families; embedded font readiness; all five example scenes in actual PDF print windows; PDF font inspection and absence of JavaScript.
- 56 screen assertions: home and three editor panels at five widths, three themes in presentation mode, unclipped scenes, reduced motion, expressive motion execution, native dialog focus restoration, empty-input preservation.
- Long PDF checks: 12 long Arabic/English segments in each of article/cards/slides. All 24 start/end sentinels were found in each actual generated PDF using pdftotext. No content truncation was observed.
- Visual inspection: home, desktop editor, mobile preview, and rasterized PDF slide. Font hashes recorded separately.

## Export consistency contract

The editor, HTML export and print window call the same renderer with the same project state and embed the same styles and original font data. HTML stores original source as well as the displayed scenes. PDF uses A4 paper pagination and therefore does not claim pixel-identical line wrapping to every viewport. Background graphics must be enabled and browser headers/footers disabled in the print dialog. PDF is static; HTML retains animations and navigation.

The managed browser blocks file:// and data: top-level navigation. The exported HTML bytes were loaded into a fresh browser document, with network disabled for the offline check. This verifies standalone execution and assets, but is not a physical-device file-opening test.

## Not verified / limitations

- The browser does not provide a usable on-device Arabic language model. Optional LanguageModel rewriting is feature-gated, not end-to-end validated. Rule-based local formatting is working; it is not advertised as semantic AI.
- No physical iOS/Android, Safari/Firefox, browser-extension, independent penetration, WCAG, or Lighthouse audit.
- No claim of unlimited browser memory/localStorage capacity. There are no product-level character or scene truncation limits; quota failure is surfaced.
- Arabic interface is active; English and mixed content work. The old bilingual UI remains in the unchanged reference prototype, not in the new editor.
- Browser printing can vary with user print settings. Animated PDF is not supported.
- GitHub code upload and public site deployment are separate. No public deployment is claimed by this report.

## Follow-up: local model and Pages preparation — 2026-11-16

Added a browser-only Transformers.js 4.3.2 worker with Qwen2.5-0.5B-Instruct, opt-in download, progress and cancellation. This replaces the unsupported browser LanguageModel API path described above. The static build succeeds and ships its WASM runtime from the same origin. npm audit reports zero known vulnerabilities in the locked dependency tree at this check.

Five real-worker failure-path assertions pass: worker loads, attempts Hugging Face model assets, failure preserves source and preview, and source text is absent from network URLs/request bodies. These do NOT validate inference or Arabic quality; model download remains blocked by runtime networking. The 45 browser assertions and 27 export assertions were rerun successfully after integration.

The GitHub Pages workflow is prepared for manual execution after inference/live acceptance verification. GitHub API and the expected live URL are also blocked by runtime network policy. No successful public deployment is claimed. See DEPLOY.md for the concrete unblock steps.

## Revised scope without AI — 2026-11-16

AI is removed at the user's request; historical model blockers no longer apply. Reran 6 unit tests, 45 browser assertions, 27 export parity assertions, 56 responsive/interaction assertions, and all three long-PDF scenarios successfully. Added `tests/no_ai.py`: confirms that the publication build contains exactly the five application files, package lock has no dependencies, model controls are absent, source text remains intact, generation works from a subdirectory, and no external requests or JavaScript errors occur in that flow. The source and build contain no model worker or inference runtime. This revision has not been publicly deployed.
