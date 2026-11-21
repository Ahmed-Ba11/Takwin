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
  const { lead, sections } = toSections(blocks);
  const dir = direction(title + state.source);
  return { title, blocks, lead, sections, dir, form: state.form, minutes: readingMinutes(state.source) };
}

const e = escapeHTML;
const multi = (s) => e(s).replace(/\n/g, "<br>");

function blockHTML(b, o = {}) {
  const pieces = (txt) => (o.pdf ? splitText(txt, 650) : [txt]);
  switch (b.t) {
    case "p":
      return pieces(b.text).map((x, i) => `<p class="${i ? "cont" : ""}" dir="auto">${multi(x)}</p>`);
    case "quote":
      return [`<blockquote dir="auto">${multi(b.text)}</blockquote>`];
    case "stat":
      return [
        `<div class="stat"><b dir="ltr">${e(b.value)}</b><span dir="auto">${e(b.label)}</span></div>`,
      ];
    case "ul":
    case "ol": {
      const size = o.pdf ? 7 : b.items.length;
      const out = [];
      for (let i = 0; i < b.items.length; i += size) {
        const part = b.items.slice(i, i + size);
        out.push(
          `<${b.t} class="${i ? "cont" : ""}"${b.t === "ol" && i ? `` : ""}>${part
            .map((x, j) => `<li dir="auto">${b.t === "ol" ? `<span class="n">${i + j + 1}.</span>` : ""}${multi(x)}</li>`)
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
  if (intro)
    units.push(`<div class="intro">${blockHTML(intro, o).join("")}</div>`);
  const stats = bs.filter((b) => b.t === "stat");
  if (stats.length)
    units.push(`<div class="stats">${stats.map((s) => blockHTML(s)[0]).join("")}</div>`);
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
    units.push(
      `<div class="takeaway"><h3 class="label">الخلاصة</h3>${blockHTML(takeaway, o).join("")}</div>`,
    );
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

/* ---------- Cards ---------- */
function cardHTML(c, i, o) {
  const num = `<span class="num">${String(i + 1).padStart(2, "0")}</span>`;
  const open = o.pdf;
  const detail = c.detail || "";
  if (c.stat)
    return `<article class="card stat-card">${num}${blockHTML(c.stat)[0]}</article>`;
  const body = detail
    ? `<div class="card-body"><div class="card-inner">${detail}</div></div>`
    : "";
  if (o.pdf || !detail)
    return `<article class="card ${open ? "open" : ""}">${num}<h3 dir="auto">${e(c.title)}</h3>${body}</article>`;
  return `<article class="card" data-open="false"><button class="card-head" type="button" aria-expanded="false">${num}<h3 dir="auto">${e(c.title)}</h3>${chevron}</button>${body}</article>`;
}
export function toCards(m) {
  const cards = [];
  if (m.sections.length) {
    for (const s of m.sections)
      cards.push({ title: s.title, detail: blocksHTML(s.blocks, { pdf: false }).join("") });
  } else {
    for (const b of m.blocks) {
      if (b.t === "ul" || b.t === "ol") {
        for (const it of b.items) {
          const { title, detail } = splitTitle(it);
          cards.push({ title, detail: detail ? `<p dir="auto">${multi(detail)}</p>` : "" });
        }
      } else if (b.t === "stat") cards.push({ stat: b });
      else if (b.t === "quote")
        cards.push({ title: b.text, detail: "" });
      else {
        const { title, detail } = splitTitle(b.text);
        cards.push({ title, detail: detail ? `<p dir="auto">${multi(detail)}</p>` : "" });
      }
    }
  }
  return cards;
}

/* ---------- Article ---------- */
const slug = (i) => `sec-${i + 1}`;
function articleStatic(m, o) {
  const units = [];
  if (m.sections.length) {
    units.push(
      `<nav class="toc"><h3 class="label">المحتويات</h3><ol>${m.sections
        .map((s, i) => `<li class="lv${s.level}"><a href="#${slug(i)}"><span class="n">${i + 1}.</span>${e(s.title)}</a></li>`)
        .join("")}</ol></nav>`,
    );
  }
  return units;
}

function articleSections(m, o) {
  const out = [];
  if (m.lead.length) out.push({ units: blocksHTML(m.lead, o), lead: true });
  m.sections.forEach((s, i) => {
    const parts = blocksHTML(s.blocks, o);
    out.push({ id: slug(i), title: s.title, level: s.level, units: parts });
  });
  return out;
}

/** Screen HTML (interactive). */
export function renderDocument(state) {
  const m = buildModel(state);
  if (!m.title && !m.blocks.length) return "";
  const o = { pdf: false };
  let body = "";
  if (m.form === "summary") {
    body = `<div class="units summary-units">${summaryUnits(m, o).join("")}</div>`;
  } else if (m.form === "cards") {
    const lead = m.lead.length ? `<div class="lead">${blocksHTML(m.lead, o).join("")}</div>` : "";
    body = `${lead}<div class="units cards-units">${toCards(m)
      .map((c, i) => cardHTML(c, i, o))
      .join("")}</div>`;
  } else {
    const secs = articleSections(m, o);
    const toc = m.sections.length
      ? `<nav class="toc" aria-label="المحتويات"><h3 class="label">المحتويات</h3><ol>${m.sections
          .map((s, i) => `<li class="lv${s.level}"><a href="#${slug(i)}" data-goto="${slug(i)}"><span class="n">${i + 1}.</span>${e(s.title)}</a></li>`)
          .join("")}</ol></nav>`
      : "";
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
  const o = { pdf: true };
  let units = [];
  if (m.form === "summary") units = summaryUnits(m, o);
  else if (m.form === "cards") {
    if (m.lead.length) units.push(...blocksHTML(m.lead, o).map((x) => `<div class="lead">${x}</div>`));
    units.push(...toCards(m).map((c, i) => cardHTML(c, i, o)));
  } else {
    units.push(...articleStatic(m, o));
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
  };
}
