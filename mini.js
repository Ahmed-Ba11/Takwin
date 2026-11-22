// Floating type toolbar: same types, colours and «حذف» for the editor and the preview.
import { TYPES, TYPE_ORDER } from "./blocks.js";

export function createMini(el, { editor, editorRoot, preview, afterPreviewOp }) {
  el.innerHTML =
    TYPE_ORDER.map((t) => `<button type="button" data-type="${t}"><i class="dot" data-t="${t}"></i>${TYPES[t].label}</button>`).join("") +
    '<button type="button" data-act="del" class="mini-del">حذف</button>';
  ["mousedown", "pointerdown"].forEach((ev) => el.addEventListener(ev, (e) => e.preventDefault()));
  let ctx = null;
  const docked = () => matchMedia("(max-width: 900px), (pointer: coarse)").matches;

  function offset(box, node, off) {
    const pre = document.createRange();
    pre.selectNodeContents(box);
    pre.setEnd(node, off);
    return pre.toString().length;
  }
  function read() {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.anchorNode) return null;
    const r = sel.getRangeAt(0);
    const node = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    let surface, id, box;
    const txt = node?.closest?.(".txt");
    if (txt && editorRoot.contains(txt)) {
      surface = "editor";
      id = Number(txt.closest(".blk").dataset.id);
      box = txt;
    } else {
      const be = node?.closest?.("[data-block-id]");
      if (!be || !preview.contains(be) || be.dataset.part) return null;
      surface = "preview";
      id = Number(be.dataset.blockId);
      box = be;
    }
    if (!box.contains(r.startContainer) || !box.contains(r.endContainer)) return null;
    const start = offset(box, r.startContainer, r.startOffset);
    const end = offset(box, r.endContainer, r.endOffset);
    if (surface === "editor" && start === end) return null; // the editor's type bar covers a plain caret
    return { surface, id, start, end, box, r };
  }
  function place() {
    if (!ctx) return;
    el.hidden = false;
    if (docked()) {
      el.classList.add("docked");
      const vv = window.visualViewport;
      const gap = vv ? innerHeight - vv.height - vv.offsetTop : 0;
      el.style.setProperty("--mb", `${gap > 80 ? gap + 8 : 82}px`);
      el.style.left = el.style.top = "";
      return;
    }
    el.classList.remove("docked");
    let rect = ctx.r.getBoundingClientRect();
    if (!rect.width && !rect.height) rect = ctx.box.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top = rect.top - h - 8;
    if (top < 8) top = rect.bottom + 8;
    el.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, rect.left + rect.width / 2 - w / 2))}px`;
    el.style.top = `${top}px`;
  }
  function update() {
    ctx = read();
    if (!ctx) {
      el.hidden = true;
      return;
    }
    place();
  }
  document.addEventListener("selectionchange", update);
  addEventListener("scroll", () => ctx && place(), true);
  addEventListener("resize", () => ctx && place());
  window.visualViewport?.addEventListener("resize", () => ctx && place());

  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !ctx) return;
    const { surface, id, start, end } = ctx;
    const quiet = surface === "preview";
    const whole = start === end || (start <= 0 && end >= ctx.box.textContent.length);
    let target;
    if (b.dataset.act === "del") {
      target = whole ? editor.removeById(id, { quiet }) : editor.deleteRange(id, start, end, { quiet });
    } else target = editor.retypeById(id, start, end, b.dataset.type, { quiet });
    if (quiet && target) afterPreviewOp(target);
  });
  return { update };
}
