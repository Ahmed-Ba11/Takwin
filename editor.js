// Line-based block editor: every line shows what it will become.
import {
  TYPES, TYPE_ORDER, newBlock, sourceToBlocks, blocksToSource, detectShortcut, suggest, arrange,
} from "./blocks.js";
import { localDigits } from "./core.js";

const PLACEHOLDER = "اكتب، أو اضغط / لاختيار النوع";
const $ = (s, r = document) => r.querySelector(s);

export function createEditor(root, { onChange = () => {}, menu, mini, typebar }) {
  let blocks = [newBlock()];
  let cur = 0;
  let history = [];
  let lastTyped = 0;
  const ser = () => JSON.stringify(blocks.map(({ t, text, level }) => ({ t, text, level })));
  const deser = (s) => JSON.parse(s).map((b) => newBlock(b.t, b.text, b.level));
  let snap = ser();
  const dismissed = new Set();
  let proposed = new Set();
  let menuIndex = 0;

  /* ---------- history ---------- */
  function record(coalesce) {
    const now = Date.now();
    if (!(coalesce && now - lastTyped < 900)) {
      history.push(snap);
      if (history.length > 100) history.shift();
    }
    lastTyped = coalesce ? now : 0;
    snap = ser();
  }
  const emit = () => onChange(blocksToSource(blocks));

  /* ---------- DOM ---------- */
  const rows = () => [...root.querySelectorAll(".blk")];
  const txtOf = (i) => rows()[i]?.querySelector(".txt");
  const idxOf = (node) => rows().indexOf(node.closest(".blk"));

  function rowHTML(b) {
    return `<div class="blk" data-t="${b.t}" data-lv="${b.level || 1}" data-id="${b.id}"><button type="button" class="badge" aria-haspopup="menu" aria-label="نوع السطر: ${TYPES[b.t].label}"><i class="dot"></i><span>${TYPES[b.t].label}</span></button><div class="body"><div class="txt" contenteditable="true" dir="auto" role="textbox" data-ph="${PLACEHOLDER}" aria-label="${TYPES[b.t].label}"></div></div><div class="chip-slot"></div></div>`;
  }
  function numbering() {
    let n = 0;
    let prev = null;
    rows().forEach((r, i) => {
      const t = blocks[i].t;
      n = t === "ol" ? (prev === "ol" ? n + 1 : 1) : 0;
      r.querySelector(".body").dataset.n = t === "ol" ? localDigits(n, "rtl") : "";
      prev = t;
    });
  }
  function render(focus = null, caretAt = 0) {
    root.innerHTML = blocks.map(rowHTML).join("");
    rows().forEach((r, i) => {
      r.querySelector(".txt").textContent = blocks[i].text;
      if (proposed.has(blocks[i].id)) r.classList.add("proposed");
    });
    numbering();
    if (focus !== null) {
      cur = Math.max(0, Math.min(focus, blocks.length - 1));
      focusAt(cur, caretAt);
    }
    markCurrent();
  }
  function focusAt(i, pos) {
    const t = txtOf(i);
    if (!t) return;
    t.focus({ preventScroll: false });
    setCaret(t, pos === "end" ? t.textContent.length : pos);
  }
  function setCaret(t, pos) {
    const sel = getSelection();
    const r = document.createRange();
    const node = t.firstChild;
    if (node) r.setStart(node, Math.min(pos, node.length));
    else r.setStart(t, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function caret(t) {
    const sel = getSelection();
    if (!sel.rangeCount) return { start: 0, end: 0 };
    const r = sel.getRangeAt(0);
    const pre = r.cloneRange();
    pre.selectNodeContents(t);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    return { start, end: start + r.toString().length };
  }
  function markCurrent() {
    rows().forEach((r, i) => r.classList.toggle("cur", i === cur));
    typebar?.querySelectorAll("[data-type]").forEach((b) =>
      b.setAttribute("aria-pressed", String(blocks[cur]?.t === b.dataset.type)),
    );
    updateChip();
  }

  /* ---------- changes ---------- */
  function setType(i, t, keepFocus = true) {
    const b = blocks[i];
    if (!b || b.t === t) return;
    b.t = t;
    b.level = 1;
    proposed.delete(b.id);
    record(false);
    render(keepFocus ? i : null, "end");
    emit();
  }
  function split(i, start, end) {
    const b = blocks[i];
    const left = b.text.slice(0, start);
    const right = b.text.slice(end);
    if (!left && !right && ["ul", "ol", "quote", "front", "back", "h", "stat"].includes(b.t)) {
      return setType(i, "p");
    }
    const next = { h: "p", stat: "p", front: "back", back: "front" }[b.t] || b.t;
    b.text = left;
    blocks.splice(i + 1, 0, newBlock(next, right));
    record(false);
    render(i + 1, 0);
    emit();
  }
  function backspaceAtStart(i) {
    const b = blocks[i];
    if (b.t !== "p") return setType(i, "p");
    if (i === 0) return;
    const prev = blocks[i - 1];
    const at = prev.text.length;
    prev.text += b.text;
    blocks.splice(i, 1);
    record(false);
    render(i - 1, at);
    emit();
  }
  function pasteText(i, text) {
    const parsed = sourceToBlocks(text.replace(/\r/g, ""));
    const here = blocks[i];
    record(false);
    if (!here.text.trim()) blocks.splice(i, 1, ...parsed);
    else blocks.splice(i + 1, 0, ...parsed);
    const last = (here.text.trim() ? i + 1 : i) + parsed.length - 1;
    render(last, "end");
    emit();
  }

  /* ---------- events ---------- */
  root.addEventListener("input", (e) => {
    const t = e.target.closest(".txt");
    if (!t || e.isComposing) return;
    const i = idxOf(t);
    const b = blocks[i];
    if (!t.textContent) t.innerHTML = "";
    b.text = t.textContent.replace(/\n/g, " ");
    if (b.t === "p") {
      const sc = detectShortcut(b.text);
      if (sc) {
        record(false);
        b.t = sc.t;
        b.text = sc.text;
        if (sc.level) b.level = sc.level;
        render(i, "end");
        return emit();
      }
    }
    record(true);
    scheduleChip();
    emit();
  });
  root.addEventListener("beforeinput", (e) => {
    const t = e.target.closest(".txt");
    if (!t) return;
    const i = idxOf(t);
    if (e.inputType === "insertParagraph" || e.inputType === "insertLineBreak") {
      e.preventDefault();
      const c = caret(t);
      split(i, c.start, c.end);
    } else if (e.inputType === "deleteContentBackward") {
      const c = caret(t);
      if (c.start === 0 && c.end === 0) {
        e.preventDefault();
        backspaceAtStart(i);
      }
    }
  });
  root.addEventListener("keydown", (e) => {
    const t = e.target.closest(".txt");
    if (!t || e.isComposing) return;
    const i = idxOf(t);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      return undo();
    }
    if (e.key === "/" && !t.textContent) {
      e.preventDefault();
      return openMenu(i, rows()[i].querySelector(".badge"));
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const up = e.key === "ArrowUp";
      const c = caret(t);
      const rect = getSelection().rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : null;
      const box = t.getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(t).lineHeight) || 24;
      const edge = !t.textContent || !rect || !rect.height
        ? true
        : up
          ? rect.top - box.top < lh * 0.7
          : box.bottom - rect.bottom < lh * 0.7;
      const j = i + (up ? -1 : 1);
      if (edge && c.start === c.end && j >= 0 && j < blocks.length) {
        e.preventDefault();
        cur = j;
        focusAt(j, up ? "end" : 0);
      }
    }
  });
  root.addEventListener("paste", (e) => {
    const t = e.target.closest(".txt");
    if (!t) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (/\n/.test(text.trim())) pasteText(idxOf(t), text);
    else document.execCommand("insertText", false, text.replace(/\n/g, " "));
  });
  root.addEventListener("drop", (e) => e.preventDefault());
  root.addEventListener("focusin", (e) => {
    const t = e.target.closest(".txt");
    if (!t) return;
    cur = idxOf(t);
    markCurrent();
  });
  root.addEventListener("click", (e) => {
    const badge = e.target.closest(".badge");
    if (badge) return openMenu(idxOf(badge), badge);
    const chip = e.target.closest(".chip-apply");
    if (chip) {
      const i = idxOf(chip);
      const s = suggest(blocks, i);
      if (s) setType(i, s.t);
    }
    const x = e.target.closest(".chip-x");
    if (x) {
      dismissed.add(blocks[idxOf(x)].id);
      updateChip();
    }
  });

  /* ---------- suggestion chip ---------- */
  let chipTimer;
  const scheduleChip = () => {
    clearTimeout(chipTimer);
    chipTimer = setTimeout(updateChip, 350);
  };
  function updateChip() {
    rows().forEach((r) => (r.querySelector(".chip-slot").innerHTML = ""));
    const b = blocks[cur];
    if (!b || dismissed.has(b.id)) return;
    const s = suggest(blocks, cur);
    if (!s) return;
    rows()[cur].querySelector(".chip-slot").innerHTML =
      `<button type="button" class="chip chip-apply" data-t="${s.t}">${s.label} — طبّق</button><button type="button" class="chip-x" aria-label="تجاهل الاقتراح">×</button>`;
  }

  /* ---------- type menu ---------- */
  menu.innerHTML = TYPE_ORDER.map(
    (t) =>
      `<button type="button" role="menuitem" data-type="${t}"><i class="dot" data-t="${t}"></i><span class="m-label">${TYPES[t].label}</span><span class="m-hint">${TYPES[t].hint}</span>${TYPES[t].key ? `<kbd dir="ltr">${TYPES[t].key.trim()}</kbd>` : ""}</button>`,
  ).join("");
  function openMenu(i, anchor) {
    menuIndex = i;
    const r = anchor.getBoundingClientRect();
    menu.hidden = false;
    const mw = menu.offsetWidth;
    const left = Math.max(8, Math.min(innerWidth - mw - 8, r.right - mw));
    let top = r.bottom + 6;
    if (top + menu.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.querySelector(`[data-type="${blocks[i].t}"]`)?.focus();
  }
  const closeMenu = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    focusAt(menuIndex, "end");
  };
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    menu.hidden = true;
    setType(menuIndex, b.dataset.type);
  });
  menu.addEventListener("keydown", (e) => {
    const items = [...menu.querySelectorAll("button")];
    const k = items.indexOf(document.activeElement);
    if (e.key === "Escape") return closeMenu();
    if (e.key === "ArrowDown") (items[k + 1] || items[0]).focus();
    else if (e.key === "ArrowUp") (items[k - 1] || items.at(-1)).focus();
    else return;
    e.preventDefault();
  });
  document.addEventListener("mousedown", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !e.target.closest(".badge")) menu.hidden = true;
  });

  /* ---------- floating mini toolbar on selection ---------- */
  if (mini) {
    const MINI = ["h", "p", "ul", "ol", "quote", "stat"];
    mini.innerHTML = MINI.map((t) => `<button type="button" data-type="${t}">${TYPES[t].label}</button>`).join("");
    mini.addEventListener("mousedown", (e) => e.preventDefault());
    mini.addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (b) {
        mini.hidden = true;
        setType(cur, b.dataset.type);
      }
    });
    document.addEventListener("selectionchange", () => {
      const sel = getSelection();
      const node = sel.anchorNode;
      if (!sel.rangeCount || sel.isCollapsed || !node || !root.contains(node)) {
        mini.hidden = true;
        return;
      }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      mini.hidden = false;
      const w = mini.offsetWidth;
      mini.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      mini.style.top = `${Math.max(8, r.top - mini.offsetHeight - 8)}px`;
    });
  }

  /* ---------- type bar (desktop toolbar, sticky chips on mobile) ---------- */
  if (typebar) {
    typebar.innerHTML = TYPE_ORDER.map((t) => `<button type="button" data-type="${t}" aria-pressed="false"><i class="dot" data-t="${t}"></i>${TYPES[t].label}</button>`).join("");
    typebar.addEventListener("mousedown", (e) => e.preventDefault());
    typebar.addEventListener("click", (e) => {
      const b = e.target.closest("[data-type]");
      if (b) setType(cur, b.dataset.type);
    });
  }

  /* ---------- public API ---------- */
  function undo() {
    if (!history.length) return;
    blocks = deser(history.pop());
    snap = ser();
    proposed = new Set();
    render(Math.min(cur, blocks.length - 1), "end");
    emit();
  }
  return {
    setSource(src) {
      blocks = sourceToBlocks(src);
      history = [];
      snap = ser();
      proposed = new Set();
      dismissed.clear();
      cur = 0;
      render();
    },
    getSource: () => blocksToSource(blocks),
    undo,
    focus: () => focusAt(cur, "end"),
    isEmpty: () => blocks.every((b) => !b.text.trim()),
    /** «ترتيب سريع»: applies suggested types to all plain lines; returns how many changed. */
    arrange() {
      const r = arrange(blocks);
      if (!r.changed) return 0;
      record(false);
      proposed = new Set(r.blocks.filter((b, i) => b.t !== blocks[i].t).map((b) => b.id));
      blocks = r.blocks;
      render();
      emit();
      return r.changed;
    },
    clearProposal() {
      proposed = new Set();
      rows().forEach((r) => r.classList.remove("proposed"));
    },
    hasProposal: () => proposed.size > 0,
  };
}
