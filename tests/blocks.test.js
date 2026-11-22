import test from "node:test";
import assert from "node:assert/strict";
import { buildModel, toFlashcards, localDigits, renderDocument, examples } from "../core.js";
import { sourceToBlocks, blocksToSource, detectShortcut, suggest, arrange, newBlock } from "../blocks.js";

test("block editor round-trips markup without losing a line", () => {
  const src = [
    "# عنوان", "", "فقرة", "", "- أ", "- ب", "", "1. ج", "2. د", "", "> اقتباس", "", "85% من الناس", "", "?? سؤال", "!! جواب",
  ].join("\n");
  const blocks = sourceToBlocks(src);
  assert.deepEqual(blocks.map((b) => b.t), ["h", "p", "ul", "ul", "ol", "ol", "quote", "stat", "front", "back"]);
  assert.equal(blocksToSource(blocks), src);
  assert.equal(blocksToSource(sourceToBlocks(blocksToSource(blocks))), src);
});

test("typing shortcuts and suggestions", () => {
  assert.equal(detectShortcut("# ").t, "h");
  assert.equal(detectShortcut("## x").level, 2);
  assert.equal(detectShortcut("- x").t, "ul");
  assert.equal(detectShortcut("٣. x").t, "ol");
  assert.equal(detectShortcut("> x").t, "quote");
  assert.equal(detectShortcut("85% من").t, "stat");
  assert.equal(detectShortcut("نص عادي"), null);
  const bs = [newBlock("p", "مقدمة قصيرة"), newBlock("p", "هذا نص أطول بكثير من العنوان السابق ويشرح الفكرة بالتفصيل.")];
  assert.equal(suggest(bs, 0).t, "h");
  assert.equal(suggest([newBlock("p", "40% زيادة")], 0).t, "stat");
  const r = arrange([...bs, newBlock("p", "50% نمو")]);
  assert.deepEqual(r.blocks.map((b) => b.t), ["h", "p", "stat"]);
  assert.equal(r.changed, 2);
});

test("flashcards: heading or term is the front, the rest the back, nothing dropped", () => {
  const cards = (source) => toFlashcards(buildModel({ title: "x", source, form: "cards" }));
  const a = cards("# سؤال\nجواب أول\n\nجواب ثانٍ");
  assert.equal(a.length, 1);
  assert.ok(a[0].back.includes("جواب أول") && a[0].back.includes("جواب ثانٍ"));
  const b = cards("?? ما هي؟\n!! هذا\n?? وما هذه؟\n!! تلك");
  assert.deepEqual(b.map((c) => c.front), ["ما هي؟", "وما هذه؟"]);
  const c = cards("- مصطلح: شرحه\n- آخر — معناه\n- بلا شرح");
  assert.deepEqual(c.map((x) => x.front), ["مصطلح", "آخر", "بلا شرح"]);
  assert.equal(c[2].back, "");
  const d = cards("70% نسبة النجاح");
  assert.ok(d[0].big && d[0].front === "٧٠٪");
});

test("RTL numbers use Arabic-Indic digits and isolated percent", () => {
  assert.equal(localDigits("85%", "rtl"), "٨٥٪");
  assert.equal(localDigits("85%", "ltr"), "85%");
  const html = renderDocument({ title: "t", form: "article", source: "# عنوان\n1. أولى\n2. ثانية\n\n85% نسبة" });
  assert.ok(html.includes('<span class="n">١</span>') && html.includes("٨٥٪"));
  assert.ok(html.includes('<b dir="ltr">'));
});

test("explicit front/back blocks become headings and paragraphs in other forms", () => {
  const html = renderDocument({ title: "t", form: "article", source: "?? السؤال\n!! الجواب" });
  assert.ok(html.includes("السؤال") && html.includes("الجواب"));
});

test("every example stays readable in every form", () => {
  for (const ex of Object.values(examples))
    for (const form of ["summary", "cards", "article"]) assert.ok(renderDocument({ ...ex, form }).length > 50);
});

import { sanitizeState } from "../core.js";
test("saved state keeps the example flag only for real examples", () => {
  assert.equal(sanitizeState({ example: "cards" }).example, "cards");
  assert.equal(sanitizeState({ example: "nope" }).example, null);
  assert.equal(sanitizeState(null).example, null);
  assert.equal(sanitizeState(null).source, "");
});
