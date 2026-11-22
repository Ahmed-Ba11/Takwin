import test from "node:test";
import assert from "node:assert/strict";
import { renderDocument, renderPdfModel, flatToParsed, minutesLabel, buildModel, toFlashcards, parseBlocks } from "../core.js";
import { sourceToBlocks } from "../blocks.js";

const doc = (source, form, extra = {}) => ({ title: "t", source, form, blocks: sourceToBlocks(source), ...extra });
const ids = (html) => [...html.matchAll(/data-block-id="(\d+)"/g)].map((m) => m[1]);

test("every rendered text element carries its block id (all forms)", () => {
  const src = "# عنوان\nفقرة\n\n- أ\n- ب\n\n1. ج\n\n> اقتباس\n\n85% نسبة\n\nأولى: ثانية";
  for (const form of ["summary", "cards", "article"]) {
    const html = renderDocument(doc(src, form));
    assert.ok(ids(html).length >= 5, `${form}: ${ids(html).length}`);
  }
  const d = doc(src, "article");
  const article = renderDocument(d);
  assert.ok(article.includes(`data-block-id="${d.blocks[1].id}"`));
  assert.ok(article.includes(`data-toc-for="${d.blocks[0].id}"`));
});

test("flat blocks group lists and keep ids", () => {
  const flat = sourceToBlocks("- أ\n- ب\n\n> ق\n\n85% س");
  const parsed = flatToParsed(flat);
  assert.deepEqual(parsed.map((b) => b.t), ["ul", "quote", "stat"]);
  assert.deepEqual(parsed[0].ids, [flat[0].id, flat[1].id]);
  assert.equal(parsed[2].value, "85%");
});

test("stats and derived flashcard faces are split into editable parts", () => {
  const html = renderDocument(doc("70% نسبة\n\nمصطلح: شرح", "cards"));
  assert.ok(html.includes('data-part="value"') && html.includes('data-part="label"'));
  assert.ok(html.includes('data-part="front"') && html.includes('data-part="back"'));
  assert.ok(html.includes('data-sep=": "'));
  assert.ok(html.includes("fc-flip"));
  assert.ok(!/class="fc-in"[^>]*tabindex/.test(html));
});

test("PDF and library renders carry no editing hooks", () => {
  const s = { title: "t", source: "# أ\nب\n\n- ج", form: "article", blocks: sourceToBlocks("# أ\nب") };
  const p = renderPdfModel(s);
  assert.ok(!p.units.join("").includes("data-block-id") && !p.head.includes("data-title"));
  assert.ok(!renderDocument({ title: "t", source: "ب", form: "summary" }).includes("data-block-id"));
});

test("headings that contain step words are never changed or reordered", () => {
  const src = "# المرحلة العادات الهدف\nنص\n\n# الخطوة الأولى\nنص";
  const m = buildModel({ title: "x", source: src, form: "article" });
  assert.deepEqual(m.sections.map((s) => s.title), ["المرحلة العادات الهدف", "الخطوة الأولى"]);
  const html = renderDocument(doc(src, "article", { title: "x" }));
  assert.ok(html.includes(">المرحلة العادات الهدف<") && html.includes(">الخطوة الأولى<"));
  assert.deepEqual(parseBlocks("المرحلة الأولى").map((b) => b.t), ["p"]);
});

test("reading time uses Arabic-Indic digits in RTL with the right plurals", () => {
  assert.equal(minutesLabel(1, "rtl"), "دقيقة واحدة");
  assert.equal(minutesLabel(2, "rtl"), "دقيقتان");
  assert.equal(minutesLabel(3, "rtl"), "٣ دقائق");
  assert.equal(minutesLabel(11, "rtl"), "١١ دقيقة");
  const html = renderDocument({ title: "ت", form: "article", source: "# أ\n" + "كلمة ".repeat(620) });
  assert.ok(html.includes("وقت القراءة: ٣ دقائق"));
});

test("empty blocks stay in the preview so a new line can be typed into", () => {
  const flat = sourceToBlocks("فقرة");
  flat.push({ id: 999, t: "p", text: "", level: 1 });
  const html = renderDocument({ title: "t", source: "فقرة", form: "article", blocks: flat });
  assert.ok(html.includes('data-block-id="999"'));
});
