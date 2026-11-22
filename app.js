import { renderDocument, examples, sanitizeState, countWords, forms, buildModel, toFlashcards } from "./core.js";
import { createEditor } from "./editor.js";
import { openStudy } from "./study.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = "takween-v5";
const PREV = "takween-v5-prev";
const hasText = (s) => !!(s && (s.source.trim() || s.title.trim()));
const readPrev = () => {
  try {
    const p = sanitizeState(JSON.parse(localStorage.getItem(PREV)));
    return hasText(p) && !p.example ? p : null;
  } catch {
    return null;
  }
};
const writePrev = (p) => {
  try {
    if (p) localStorage.setItem(PREV, JSON.stringify(p));
    else localStorage.removeItem(PREV);
  } catch {}
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let state = sanitizeState(null);
try {
  state = sanitizeState(JSON.parse(localStorage.getItem(KEY)));
} catch {}

const el = {
  title: $("#title"),
  preview: $("#preview"),
  count: $("#count"),
  status: $("#save-status"),
  toast: $("#toast"),
  workspace: $(".workspace"),
};

/* ---------- Documents: new, previous, example ---------- */
let pending = null; // set by "start writing" / "see an example" clicks
const blank = () => sanitizeState({ form: state.form, theme: state.theme, motion: state.motion });
function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
function stashDraft() {
  if (hasText(state) && !state.example) writePrev(state);
}
function applyDoc(focus) {
  editor.setSource(state.source);
  lastHTML = null;
  syncControls();
  syncDocUI();
  render({ enter: true });
  if (focus) editor.focus();
}
function newDoc() {
  stashDraft();
  state = blank();
  saveNow();
  applyDoc(true);
}
function openExample(name) {
  const ex = examples[name];
  stashDraft();
  state = sanitizeState({ ...ex, theme: state.theme, motion: state.motion, example: name });
  saveNow();
  applyDoc(false);
}
function syncDocUI() {
  $("#example-banner").hidden = !state.example;
  $("#resume").hidden = !readPrev();
  $("#try-row").hidden = !!state.example || hasText(state);
}
$("#resume").addEventListener("click", () => {
  const prev = readPrev();
  if (!prev) return;
  stashDraft();
  if (!hasText(state) || state.example) writePrev(null);
  state = prev;
  saveNow();
  applyDoc(false);
});
$("#ex-own").addEventListener("click", () => {
  state = blank();
  saveNow();
  applyDoc(true);
});
$("#ex-copy").addEventListener("click", () => {
  state.example = null;
  saveNow();
  syncDocUI();
  toast("صار المثال مسودتك. يمكنك تعديله.");
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-new]")) pending = "new";
  else if (e.target.closest("[data-home-example]")) {
    pending = "summary";
    if (location.hash === "#write") route();
    else location.hash = "#write";
  }
});

/* ---------- Views ---------- */
function route() {
  const write = location.hash === "#write";
  $("#home").hidden = write;
  $("#write").hidden = !write;
  $("#back").hidden = !write;
  document.title = write ? "الكتابة — تكوين" : "تكوين — نصّك بشكل مرتّب";
  if (write) {
    if (pending === "new") newDoc();
    else if (pending) openExample(pending);
    pending = null;
    syncDocUI();
    render({ enter: true });
  } else window.scrollTo(0, 0);
  syncSeg($("#form-switch"));
  syncSeg($(".demo-tabs"));
}
addEventListener("hashchange", route);

/* ---------- Helpers ---------- */
const motionOn = () => state.motion && !reduced.matches;
function syncSeg(seg) {
  if (!seg) return;
  const i = [...seg.children].findIndex((b) => b.getAttribute("aria-checked") === "true" || b.getAttribute("aria-selected") === "true");
  seg.style.setProperty("--i", Math.max(0, i));
}
function setTheme(node) {
  node.className = node.className.replace(/\btheme-\w+/g, "").trim() + ` theme-${state.theme}`;
}
function setOpen(node, open) {
  node.dataset.open = String(open);
  node.querySelector("button[aria-expanded]")?.setAttribute("aria-expanded", String(open));
}
function flip(f) {
  const card = f.closest(".fc");
  const on = !card.classList.contains("flipped");
  card.classList.toggle("flipped", on);
  f.setAttribute("aria-pressed", String(on));
  f.querySelector(".fc-back")?.setAttribute("aria-hidden", String(!on));
  f.querySelector(".fc-front")?.setAttribute("aria-hidden", String(on));
}
document.addEventListener("click", (e) => {
  const f = e.target.closest(".fc-in");
  if (f) flip(f);
});
document.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && e.target.classList?.contains("fc-in")) {
    e.preventDefault();
    flip(e.target);
  }
});

/* ---------- Rendering ---------- */
function emptyState() {
  return `<div class="empty"><h2>ابدأ بكتابة نصّك</h2><p>اكتب في الحقل وسترى النتيجة هنا.</p></div>`;
}
let lastHTML = "";
let prevUnits = [];
let io;
function render({ enter = false, switching = false } = {}) {
  setTheme(el.preview);
  document.body.classList.toggle("motion-off", !motionOn());
  const html = state.source.trim() || state.title.trim() ? renderDocument(state) : "";
  if (html === lastHTML && !enter && !switching) return;
  lastHTML = html;
  const keep = switching
    ? { cards: [], secs: [], flips: [] }
    : {
        secs: $$(".sec", el.preview).map((c) => c.dataset.open),
        flips: $$(".fc", el.preview).map((c) => c.classList.contains("flipped")),
      };
  el.preview.classList.remove("enter", "switching");
  el.preview.innerHTML = html || emptyState();
  io?.disconnect();
  if (html) {
    const units = $$(".units > *", el.preview);
    units.forEach((n, i) => n.style.setProperty("--i", Math.min(i, 10)));
    el.preview.classList.add("instant");
    $$(".sec", el.preview).forEach((c, i) => keep.secs[i] && setOpen(c, keep.secs[i] === "true"));
    $$(".fc", el.preview).forEach((c, i) => keep.flips[i] && flip(c.querySelector(".fc-in")));
    requestAnimationFrame(() => requestAnimationFrame(() => el.preview.classList.remove("instant")));
    if ($(".sec", el.preview) && !$(".doc-tools", el.preview))
      $(".document", el.preview).insertAdjacentHTML(
        "afterbegin",
        '<div class="doc-tools"><button type="button" data-toggle-all>طيّ الكل</button></div>',
      );
    syncToggleLabel();
    // Live typing: only units that changed pop in.
    const now = units.map((n) => n.outerHTML.replace(/ style="[^"]*"/, ""));
    if (motionOn() && !enter && !switching)
      units.forEach((n, i) => {
        if (prevUnits[i] !== now[i]) {
          n.classList.add("pop");
          n.addEventListener("animationend", () => n.classList.remove("pop"), { once: true });
        }
      });
    prevUnits = now;
    setupReveal();
  } else prevUnits = [];
  if (motionOn() && (enter || switching)) el.preview.classList.add(switching ? "switching" : "enter");
}
function setupReveal() {
  if (!motionOn() || !("IntersectionObserver" in window)) return;
  const items = $$(".article-units > .sec, .article-units > .lead", el.preview);
  if (!items.length) return;
  el.preview.classList.add("has-io");
  io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && (en.target.classList.add("in"), io.unobserve(en.target))),
    { threshold: 0.05 },
  );
  items.forEach((n) => {
    n.classList.add("reveal");
    io.observe(n);
  });
}
function syncToggleLabel() {
  const b = $("[data-toggle-all]", el.preview);
  if (!b) return;
  const all = $$(".sec", el.preview);
  b.textContent = all.every((c) => c.dataset.open === "true") ? "طيّ الكل" : "فتح الكل";
}

// Example buttons live in both the editor (try-row) and the preview empty state.
document.addEventListener("click", (e) => {
  const ex = e.target.closest("[data-example]");
  if (ex) loadExample(ex.dataset.example);
});
el.preview.addEventListener("click", (e) => {
  if (e.target.closest("[data-example]")) return;
  if (e.target.closest("[data-study]")) return startStudy();
  if (e.target.closest("[data-toggle-all]")) {
    const all = $$(".sec", el.preview);
    const open = !all.every((c) => c.dataset.open === "true");
    all.forEach((c) => setOpen(c, open));
    return syncToggleLabel();
  }
  const head = e.target.closest(".sec-head");
  if (head) {
    const box = head.closest(".sec");
    setOpen(box, box.dataset.open !== "true");
    return syncToggleLabel();
  }
  const go = e.target.closest("[data-goto]");
  if (go) {
    e.preventDefault();
    const sec = document.getElementById(go.dataset.goto);
    if (!sec) return;
    setOpen(sec, true);
    sec.classList.add("in");
    sec.scrollIntoView({ behavior: motionOn() ? "smooth" : "auto", block: "start" });
  }
});

function startStudy() {
  const m = buildModel(state);
  const cards = toFlashcards(m);
  if (!cards.length) return toast("أضف نصًّا أولًا لتبدأ المراجعة.");
  openStudy($("#study"), cards, { theme: state.theme, dir: m.dir });
}

/* ---------- State + autosave ---------- */
let saveTimer, renderTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      el.status.textContent = "تم الحفظ على جهازك";
    } catch {
      el.status.textContent = "تعذّر الحفظ على الجهاز";
    }
  }, 400);
}
function changed() {
  const words = countWords(state.source);
  el.count.textContent = words ? `${words} كلمة` : "";
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
  syncDocUI();
  save();
}
const editor = createEditor($("#blocks"), {
  onChange: (src) => {
    state.source = src;
    changed();
  },
  menu: $("#typemenu"),
  mini: $("#mini"),
  typebar: $("#typebar"),
});
el.title.addEventListener("input", () => ((state.title = el.title.value), changed()));

function syncControls() {
  el.title.value = state.title;
  $$("#form-switch [data-form]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.form === state.form)));
  $$("[data-theme]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.theme === state.theme)));
  $("#motion").checked = state.motion;
  const w = countWords(state.source);
  el.count.textContent = w ? `${w} كلمة` : "";
  syncSeg($("#form-switch"));
}

function switchRender() {
  const go = () => render({ switching: true });
  if (motionOn() && document.startViewTransition) document.startViewTransition(go);
  else go();
}
$("#form-switch").addEventListener("click", (e) => {
  const b = e.target.closest("[data-form]");
  if (!b || b.dataset.form === state.form) return;
  state.form = b.dataset.form;
  syncControls();
  switchRender();
  save();
});
$("#look").addEventListener("click", (e) => {
  const b = e.target.closest("[data-theme]");
  if (!b) return;
  state.theme = b.dataset.theme;
  syncControls();
  render();
  save();
});
$("#motion").addEventListener("change", (e) => {
  state.motion = e.target.checked;
  render();
  save();
});
document.addEventListener("click", (e) => {
  const look = $("#look");
  if (look.open && !look.contains(e.target)) look.open = false;
});

/* ---------- Editor actions ---------- */
function loadExample(name) {
  openExample(name);
  if (innerWidth <= 900) setPanel("preview");
}
$("#undo").addEventListener("click", () => editor.undo());
const proposal = $("#proposal");
$("#arrange").addEventListener("click", () => {
  if (editor.isEmpty()) return toast("ألصق نصًّا أولًا ثم اضغط «ترتيب سريع».");
  const n = editor.arrange();
  if (!n) return toast("لا توجد اقتراحات: كل سطر له نوع مناسب.");
  $("#proposal-text").textContent = `اقتُرح نوع لـ${n} من الأسطر. راجعها ثم اضغط «قبول».`;
  proposal.hidden = false;
});
$("#proposal-ok").addEventListener("click", () => {
  editor.clearProposal();
  proposal.hidden = true;
});
$("#proposal-undo").addEventListener("click", () => {
  editor.undo();
  editor.clearProposal();
  proposal.hidden = true;
});

/* ---------- Mobile panels ---------- */
function setPanel(p) {
  el.workspace.dataset.panel = p;
  $$(".mobile-tabs [data-panel]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.panel === p)));
  if (p === "preview") render();
}
$(".mobile-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-panel]");
  if (b) setPanel(b.dataset.panel);
});

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg, ms = 4200) {
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), ms);
}

/* ---------- PDF ---------- */
let exporting = false;
async function savePdf() {
  if (exporting) return;
  if (!state.source.trim() && !state.title.trim()) return toast("اكتب نصًّا أولًا ثم احفظه.");
  exporting = true;
  const btns = [$("#pdf"), $("#pdf-mobile")];
  btns.forEach((b) => (b.disabled = true));
  try {
    const { buildPdf, deliver } = await import("./pdf.js");
    const result = await buildPdf(state, (done, total) => {
      btns.forEach((b) => (b.textContent = `جارٍ التجهيز… ${done}/${total}`));
    });
    const how = await deliver(result);
    toast(how === "shared" ? "تم تجهيز الملف." : "تم حفظ الملف PDF.");
  } catch (err) {
    console.error(err);
    toast("تعذّر إنشاء الملف. حاول مرة أخرى.");
  } finally {
    exporting = false;
    btns.forEach((b) => {
      b.disabled = false;
      b.textContent = "حفظ PDF";
    });
  }
}
$("#pdf").addEventListener("click", savePdf);
$("#pdf-mobile").addEventListener("click", savePdf);
window.__takween = {
  get state() {
    return state;
  },
  editor,
  savePdf,
};

/* ---------- Home demo ---------- */
const demo = $("#demo-preview");
let demoForm = "summary";
let demoTimer;
function showDemo(form, animate = true) {
  demoForm = form;
  $$("[data-demo]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.demo === form)));
  syncSeg($(".demo-tabs"));
  const paint = () => {
    demo.className = "preview theme-mist demo-preview";
    demo.innerHTML = renderDocument({ ...examples.article, form, theme: "mist" });
    $$(".units > *", demo).forEach((n, i) => n.style.setProperty("--i", Math.min(i, 8)));
    if (animate && !reduced.matches) demo.classList.add("enter");
  };
  paint();
}
$(".demo-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-demo]");
  if (!b) return;
  clearInterval(demoTimer);
  showDemo(b.dataset.demo);
});
const order = Object.keys(forms);
function startDemo() {
  if (reduced.matches) return;
  demoTimer = setInterval(() => {
    if (location.hash === "#write" || document.hidden) return;
    showDemo(order[(order.indexOf(demoForm) + 1) % 3]);
  }, 5500);
}
showDemo("summary", false);
startDemo();

editor.setSource(state.source);
syncControls();
route();
