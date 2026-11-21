import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBlocks, buildModel, renderDocument, renderPdfModel, splitText,
  splitTitle, readingMinutes, minutesLabel, fileName, examples, sanitizeState, escapeHTML,
  toFlashcards, localDigits,
} from "../core.js";
import { sourceToBlocks, blocksToSource, detectShortcut, suggest, arrange, newBlock } from "../blocks.js";

const words = (s) => s.replace(/[#>*•\-–]|[0-9٠-٩]+[.)]/g, " ").split(/\s+/).filter(Boolean);
const latin = (s) => s.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٪/g, "%");
const textOf = (html) => latin(html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " "));

test("markup becomes the right blocks", () => {
  const b = parseBlocks("# عنوان\nفقرة أولى\nسطر ثانٍ\n\n- أ\n- ب\n\n1. خطوة\n2) خطوة ثانية\n\n> اقتباس\n\n85% من المستخدمين\n\n«نص مقتبس»");
  assert.deepEqual(b.map((x) => x.t), ["h", "p", "ul", "ol", "quote", "stat", "quote"]);
  assert.equal(b[1].text, "فقرة أولى\nسطر ثانٍ");
  assert.equal(b[3].items.length, 2);
  assert.equal(b[5].value, "85%");
  assert.equal(b[5].label, "من المستخدمين");
});

test("Arabic-Indic digits and plain numbers", () => {
  assert.equal(parseBlocks("٣٠٪ زيادة")[0].t, "stat");
  assert.equal(parseBlocks("٣. خطوة")[0].t, "ol");
  assert.equal(parseBlocks("3.5 مليون ريال")[0].value, "3.5");
});

test("splitText is lossless", () => {
  const t = "كلمة ".repeat(500) + "😀".repeat(50);
  assert.equal(splitText(t, 100).join(""), t);
});

test("every form keeps every word of a long text", () => {
  const src = Object.values(examples).map((x) => x.source).join("\n\n") + "\n\nSTART_X " + "جملة طويلة جدًا. ".repeat(300) + " END_X";
  for (const form of ["summary", "cards", "article"]) {
    const state = { title: "عنوان", source: src, form };
    const screen = textOf(renderDocument(state));
    const pdf = renderPdfModel(state);
    const pdfText = textOf(pdf.units.join(" "));
    for (const w of ["START_X", "END_X", "المحتوى", "الخلاصة"]) {
      assert.ok(screen.includes(w), `${form} screen has ${w}`);
      assert.ok(pdfText.includes(w) || form === "x", `${form} pdf has ${w}`);
    }
    const want = new Set(words(src));
    const have = new Set(words(pdfText));
    for (const w of want) if (!have.has(w) && !/^[«»“”"]/.test(w)) assert.ok(have.has(w), `${form}: lost "${w}"`);
  }
});

test("pdf has no interactive controls and cards are open", () => {
  const p = renderPdfModel({ ...examples.cards, form: "cards" });
  const html = p.units.join("");
  assert.ok(!html.includes("<button"));
  assert.ok(html.includes("fc-print"));
  assert.ok(!renderPdfModel({ ...examples.article }).units.join("").includes("<button"));
});

test("screen cards and sections are interactive", () => {
  assert.ok(renderDocument(examples.cards).includes('aria-pressed="false"'));
  const a = renderDocument(examples.article);
  assert.ok(a.includes('class="toc"') && a.includes("data-goto"));
});

test("article reads title from first # heading and shows reading time", () => {
  const m = buildModel({ title: "", source: "# عنوان المقال\nنص", form: "article" });
  assert.equal(m.title, "عنوان المقال");
  assert.ok(renderDocument({ title: "", source: "# ت\nنص", form: "article" }).includes("وقت القراءة"));
});

test("reading time labels", () => {
  assert.equal(readingMinutes("كلمة ".repeat(1000)), 5);
  assert.equal(minutesLabel(1), "دقيقة واحدة");
  assert.equal(minutesLabel(2), "دقيقتان");
  assert.equal(minutesLabel(5), "5 دقائق");
  assert.equal(minutesLabel(12), "12 دقيقة");
});

test("no slides remain and html is escaped", () => {
  const html = renderDocument({ title: "<img onerror=x>", source: "<script>alert(1)</script>", form: "cards" });
  assert.ok(!html.includes("<script>") && !html.includes("<img"));
  assert.ok(!/slide|TAKWEEN/i.test(renderDocument(examples.summary)));
  assert.equal(escapeHTML("<&>"), "&lt;&amp;&gt;");
});

test("splitTitle, fileName, sanitizeState", () => {
  assert.deepEqual(splitTitle("العنوان: التفصيل"), { title: "العنوان", detail: "التفصيل" });
  assert.equal(splitTitle("قصيرة").detail, "");
  assert.equal(fileName('a/b:"c"'), "a b c.pdf");
  assert.equal(fileName(""), "تكوين.pdf");
  assert.equal(sanitizeState({ form: "slides" }).form, "summary");
});

test("empty input renders nothing", () => {
  assert.equal(renderDocument({ title: "", source: "", form: "cards" }), "");
});

