# SDLC record

## Requirements baseline

- Preserve and refine warm glass identity; calm, layered backgrounds.
- Local text processing, no silent truncation, flexible mixed scene types.
- Article, cards and HTML slides; expressive/reduced/disabled motion.
- Source → optional outline review → editable result → preview/presentation/export.
- Thmanyah font from user archive; preserve original font bytes.
- HTML with motion and PDF with identical content/fonts, static paper pagination.
- Work in `/workspace/Takwin`; push code to `Ahmed-Ba11/Takwin`.

## Analysis of v3

Observed in the supplied source: 350-character import truncation; eight-item limit; fixed-height slide clipping; misleading icon geometry; overwritten function definitions and layered CSS; example loading without immediate persistence; editor content exceeding its sticky container.

## Design decisions

Keep the green/cream/sand glass system and meaningful typography. Separate source, scene editing, and styling in a compact editor; give preview the larger desktop column. Mobile uses explicit editor/preview tabs. Native dialogs handle focus containment and Escape. Six scene compositions (text, cover, card, stage, quote, ending) share the same render function across preview and export. Decorative icons are not mandatory. No copied Scrolltide content or script; access was unavailable.

## Implementation

- `core.js`: lossless segmentation, pagination, escaping, state validation, shared renderer.
- `app.js`: routing, state/undo, local persistence/migration, editor, dialogs, exports, feature-detected local model.
- `styles.css`: responsive glass system and motion, shared with exports.
- `build_fonts.py`: base64 packaging and SHA-256 integrity audit of supplied fonts.
- Existing v3 is retained as reference, rather than hiding removal of its bilingual interface.

## Validation and release

Unit tests + real Chromium flows + responsive screen matrix + export parity + actual PDF font inspection. See QA report. Commit only application, documentation, and tests; omit generated test files and standalone font binaries. Verify remote commit after push.

## Known requirement gaps

Semantic Arabic AI is not available in the current browser. The optional local browser-model path is implemented but cannot be truthfully marked end-to-end verified here. No remote service is used. There is no physical-device Safari/Android testing. PDF motion is not supported by the format; standalone HTML is the animated alternative.

## Follow-up iteration

Requirement: finish local intelligence before free hosting. Implemented bundled browser worker rather than requiring the experimental browser API. Explicit opt-in acknowledges model download size; cancellation/failure preserve user work. Upgraded the initial library after npm audit identified a high-severity transitive dependency; locked replacement reports zero known vulnerabilities. Build and regression checks pass. End-to-end inference/quality and deployment verification remain externally blocked by network policy; prepared manual Pages workflow without claiming publication.
