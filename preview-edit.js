// Edit text right in the preview. The preview is another view of the editor's block model.
import { latinDigits } from "./core.js";

const SEL = "[data-block-id]";

export function focusTarget(preview, tg) {
  if (!tg) return;
  const el = preview.querySelector(`[data-block-id="${tg.id}"]:not([data-part])`) || preview.querySelector(`[data-block-id="${tg.id}"]`);
  if (!el) return;
  el.focus({ preventScroll: false });
  const len = el.textContent.length;
  const s = tg.start === "end" ? len : Math.min(tg.start, len);
  const e = tg.end === "end" ? len : Math.min(tg.end, len);
  const r = document.createRange();
  const node = el.firstChild;
  if (node && node.nodeType === 3) {
    r.setStart(node, s);
    r.setEnd(node, e);
  } else {
    r.selectNodeContents(el);
    r.collapse(s === 0);
  }
  getSelection().removeAllRanges();
  getSelection().addRange(r);
}

export function bindPreviewEditing(preview, { editor, afterOp, onTitle }) {
  const caret = (el) => {
    const sel = getSelection();
    if (!sel.rangeCount) return { start: 0, end: 0 };
    const r = sel.getRangeAt(0);
    const pre = r.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(r.startContainer, r.startOffset);
    const start = pre.toString().length;
    return { start, end: start + r.toString().length };
  };

  function readText(el) {
    const id = el.dataset.blockId;
    if (!el.dataset.part) return el.textContent.replace(/\n/g, " ");
    const by = {};
    preview.querySelectorAll(`[data-block-id="${id}"][data-part]`).forEach((x) => (by[x.dataset.part] = x));
    if (by.value || by.label) return `${latinDigits((by.value?.textContent || "").trim())} ${by.label?.textContent || ""}`;
    return (by.front?.textContent || "") + (by.front?.dataset.sep ?? " ") + (by.back?.textContent || "");
  }

  /** Called after every render: turns rendered blocks into editable text. */
  function enable() {
    preview.querySelectorAll(SEL).forEach((el) => {
      el.contentEditable = "true";
      el.spellcheck = false;
      el.setAttribute("role", "textbox");
      el.dataset.ph = "اكتب هنا";
    });
    preview.querySelectorAll("[data-title]").forEach((el) => {
      el.contentEditable = "true";
      el.spellcheck = false;
      el.dataset.ph = "العنوان";
    });
  }

  preview.addEventListener("input", (e) => {
    const el = e.target.closest(SEL);
    if (el) {
      if (!el.textContent) el.innerHTML = "";
      editor.setTextById(Number(el.dataset.blockId), readText(el));
      preview.querySelectorAll(`[data-toc-for="${el.dataset.blockId}"] .tt`).forEach((t) => (t.textContent = el.textContent));
      return;
    }
    const t = e.target.closest("[data-title]");
    if (t) onTitle(t.textContent.replace(/\n/g, " "));
  });

  preview.addEventListener("beforeinput", (e) => {
    const el = e.target.closest(SEL);
    const newline = e.inputType === "insertParagraph" || e.inputType === "insertLineBreak";
    if (!el) {
      if (newline && e.target.closest("[data-title]")) e.preventDefault();
      return;
    }
    const id = Number(el.dataset.blockId);
    if (newline) {
      e.preventDefault();
      if (el.dataset.part) return;
      const c = caret(el);
      afterOp(editor.splitById(id, c.start, c.end));
    } else if (e.inputType === "deleteContentBackward" && !el.dataset.part) {
      const c = caret(el);
      if (c.start === 0 && c.end === 0) {
        e.preventDefault();
        const tg = editor.backspaceById(id);
        if (tg) afterOp(tg);
      }
    }
  });

  preview.addEventListener("keydown", (e) => {
    if (!e.target.closest(`${SEL}, [data-title]`)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? editor.redo(true) : editor.undo(true);
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      editor.redo(true);
    } else if (e.key === "Escape") e.target.blur();
  });

  preview.addEventListener("paste", (e) => {
    if (!e.target.closest(`${SEL}, [data-title]`)) return;
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "));
  });
  preview.addEventListener("drop", (e) => e.target.closest(SEL) && e.preventDefault());

  return { enable };
}
