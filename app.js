import { renderDocument, examples, sanitizeState, countWords, forms, buildModel, toFlashcards, localDigits } from "./core.js";
import { createEditor } from "./editor.js";
import { createMini } from "./mini.js";
import { bindPreviewEditing, focusTarget } from "./preview-edit.js";
import { library, relativeTime } from "./library.js";
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
  if (hasText(state) && !state.example && !state.libId) writePrev(state);
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
  const view = location.hash === "#write" ? "write" : location.hash === "#library" ? "library" : "home";
  const write = view === "write";
  $("#home").hidden = view !== "home";
  $("#write").hidden = !write;
  $("#library").hidden = view !== "library";
  $("#back").hidden = view === "home";
  document.title = write ? "الكتابة — تكوين" : view === "library" ? "مدونتي — تكوين" : "تكوين — نصّك بشكل مرتّب";
  if (view === "library") renderLibrary({ enter: true });
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
  (card.querySelector(".fc-flip") || f).setAttribute("aria-pressed", String(on));
  f.querySelector(".fc-back")?.setAttribute("aria-hidden", String(!on));
  f.querySelector(".fc-front")?.setAttribute("aria-hidden", String(on));
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".fc-flip");
  const zone = e.target.closest(".fc-in");
  if (!btn && !zone) return;
  // tapping card text edits it; only the button or the empty part of the card flips
  if (!btn && zone.closest("#preview") && e.target.closest("[data-block-id]")) return;
  flip((btn || zone).closest(".fc").querySelector(".fc-in"));
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
  const html = state.source.trim() || state.title.trim() ? renderDocument({ ...state, blocks: editor.getBlocks() }) : "";
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
    previewEdit.enable();
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
  const head = e.target.closest(".chev-btn");
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
    if (state.libId && !state.example) el.status.textContent = "";
  }, 400);
  scheduleLibSave();
}
function changed(info = {}) {
  const words = countWords(state.source);
  el.count.textContent = words ? `${words} كلمة` : "";
  clearTimeout(renderTimer);
  if (!info.textOnly) renderTimer = setTimeout(render, 120); // typing in the preview must not rebuild it
  syncDocUI();
  save();
}
const editor = createEditor($("#blocks"), {
  onChange: (src, info) => {
    state.source = src;
    changed(info);
  },
  menu: $("#typemenu"),
  typebar: $("#typebar"),
});
const previewEdit = bindPreviewEditing(el.preview, {
  editor,
  onTitle: (text) => {
    state.title = text;
    el.title.value = text;
    changed({ textOnly: true });
  },
  afterOp: (target) => afterPreviewOp(target),
});
function afterPreviewOp(target) {
  clearTimeout(renderTimer);
  render();
  focusTarget(el.preview, target);
}
createMini($("#mini"), { editor, editorRoot: $("#blocks"), preview: el.preview, afterPreviewOp });
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
$("#undo").addEventListener("click", () => editor.undo(true));
$("#redo").addEventListener("click", () => editor.redo(true));
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
function toast(msg, ms = 4200, action = null) {
  el.toast.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action";
    b.textContent = action.label;
    b.onclick = () => {
      el.toast.classList.remove("show");
      action.fn();
    };
    el.toast.append(b);
    ms = Math.max(ms, 6000);
  }
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), ms);
}


/* ---------- «مدونتي» ---------- */
const FORM_LABEL = { summary: "ملخّص", cards: "بطاقات", article: "مقال" };
let libFilter = "all";
let libQuery = "";
const escHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function updateBadge() {
  const n = library.count();
  const b = $("#lib-count");
  b.textContent = localDigits(n);
  b.hidden = !n;
}
library.subscribe(updateBadge);
library.init().then(updateBadge, () => {});

async function renderLibrary({ enter = false } = {}) {
  try {
    await library.init();
  } catch {}
  const all = library.list();
  const q = libQuery.trim().toLowerCase();
  const items = all.filter(
    (it) => (libFilter === "all" || it.form === libFilter) && (!q || `${it.title} ${it.source}`.toLowerCase().includes(q)),
  );
  $("#lib-empty").hidden = all.length > 0;
  $("#lib-none").hidden = !(all.length && !items.length);
  const grid = $("#lib-grid");
  grid.classList.remove("enter");
  grid.innerHTML = items
    .map((it, i) => {
      const doc = renderDocument({ title: it.title, source: it.source.slice(0, 1500), form: it.form });
      const name = it.title || "بلا عنوان";
      return `<article class="lib-card glass-card" data-id="${escHTML(it.id)}" style="--i:${Math.min(i, 10)}"><button class="lib-open" type="button" data-act="open" aria-label="فتح: ${escHTML(name)}"><div class="thumb"><div class="preview theme-${it.theme}">${doc}</div></div><div class="lib-meta"><h3>${escHTML(name)}</h3><div class="lib-sub"><span class="lib-tag">${FORM_LABEL[it.form]}</span><span>${relativeTime(it.updatedAt)}</span></div></div></button><details class="lib-menu"><summary aria-label="خيارات: ${escHTML(name)}">⋯</summary><div class="lib-menu-pop glass-card"><button type="button" data-act="open">فتح</button><button type="button" data-act="dup">نسخة</button><button type="button" data-act="del">حذف</button></div></details></article>`;
    })
    .join("");
  $$(".thumb", grid).forEach((t) => t.style.setProperty("--s", (t.clientWidth || 290) / 620));
  if (enter && motionOn()) grid.classList.add("enter");
}
$("#lib-search").addEventListener("input", (e) => {
  libQuery = e.target.value;
  renderLibrary();
});
$("#lib-filter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  libFilter = b.dataset.f;
  $$("#lib-filter [data-f]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  renderLibrary();
});
$("#lib-grid").addEventListener("click", async (e) => {
  const act = e.target.closest("[data-act]");
  const card = e.target.closest(".lib-card");
  if (!act || !card) return;
  const id = card.dataset.id;
  card.querySelector(".lib-menu")?.removeAttribute("open");
  if (act.dataset.act === "open") return openFromLibrary(id);
  if (act.dataset.act === "dup") {
    await library.duplicate(id);
    toast("تم نسخ النص.");
    return renderLibrary();
  }
  if (act.dataset.act === "del") {
    card.classList.add("leaving");
    if (motionOn()) await new Promise((r) => setTimeout(r, 280));
    const removed = await library.remove(id);
    if (state.libId === id) {
      state.libId = null;
      saveNow();
    }
    await renderLibrary();
    if (removed)
      toast(`حُذف «${removed.title || "بلا عنوان"}»`, 8000, {
        label: "تراجع",
        fn: async () => {
          await library.restore(removed);
          renderLibrary();
        },
      });
  }
});
document.addEventListener("click", (e) => {
  $$(".lib-menu[open]").forEach((d) => !d.contains(e.target) && d.removeAttribute("open"));
});
$("#lib-export").addEventListener("click", () => {
  const blob = new Blob([library.exportAll()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `takween-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  toast("تم تنزيل النسخة الاحتياطية.");
});
$("#lib-import").addEventListener("click", () => $("#lib-file").click());
$("#lib-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const r = await library.importAll(await file.text());
    toast(`أُضيف ${localDigits(r.added)}، وحُدّث ${localDigits(r.updated)}، وتُرك ${localDigits(r.skipped)} لأن عندك نسخة أحدث.`, 7000);
    renderLibrary();
  } catch (err) {
    toast(err.message || "تعذّر قراءة الملف.");
  }
});

function openFromLibrary(id) {
  const it = library.get(id);
  if (!it) return;
  stashDraft();
  state = sanitizeState({ title: it.title, source: it.source, form: it.form, theme: it.theme, motion: state.motion, libId: id });
  saveNow();
  applyDoc(false);
  location.hash = "#write";
}

/* Save to the library; a linked document then autosaves to its item. */
let libTimer;
function libStatus(it) {
  el.status.textContent = `محفوظ في مدونتي · ${relativeTime(it.updatedAt)}`;
}
async function saveToLibrary(manual) {
  if (!hasText(state)) return manual && toast("اكتب نصًّا أولًا ثم احفظه.");
  if (state.example) {
    state.example = null; // saving an example saves a copy
    state.libId = null;
    syncDocUI();
  }
  const first = !state.libId;
  try {
    const it = await library.save({ id: state.libId, title: state.title, form: state.form, theme: state.theme, source: state.source });
    state.libId = it.id;
    saveNow();
    libStatus(it);
    if (manual)
      toast(first ? "تم الحفظ في مدونتي." : "تم تحديث النص في مدونتي.", 6000, {
        label: "عرض في مدونتي",
        fn: () => (location.hash = "#library"),
      });
  } catch {
    if (manual) toast("تعذّر الحفظ في مدونتي.");
  }
}
function scheduleLibSave() {
  clearTimeout(libTimer);
  if (!state.libId || state.example || !hasText(state)) return;
  libTimer = setTimeout(() => saveToLibrary(false), 700);
}
$("#lib-save").addEventListener("click", () => saveToLibrary(true));
$("#lib-save-mobile").addEventListener("click", () => saveToLibrary(true));
setInterval(() => {
  const it = state.libId && library.get(state.libId);
  if (it && !$("#write").hidden) libStatus(it);
}, 30000);

/* ---------- Clear text ---------- */
function clearText() {
  if (!hasText(state)) return toast("لا يوجد نص لمسحه.");
  const snap = { title: state.title, source: state.source };
  el.title.value = "";
  state.title = "";
  editor.clearAll();
  toast("مُسح النص", 8000, {
    label: "تراجع",
    fn: () => {
      state.title = snap.title;
      state.source = snap.source;
      el.title.value = snap.title;
      editor.setSource(snap.source);
      changed();
    },
  });
}
$("#clear").addEventListener("click", clearText);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Backspace" && !$("#write").hidden) {
    e.preventDefault();
    clearText();
  }
});

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
