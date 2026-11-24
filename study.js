// «وضع المراجعة»: one flashcard at a time. State lives only in this session.
import { escapeHTML as e, localDigits } from "./core.js";

export function openStudy(root, cards, { theme = "mist", dir = "rtl", onClose = () => {} } = {}) {
  const n = (x) => localDigits(x, dir);
  const total = cards.length;
  let queue = cards.map((_, i) => i);
  let pos = 0;
  let known = 0;
  let later = [];

  root.className = `study preview theme-${theme}`;
  root.dir = dir;
  root.hidden = false;
  document.body.classList.add("study-open");
  const opener = document.activeElement;

  function close() {
    root.hidden = true;
    root.innerHTML = "";
    document.body.classList.remove("study-open");
    document.removeEventListener("keydown", onKey);
    opener?.focus?.();
    onClose();
  }
  function answer(isKnown) {
    if (isKnown) known++;
    else later.push(queue[pos]);
    pos++;
    show();
  }
  function front(c) {
    return c.big ? `<b class="bigv">${e(c.front)}</b>` : `<h3 dir="auto">${e(c.front).replace(/\n/g, "<br>")}</h3>`;
  }
  function show() {
    const head = `<div class="study-top"><button type="button" class="button ghost" data-close>إغلاق</button><div class="study-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${queue.length}" aria-valuenow="${Math.min(pos, queue.length)}"><i style="width:${(Math.min(pos, queue.length) / queue.length) * 100}%"></i></div><span class="study-count">${n(Math.min(pos + 1, queue.length))} من ${n(queue.length)}</span></div>`;
    if (pos >= queue.length) {
      root.innerHTML = `${head}<div class="study-end glass-card"><h2>انتهت المراجعة</h2><p>عدد البطاقات التي تعرفها: <b>${n(known)}</b> من <b>${n(total)}</b></p><div class="study-actions">${later.length ? `<button type="button" class="button primary" data-redo>أعد الصعبة فقط (${n(later.length)})</button>` : ""}<button type="button" class="button ghost" data-close>إغلاق</button></div></div>`;
      root.querySelector(".study-end button")?.focus();
      return;
    }
    const c = cards[queue[pos]];
    const back = c.back
      ? `<div class="fc-face fc-back" aria-hidden="true"><span class="side">الظهر</span>${c.back}</div>`
      : "";
    root.innerHTML = `${head}<div class="study-stage"><div class="fc study-fc"><div class="fc-in" role="button" tabindex="0" aria-pressed="false" aria-label="بطاقة. اضغط لقلبها"><div class="fc-face fc-front">${front(c)}${c.back ? '<span class="hint">اضغط للقلب</span>' : ""}</div>${back}</div></div></div><div class="study-actions"><button type="button" class="button ghost big" data-later>أراجعها لاحقًا</button><button type="button" class="button primary big" data-know>أعرفها</button></div><p class="study-tip muted">اسحب البطاقة يسارًا لـ«أعرفها» ويمينًا لـ«أراجعها لاحقًا»</p>`;
    root.querySelector(".fc-in").focus({ preventScroll: true });
    swipe(root.querySelector(".study-fc"));
  }
  function swipe(card) {
    let x0 = null;
    let dx = 0;
    card.style.touchAction = "pan-y";
    card.addEventListener("pointerdown", (ev) => {
      x0 = ev.clientX;
      dx = 0;
      card.setPointerCapture?.(ev.pointerId);
    });
    card.addEventListener("pointermove", (ev) => {
      if (x0 === null) return;
      dx = ev.clientX - x0;
      if (Math.abs(dx) > 6) {
        card.style.transition = "none";
        card.style.transform = `translateX(${dx}px) rotate(${dx / 25}deg)`;
        card.dataset.drag = "1";
      }
    });
    const end = () => {
      if (x0 === null) return;
      x0 = null;
      card.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1), opacity .35s";
      if (Math.abs(dx) > 90) {
        card.style.transform = `translateX(${dx > 0 ? 120 : -120}%) rotate(${dx > 0 ? 12 : -12}deg)`;
        card.style.opacity = "0";
        const isKnown = dx < 0;
        setTimeout(() => answer(isKnown), 220);
      } else {
        card.style.transform = "";
        setTimeout(() => delete card.dataset.drag, 0);
      }
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    // a drag must not count as a tap that flips the card
    card.addEventListener(
      "click",
      (ev) => {
        if (card.dataset.drag) {
          ev.stopPropagation();
          ev.preventDefault();
          delete card.dataset.drag;
        }
      },
      true,
    );
  }
  root.onclick = (ev) => {
    if (ev.target.closest("[data-close]")) close();
    else if (ev.target.closest("[data-know]")) answer(true);
    else if (ev.target.closest("[data-later]")) answer(false);
    else if (ev.target.closest("[data-redo]")) {
      const l = later;
      queue = l;
      pos = 0;
      later = [];
      show();
    }
  };
  function onKey(ev) {
    if (root.hidden) return;
    if (ev.key === "Escape") close();
    else if (ev.key === "ArrowLeft" && pos < queue.length) answer(true);
    else if (ev.key === "ArrowRight" && pos < queue.length) answer(false);
  }
  document.addEventListener("keydown", onKey);
  show();
  return close;
}
