import { renderDocument, examples, sanitizeState, countWords, forms } from "./core.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = "takween-v5";
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

let state = sanitizeState(null);
try {
  state = sanitizeState(JSON.parse(localStorage.getItem(KEY)));
} catch {}

const el = {
  title: $("#title"),
  source: $("#source"),
  preview: $("#preview"),
  count: $("#count"),
  status: $("#save-status"),
  toast: $("#toast"),
  workspace: $(".workspace"),
};

/* ---------- Views ---------- */
function route() {
  const write = location.hash === "#write";
  $("#home").hidden = write;
  $("#write").hidden = !write;
  if (write) render({ enter: true });
  else window.scrollTo(0, 0);
}
addEventListener("hashchange", route);

/* ---------- Rendering ---------- */
const motionOn = () => state.motion && !reduced.matches;
function setTheme(node) {
  node.className = node.className.replace(/\btheme-\w+/g, "").trim() + ` theme-${state.theme}`;
}
function emptyState() {
  return `<div class="empty"><h2>ابدأ بكتابة نصّك</h2><p>اكتب في الحقل، أو جرّب أحد الأمثلة.</p><div class="empty-actions"><button data-example="summary">مثال ملخّص</button><button data-example="cards">مثال بطاقات</button><button data-example="article">مثال مقال</button></div></div>`;
}
function openState() {
  return {
    cards: $$(".card[data-open]", el.preview).map((c) => c.dataset.open),
    secs: $$(".sec", el.preview).map((c) => c.dataset.open),
  };
}
function applyOpen(saved) {
  $$(".card[data-open]", el.preview).forEach((c, i) => saved.cards[i] && setOpen(c, saved.cards[i] === "true"));
  $$(".sec", el.preview).forEach((c, i) => saved.secs[i] && setOpen(c, saved.secs[i] === "true"));
}
function setOpen(node, open) {
  node.dataset.open = String(open);
  node.querySelector("button[aria-expanded]")?.setAttribute("aria-expanded", String(open));
}
let lastHTML = "";
function render({ enter = false, switching = false } = {}) {
  setTheme(el.preview);
  document.body.classList.toggle("motion-off", !motionOn());
  const html = state.source.trim() || state.title.trim() ? renderDocument(state) : "";
  if (html === lastHTML && !enter && !switching) return;
  lastHTML = html;
  const saved = switching ? { cards: [], secs: [] } : openState();
  el.preview.classList.remove("enter", "switching");
  el.preview.innerHTML = html || emptyState();
  if (html) {
    $$(".units > *", el.preview).forEach((n, i) => n.style.setProperty("--i", Math.min(i, 10)));
    el.preview.classList.add("instant");
    applyOpen(saved);
    requestAnimationFrame(() => requestAnimationFrame(() => el.preview.classList.remove("instant")));
    if (html && !$(".doc-tools", el.preview) && $(".card[data-open], .sec", el.preview))
      $(".document", el.preview).insertAdjacentHTML(
        "afterbegin",
        '<div class="doc-tools"><button type="button" data-toggle-all>فتح الكل</button></div>',
      );
    syncToggleLabel();
  }
  if (motionOn() && (enter || switching)) el.preview.classList.add(switching ? "switching" : "enter");
  if (enter && switching) el.preview.classList.add("enter");
}
function syncToggleLabel() {
  const b = $("[data-toggle-all]", el.preview);
  if (!b) return;
  const all = $$(".card[data-open], .sec", el.preview);
  b.textContent = all.every((c) => c.dataset.open === "true") ? "طيّ الكل" : "فتح الكل";
}

el.preview.addEventListener("click", (e) => {
  const ex = e.target.closest("[data-example]");
  if (ex) return loadExample(ex.dataset.example);
  if (e.target.closest("[data-toggle-all]")) {
    const all = $$(".card[data-open], .sec", el.preview);
    const open = !all.every((c) => c.dataset.open === "true");
    all.forEach((c) => setOpen(c, open));
    return syncToggleLabel();
  }
  const head = e.target.closest(".card[data-open], .sec-head");
  if (head) {
    const box = head.closest(".card, .sec");
    setOpen(box, box.dataset.open !== "true");
    syncToggleLabel();
    return;
  }
  const go = e.target.closest("[data-goto]");
  if (go) {
    e.preventDefault();
    const sec = document.getElementById(go.dataset.goto);
    if (!sec) return;
    setOpen(sec, true);
    sec.scrollIntoView({ behavior: motionOn() ? "smooth" : "auto", block: "start" });
  }
});

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
  save();
}
el.title.addEventListener("input", () => ((state.title = el.title.value), changed()));
el.source.addEventListener("input", () => ((state.source = el.source.value), changed()));

function syncControls() {
  el.title.value = state.title;
  el.source.value = state.source;
  $$("#form-switch [data-form]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.form === state.form)));
  $$("[data-theme]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.theme === state.theme)));
  $("#motion").checked = state.motion;
  el.count.textContent = countWords(state.source) ? `${countWords(state.source)} كلمة` : "";
}

$("#form-switch").addEventListener("click", (e) => {
  const b = e.target.closest("[data-form]");
  if (!b || b.dataset.form === state.form) return;
  state.form = b.dataset.form;
  syncControls();
  render({ switching: true });
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

/* ---------- Editor helpers ---------- */
function replaceAll(text) {
  el.source.focus();
  el.source.select();
  if (!document.execCommand("insertText", false, text)) {
    el.source.value = text;
    el.source.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
function loadExample(name) {
  const ex = examples[name];
  if (!ex) return;
  state.title = ex.title;
  state.form = ex.form;
  el.title.value = ex.title;
  replaceAll(ex.source);
  state.source = el.source.value;
  syncControls();
  render({ switching: true });
  save();
  if (innerWidth <= 900) setPanel("preview");
}
$(".markup").addEventListener("click", (e) => {
  const b = e.target.closest("[data-mark]");
  if (!b) return;
  const ta = el.source;
  const mark = b.dataset.mark;
  ta.focus();
  const v = ta.value;
  const a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
  let z = v.indexOf("\n", ta.selectionEnd);
  if (z < 0) z = v.length;
  const lines = v.slice(a, z).split("\n");
  const stripped = lines.map((l) => l.replace(/^\s*(?:#{1,3}\s*|[-*•]\s+|[0-9٠-٩]+[.)]\s+|>\s?)/, ""));
  const out = stripped
    .map((l, i) => (mark === "1. " ? `${i + 1}. ` : mark) + l)
    .join("\n");
  ta.setSelectionRange(a, z);
  if (!document.execCommand("insertText", false, out)) ta.setRangeText(out, a, z, "end");
  ta.dispatchEvent(new Event("input", { bubbles: true }));
});
$("#undo").addEventListener("click", () => {
  el.source.focus();
  document.execCommand("undo");
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
window.__takween = { get state() { return state; }, savePdf };

/* ---------- Home demo ---------- */
const demo = $("#demo-preview");
let demoForm = "summary";
let demoTimer;
function showDemo(form, animate = true) {
  demoForm = form;
  $$("[data-demo]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.demo === form)));
  demo.className = "preview theme-mist demo-preview";
  demo.innerHTML = renderDocument({ ...examples.article, form, theme: "mist" });
  $$(".card[data-open]", demo).forEach((c, i) => i === 0 && setOpen(c, true));
  if (animate && !reduced.matches) {
    demo.classList.add("switching");
  }
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
  }, 5000);
}
showDemo("summary", false);
startDemo();

syncControls();
route();
