import { mkdir, cp, rm, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = ['index.html','app.js','core.js','styles.css','fonts.css','pdf.js','blocks.js','editor.js','study.js','library.js','mini.js','preview-edit.js'];
await rm('dist', { recursive: true, force: true });
await mkdir('dist');

// Cache-busting: every local .js/.css reference gets ?v=<content hash of the whole build>,
// so a new deploy is never mixed with stale cached files (GitHub Pages caches 10 min).
const hash = createHash('sha256');
for (const f of files) hash.update(await readFile(f));
const v = hash.digest('hex').slice(0, 10);
const bust = (s) => s.replace(/(["'])(\.\/)?([\w-]+\.(?:js|css))\1/g, (m, q, dot, name) =>
  files.includes(name) ? `${q}${dot || ''}${name}?v=${v}${q}` : m);

for (const f of files) {
  if (/\.(html|js)$/.test(f)) await writeFile('dist/' + f, bust(await readFile(f, 'utf8')));
  else await cp(f, 'dist/' + f);
}
await cp('vendor', 'dist/vendor', { recursive: true });
console.log(`Built static site in dist/ (asset version ${v}).`);
