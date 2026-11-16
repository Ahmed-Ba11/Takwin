import { build } from "esbuild";
import { mkdir, cp, readdir, rm } from "node:fs/promises";
await rm("vendor", { recursive: true, force: true });
await mkdir("vendor", { recursive: true });
await build({
  entryPoints: ["local-ai.worker.js"],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: "vendor/local-ai.worker.js",
  minify: true,
  legalComments: "linked",
});
for (const name of await readdir("node_modules/onnxruntime-web/dist")) {
  if (/^ort-wasm.*\.(wasm|mjs)$/.test(name))
    await cp("node_modules/onnxruntime-web/dist/" + name, "vendor/" + name);
}
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const file of [
  "index.html",
  "app.js",
  "core.js",
  "styles.css",
  "fonts.css",
  "local-ai.js",
])
  await cp(file, "dist/" + file);
await cp("vendor", "dist/vendor", { recursive: true });
console.log("Built static site and browser-only local AI worker in dist/.");
