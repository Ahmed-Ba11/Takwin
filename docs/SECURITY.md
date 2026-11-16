# Security review

## Boundaries

User source, titles and scene bodies are untrusted text. The shared renderer HTML-escapes them. Exported project JSON escapes `<` and Unicode line separators to prevent closing its script data element. Only application-owned JavaScript is executable. No eval, Function constructor, remote scripts, tracking, backend, or credential fields are present in the active app.

Standalone exports have a restrictive CSP: no connections, forms, base URL or external assets; only embedded styles/fonts and the application-owned inline viewer script. Inline script permission is necessary for a standalone viewer and is not a substitute for escaping. Browser extensions and a compromised hosting origin are outside this boundary.

PDF is produced by the browser from the rendered print view. Automated checks inspect generated PDFs for embedded fonts and absence of JavaScript. User text is not turned into links, scripts, HTML, or embedded attachments.

Original source is included in the HTML project data, even after local rewriting. LocalStorage holds content on the current browser profile and is not encrypted. Do not describe local storage as a secret vault.

## Checked

HTML-like source with closing script tags and event handlers remains literal text in preview/export. Export has no network dependencies. Exact document content/markup and selected font families are compared between preview and standalone viewer. Font packaging verifies original bytes. Responsive and long-content checks exercise no-clipping behavior.

## Limits

No security audit can prove absence of all vulnerabilities. No independent penetration test or formal WCAG audit was performed. Generated HTML intentionally contains the minimal first-party JavaScript required for motion/navigation; PDF is the static alternative. Previously supplied `legacy-v3.html` is reference material, not covered by the new-app audit.

## No-AI revision

Removed model downloads and all npm dependencies from the application. The static publication build is restricted to index.html, app.js, core.js, styles.css, fonts.css. A browser regression verifies that generation makes no external requests. Existing text escaping and standalone-export protections remain and their tests pass.
