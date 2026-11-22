// Takween core: rule-based, local parser and renderers. No AI, no network.
export const forms = {
  summary: "ملخّص",
  cards: "بطاقات",
  article: "مقال",
};
export const themes = { mist: "ضباب", sand: "رمل", olive: "زيتون" };

export const escapeHTML = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export function direction(text) {
  return /[؀-ۿ]/.test(text) ? "rtl" : /[A-Za-z]/.test(text) ? "ltr" : "rtl";
}

const DIG = "0-9٠-٩";
const reHeading = /^\s{0,3}(#{1,3})\s*(.*\S)\s*$/;
const reUl = /^\s*[-*•–]\s+(.*\S)\s*$/;
const reOl = new RegExp(`^\\s*[${DIG}]+\\s*[.)\\-ـ]\\s+(.*\\S)\\s*$`);
const reQuote = /^\s*>\s?(.*)$/;
const reWrapped = /^\s*([«“"].*[»”"])\s*$/;
const reFront = /^\s*\?\?\s+(.*\S)\s*$/;
const reBack = /^\s*!!\s+(.*\S)\s*$/;
const reStat = new RegExp(
  `^\\s*([+\\-−]?[${DIG}]+(?:[.,٫٬][${DIG}]+)*\\s?[%٪]?)\\s+(\\S.*?)\\s*$`,
);

// Splits text at word boundaries, keeping every original character.
export function splitText(text, budget = 700) {
  const out = [];
  let rest = text;
  while (rest.length > budget) {
    let end = rest.lastIndexOf(" ", budget);
    if (end < budget / 2) end = budget;
    if (end > 0 && /[\uD800-\uDBFF]/.test(rest[end - 1])) end--;
    out.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  if (rest) out.push(rest);
  return out;
}

/** Text -> flat list of blocks. Every input line ends up in exactly one block. */
export function parseBlocks(source) {
  const blocks = [];
  let para = null;
  let list = null;
  let quote = null;
  const flush = () => {
    if (para) blocks.push({ t: "p", text: para.join("\n") });
    if (list) blocks.push(list);
    if (quote) blocks.push({ t: "quote", text: quote.join("\n") });
    para = list = quote = null;
  };
  for (const line of String(source || "").replace(/\r/g, "").split("\n")) {
    if (!line.trim()) {
      flush();
      continue;
    }
    let m;
    if ((m = line.match(reHeading))) {
      flush();
      blocks.push({ t: "h", level: m[1].length, text: m[2] });
    } else if ((m = line.match(reFront))) {
      flush();
      blocks.push({ t: "front", text: m[1] });
    } else if ((m = line.match(reBack))) {
      flush();
      blocks.push({ t: "back", text: m[1] });
    } else if ((m = line.match(reUl))) {
      if (!list || list.t !== "ul") {
        flush();
        list = { t: "ul", items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(reOl))) {
      if (!list || list.t !== "ol") {
        flush();
        list = { t: "ol", items: [] };
      }
      list.items.push(m[1]);
    } else if ((m = line.match(reQuote))) {
      if (!quote) {
        flush();
        quote = [];
      }
      quote.push(m[1]);
    } else if ((m = line.match(reWrapped)) && !para) {
      flush();
      blocks.push({ t: "quote", text: m[1] });
    } else if ((m = line.match(reStat)) && line.trim().length <= 140) {
      flush();
      blocks.push({ t: "stat", value: m[1].trim(), label: m[2] });
    } else {
      if (!para) {
        flush();
        para = [];
      }
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export const plainText = (b) =>
  b.t === "ul" || b.t === "ol"
    ? b.items.join(" ")
    : b.t === "stat"
      ? `${b.value} ${b.label}`
      : b.text;

export function countWords(source) {
  return (String(source || "").match(/[\p{L}\p{N}]+/gu) || []).length;
}
export function readingMinutes(source) {
  return Math.max(1, Math.round(countWords(source) / 200));
}
export function minutesLabel(n) {
  return n === 1 ? "دقيقة واحدة" : n === 2 ? "دقيقتان" : n <= 10 ? `${n} دقائق` : `${n} دقيقة`;
}

/** Splits blocks into the lead (before first heading) and heading sections. */
export function toSections(blocks) {
  const lead = [];
  const sections = [];
  for (const b of blocks) {
    if (b.t === "h") sections.push({ level: b.level, title: b.text, blocks: [] });
    else (sections.at(-1)?.blocks ?? lead).push(b);
  }
  return { lead, sections };
}

/** Splits an item into a short card title and optional detail. Lossless. */
export function splitTitle(text) {
  const t = text.trim();
  let m = t.match(/^([^\n:：]{2,60}?)\s*[:：]\s+([\s\S]+)$/);
  if (m) return { title: m[1], detail: m[2] };
  m = t.match(/^([^\n]{2,60}?)\s+[—–]\s+([\s\S]+)$/);
  if (m) return { title: m[1], detail: m[2] };
  m = t.match(/^([^\n]{8,110}?[.!؟?。])\s+([\s\S]+)$/);
  if (m) return { title: m[1], detail: m[2] };
  if (t.length <= 110 && !t.includes("\n")) return { title: t, detail: "" };
  const words = t.split(/\s+/);
  return { title: words.slice(0, 8).join(" ") + "…", detail: t };
}

/** Normalises state into a model every form renders from. */
export function buildModel(state) {
  let blocks = parseBlocks(state.source);
  let title = (state.title || "").trim();
  if (!title && blocks[0]?.t === "h" && blocks[0].level === 1) {
    title = blocks[0].text;
    blocks = blocks.slice(1);
  }
  const all = blocks;
  if (state.form !== "cards")
    blocks = blocks.map((b) =>
      b.t === "front" ? { t: "h", level: 2, text: b.text } : b.t === "back" ? { t: "p", text: b.text } : b,
    );
  const { lead, sections } = toSections(blocks);
  const dir = direction(title + state.source);
  return { title, blocks, all, lead, sections, dir, form: state.form, minutes: readingMinutes(state.source) };
}

const e = escapeHTML;
const multi = (s) => e(s).replace(/\n/g, "<br>");

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** Arabic-Indic digits and ٪ inside Arabic documents; unchanged otherwise. */
export const localDigits = (s, dir = "rtl") =>
  dir === "rtl"
    ? String(s).replace(/[0-9]/g, (d) => AR_DIGITS[d]).replace(/%/g, "٪")
    : String(s);

function blockHTML(b, o = {}) {
  const pieces = (txt) => (o.pdf ? splitText(txt, 650) : [txt]);
  switch (b.t) {
    case "p":
    case "front":
    case "back":
      return pieces(b.text).map((x, i) => `<p class="${i ? "cont" : ""}" dir="auto">${multi(x)}</p>`);
    case "quote":
      return [`<blockquote dir="auto">${multi(b.text)}</blockquote>`];
    case "stat":
      return [
        `<div class="stat"><b dir="ltr">${e(localDigits(b.value, o.dir))}</b><span dir="auto">${e(b.label)}</span></div>`,
      ];
    case "ul":
    case "ol": {
      const size = o.pdf ? 7 : b.items.length;
      const out = [];
      for (let i = 0; i < b.items.length; i += size) {
        const part = b.items.slice(i, i + size);
        out.push(
          `<${b.t} class="${i ? "cont" : ""}">${part
            .map(
              (x, j) =>
                `<li dir="auto">${b.t === "ol" ? `<span class="n">${localDigits(i + j + 1, o.dir)}</span>` : ""}${multi(x)}</li>`,
            )
            .join("")}</${b.t}>`,
        );
      }
      return out;
    }
    case "h":
      return [`<h4 class="sub" dir="auto">${e(b.text)}</h4>`];
  }
  return [];
}
const blocksHTML = (bs, o) => bs.flatMap((b) => blockHTML(b, o));

function headHTML(m) {
  const meta =
    m.form === "article" ? `<p class="meta">وقت القراءة: ${minutesLabel(m.minutes)}</p>` : "";
  return m.title || meta
    ? `<header class="doc-head">${m.title ? `<h2 dir="auto">${e(m.title)}</h2>` : ""}${meta}</header>`
    : "";
}

const chevron = '<i class="chev" aria-hidden="true"></i>';

/* ---------- Summary ---------- */
function summaryUnits(m, o) {
  const bs = [...m.blocks];
  const units = [];
  let intro = null;
  if (bs[0]?.t === "p") intro = bs.shift();
  let takeaway = null;
  if (bs.length > 2 && ["p", "quote"].includes(bs.at(-1).t)) takeaway = bs.pop();
  if (intro) units.push(`<div class="intro">${blockHTML(intro, o).join("")}</div>`);
  const stats = bs.filter((b) => b.t === "stat");
  if (stats.length) units.push(`<div class="stats">${stats.map((s) => blockHTML(s, o)[0]).join("")}</div>`);
  const rest = bs.filter((b) => b.t !== "stat");
  if (rest.length) {
    let first = true;
    for (const b of rest) {
      if (first && b.t !== "h") units.push('<h3 class="label">النقاط الرئيسة</h3>');
      first = false;
      if (b.t === "ul" || b.t === "ol") {
        const size = o.pdf ? 7 : b.items.length;
        for (let i = 0; i < b.items.length; i += size)
          units.push(
            `<ul class="points">${b.items
              .slice(i, i + size)
              .map((x) => `<li dir="auto">${multi(x)}</li>`)
              .join("")}</ul>`,
          );
      } else if (b.t === "p") {
        units.push(
          ...blockHTML(b, o).map((x) => `<ul class="points"><li>${x.replace(/^<p[^>]*>|<\/p>$/g, "")}</li></ul>`),
        );
      } else units.push(...blockHTML(b, o));
    }
  }
  if (takeaway)
    units.push(`<div class="takeaway"><h3 class="label">الخلاصة</h3>${blockHTML(takeaway, o).join("")}</div>`);
  return keepWithNext(units);
}
// A heading or label never ends a page alone: it travels with the unit after it.
function keepWithNext(units) {
  const out = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (/^<h[34] class="(sub|label)"/.test(u) && units[i + 1] && !units[i + 1].startsWith("<h"))
      out.push(`<div class="keep">${u}${units[++i]}</div>`);
    else out.push(u);
  }
  return out;
}

/* ---------- Flashcards ---------- */
/**
 * Blocks -> [{ front, back (html), big }].
 * Heading or "وجه" block = front; following "ظهر" blocks (and, after a heading, any blocks) = back.
 * Other items split at ":" or "—" into front/back. Nothing is dropped.
 */
export function toFlashcards(m) {
  const dir = m.dir;
  const cards = [];
  const item = (text) => {
    const { title, detail } = splitTitle(text);
    cards.push({ front: title, back: detail ? `<p dir="auto">${multi(detail)}</p>` : "" });
  };
  let cur = null;
  for (const b of m.all) {
    if (b.t === "h" || b.t === "front") {
      cur = { front: b.text, parts: [], mode: b.t };
      cards.push(cur);
    } else if (b.t === "back" && cur) cur.parts.push(`<p dir="auto">${multi(b.text)}</p>`);
    else if (cur && cur.mode === "h") cur.parts.push(...blockHTML(b, { dir }));
    else {
      cur = null;
      if (b.t === "ul" || b.t === "ol") b.items.forEach(item);
      else if (b.t === "stat")
        cards.push({ front: localDigits(b.value, dir), back: `<p dir="auto">${e(b.label)}</p>`, big: true });
      else if (b.t === "quote") cards.push({ front: b.text, back: "" });
      else item(b.text);
    }
  }
  return cards.map((c) => ({ front: c.front, big: !!c.big, back: c.back ?? c.parts.join("") }));
}

function fcFront(c, i, dir) {
  const n = localDigits(String(i + 1).padStart(2, "0"), dir);
  return `<span class="num">${n}</span>${
    c.big ? `<b class="bigv" dir="ltr">${e(c.front)}</b>` : `<h3 dir="auto">${multi(c.front)}</h3>`
  }`;
}
function flashcardHTML(c, i, o) {
  if (o.pdf)
    return `<article class="card fc-print"><div class="fc-p-front">${fcFront(c, i, o.dir)}</div>${
      c.back ? `<div class="fc-p-back"><span class="side">الظهر</span>${c.back}</div>` : ""
    }</article>`;
  if (!c.back)
    return `<article class="fc static"><div class="fc-face fc-front">${fcFront(c, i, o.dir)}</div></article>`;
  const label = e(`بطاقة: ${c.front.slice(0, 80)}. اضغط لقلبها`);
  return `<article class="fc"><div class="fc-in" role="button" tabindex="0" aria-pressed="false" aria-label="${label}"><div class="fc-face fc-front">${fcFront(c, i, o.dir)}<span class="hint">اضغط للقلب</span></div><div class="fc-face fc-back" aria-hidden="true"><span class="side">الظهر</span>${c.back}</div></div></article>`;
}

/* ---------- Article ---------- */
const slug = (i) => `sec-${i + 1}`;
const tocHTML = (m, interactive) =>
  `<nav class="toc"${interactive ? ' aria-label="المحتويات"' : ""}><h3 class="label">المحتويات</h3><ol>${m.sections
    .map(
      (s, i) =>
        `<li class="lv${s.level}"><a href="#${slug(i)}"${interactive ? ` data-goto="${slug(i)}"` : ""}><span class="n">${localDigits(i + 1, m.dir)}</span>${e(s.title)}</a></li>`,
    )
    .join("")}</ol></nav>`;

function articleSections(m, o) {
  const out = [];
  if (m.lead.length) out.push({ units: blocksHTML(m.lead, o), lead: true });
  m.sections.forEach((s, i) => {
    out.push({ id: slug(i), title: s.title, level: s.level, units: blocksHTML(s.blocks, o) });
  });
  return out;
}

/** Screen HTML (interactive). */
export function renderDocument(state) {
  const m = buildModel(state);
  if (!m.title && !m.blocks.length) return "";
  const o = { pdf: false, dir: m.dir };
  let body = "";
  if (m.form === "summary") {
    body = `<div class="units summary-units">${summaryUnits(m, o).join("")}</div>`;
  } else if (m.form === "cards") {
    const cards = toFlashcards(m);
    body = `<div class="doc-tools"><button type="button" class="study-btn" data-study>وضع المراجعة</button></div><div class="units cards-units">${cards
      .map((c, i) => flashcardHTML(c, i, o))
      .join("")}</div>`;
  } else {
    const secs = articleSections(m, o);
    const toc = m.sections.length ? tocHTML(m, true) : "";
    body = `<div class="article-layout">${toc}<div class="units article-units">${secs
      .map((s) =>
        s.lead
          ? `<div class="lead">${s.units.join("")}</div>`
          : `<section class="sec" id="${s.id}" data-open="true"><button class="sec-head lv${s.level}" type="button" aria-expanded="true"><h3 dir="auto">${e(s.title)}</h3>${chevron}</button><div class="sec-body"><div class="sec-inner">${s.units.join("")}</div></div></section>`,
      )
      .join("")}</div></div>`;
  }
  return `<div class="document form-${m.form}" dir="${m.dir}">${headHTML(m)}${body}</div>`;
}

/** PDF model: header + non-splittable units, paginated by the exporter. */
export function renderPdfModel(state) {
  const m = buildModel(state);
  const o = { pdf: true, dir: m.dir };
  let units = [];
  if (m.form === "summary") units = summaryUnits(m, o);
  else if (m.form === "cards") units = toFlashcards(m).map((c, i) => flashcardHTML(c, i, o));
  else {
    if (m.sections.length) units.push(tocHTML(m, false));
    for (const s of articleSections(m, o)) {
      if (s.lead) {
        units.push(...s.units);
        continue;
      }
      const [first, ...more] = s.units;
      units.push(
        `<div class="sec-pdf"><h3 class="sec-title lv${s.level}" dir="auto">${e(s.title)}</h3>${first || ""}</div>`,
        ...more,
      );
    }
  }
  return { head: headHTML(m), units, form: m.form, dir: m.dir, title: m.title };
}

export function logoSVG(size = 24) {
  return `<svg class="logo-svg" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="4" width="30" height="22" rx="8" fill="#b2874d" fill-opacity=".9" transform="rotate(-8 24 15)"/><rect x="5" y="14" width="32" height="22" rx="8" fill="#ffffff" fill-opacity=".75" stroke="#203f36" stroke-opacity=".3"/><rect x="13" y="26" width="30" height="18" rx="7" fill="#203f36"/></svg>`;
}

export function fileName(title) {
  const clean = String(title || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return `${clean || "تكوين"}.pdf`;
}

export const examples = {
  summary: {
    title: "اجتماع الفريق الأسبوعي",
    form: "summary",
    source: `ناقش الفريق خطة الإطلاق وحدّد المهام المطلوبة قبل نهاية الشهر.

- اعتماد التصميم النهائي للصفحة الرئيسة
- تجهيز المحتوى بالعربية والإنجليزية
- مراجعة الأداء على الجوال
- تحديد موعد التجربة مع أول مجموعة مستخدمين

85% من المهام الأساسية اكتملت

> الأولوية هذا الأسبوع هي الجوال.

ننتظر موافقة الإدارة على الميزانية قبل البدء بالإعلان.`,
  },
  cards: {
    title: "خطوات تعلّم مهارة جديدة",
    form: "cards",
    source: `# اختر هدفًا صغيرًا
ابدأ بهدف واضح يمكن إنجازه في أسبوع، فالأهداف الكبيرة تُؤجَّل كثيرًا.

# تدرّب كل يوم
عشر دقائق يوميًا أفضل من ساعتين في نهاية الأسبوع. الانتظام هو ما يبني المهارة.

# اطلب رأي غيرك
شارك ما أنجزته مع شخص يفهم المجال، واسأله عمّا يمكن تحسينه.

# راجع ما تعلّمته
اكتب ثلاث نقاط عمّا تعلّمته هذا الأسبوع، ثم حدّد هدف الأسبوع القادم.`,
  },
  article: {
    title: "لماذا نكتب بخط اليد؟",
    form: "article",
    source: `الكتابة باليد عادة قديمة، لكنها ما زالت تعطي نتائج لا تعطيها لوحة المفاتيح.

# الذاكرة
عند الكتابة باليد نختصر ما نسمعه بكلماتنا، وهذا يجعل الفكرة أوضح في الذهن.

> ما نكتبه بأيدينا نتذكره أكثر مما نقرؤه.

# التركيز
الورقة لا ترسل تنبيهات ولا تفتح نوافذ جديدة، فيبقى الانتباه على الفكرة.

- ابدأ بدفتر صغير
- خصّص له وقتًا ثابتًا
- اكتب جملًا قصيرة

# متى تستخدم الحاسوب؟
عندما يكون النص طويلًا أو يحتاج إلى تعديل كثير، فالحاسوب أسرع وأنسب.

70% من الطلاب يفضّلون الجمع بين الطريقتين

# الخلاصة
لا تحتاج إلى التخلي عن أحد الأسلوبين. اختر ما يناسب المهمة.`,
  },
};

export function sanitizeState(d) {
  const o = d && typeof d === "object" ? d : {};
  return {
    title: String(o.title || ""),
    source: String(o.source || ""),
    form: Object.hasOwn(forms, o.form) ? o.form : "summary",
    theme: Object.hasOwn(themes, o.theme) ? o.theme : "mist",
    motion: o.motion !== false,
    example: Object.hasOwn(examples, o.example) ? o.example : null,
    libId: typeof o.libId === "string" && o.libId ? o.libId : null,
  };
}

export { reStat, reHeading, reUl, reOl, reQuote, reWrapped, reFront, reBack };
