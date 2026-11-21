import { mkdir, cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html','app.js','core.js','styles.css','fonts.css','pdf.js','blocks.js','editor.js','study.js']) {
  await cp(file, 'dist/' + file);
}
console.log('Built dependency-free static site in dist/.');
await cp('vendor', 'dist/vendor', { recursive: true });
