import test from "node:test";
import assert from "node:assert/strict";
import { localDigits, latinDigits, renderDocument } from "../core.js";

test("decimal and thousands separators, ranges and mixed lines", () => {
  assert.equal(localDigits("1.2", "rtl"), "١٫٢");
  assert.equal(localDigits("1,200", "rtl"), "١٬٢٠٠");
  assert.equal(localDigits("3-5", "rtl"), "٣-٥");
  assert.equal(localDigits("نهاية.", "rtl"), "نهاية."); // a plain full stop is untouched
  assert.equal(localDigits("1.2 and 3,4", "ltr"), "1.2 and 3,4");
  assert.equal(latinDigits("٧٠٪ ١٫٢ ١٬٢٠٠"), "70% 1.2 1,200");
  const html = renderDocument({ title: "ت", form: "summary", source: "3.5% نمو\n\nكتب Stephen R. Covey عام 1989" });
  assert.ok(html.includes("٣٫٥٪"));
  assert.ok(html.includes("<bdi>Stephen R. Covey</bdi>"));
});

test("step markers are plain logical text in RTL (number then dot), with no forced LTR", () => {
  const html = renderDocument({ title: "ت", form: "article", source: "# قسم\n1. أولى\n2. ثانية\n3. ثالثة" });
  assert.ok(html.includes('<span class="n">١.</span>') && html.includes('<span class="n">٢.</span>') && html.includes('<span class="n">٣.</span>'));
  assert.ok(!html.includes('dir="ltr"'));
});

test("English documents keep Western digits and no bdi", () => {
  const html = renderDocument({ title: "Report", form: "article", source: "# Intro\n1. one\n2. two\n\n85% done" });
  assert.ok(html.includes('<span class="n">1.</span>') && html.includes("85%") && !html.includes("<bdi>"));
});
