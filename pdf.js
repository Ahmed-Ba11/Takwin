// Client-side PDF: fixed A4 pages are rendered off-screen, rasterised and assembled.
// Uses vendored html2canvas + jsPDF (see vendor/). Works offline, no popup, no print dialog.
import { renderPdfModel, fileName, logoSVG, localDigits } from "./core.js";

export const PAGE_W = 794; // A4 at 96dpi
export const PAGE_H = 1123;
const SCALE = 2;

const loaded = {};
function loadScript(src) {
  return (loaded[src] ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = () => fail(new Error("تعذّر تحميل " + src));
    document.head.append(s);
  }));
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Lays the units out into fixed pages, never splitting a unit across pages. */
export function paginate(stage, pm, theme) {
  const pages = [];
  const make = (first) => {
    const el = document.createElement("div");
    el.className = `pdf-page theme-${theme}`;
    el.innerHTML = `<div class="pdf-body"><div class="document form-${pm.form}" dir="${pm.dir}">${first ? pm.head : ""}<div class="units ${pm.form}-units"></div></div></div><div class="pdf-foot"></div>`;
    stage.append(el);
    pages.push(el);
    return el;
  };
  let page = make(true);
  const fits = (p) => {
    const body = p.firstElementChild;
    return body.scrollHeight <= body.clientHeight + 1;
  };
  for (const html of pm.units) {
    let box = page.querySelector(".units");
    box.insertAdjacentHTML("beforeend", html);
    let node = box.lastElementChild;
    if (fits(page)) continue;
    if (box.children.length > 1) {
      node.remove();
      page = make(false);
      box = page.querySelector(".units");
      box.insertAdjacentHTML("beforeend", html);
      node = box.lastElementChild;
    }
    if (!fits(page)) {
      // A single unit taller than a page: shrink it to fit instead of cutting it.
      const body = page.firstElementChild;
      const room = body.clientHeight - (body.scrollHeight - node.offsetHeight);
      const s = Math.max(0.5, room / node.offsetHeight);
      node.style.transformOrigin = "top";
      node.style.transform = `scale(${s})`;
      node.style.marginBottom = `${-(node.offsetHeight * (1 - s))}px`;
    }
  }
  pages.forEach((p, i) => {
    p.querySelector(".pdf-foot").innerHTML = `${logoSVG(16)}<span dir="${pm.dir}">${localDigits(i + 1, pm.dir)} من ${localDigits(pages.length, pm.dir)}</span>`;
    p.firstElementChild.style.overflow = "hidden";
  });
  return pages;
}

export async function buildPdf(state, onProgress = () => {}) {
  await Promise.all([
    loadScript("vendor/html2canvas.min.js"),
    loadScript("vendor/jspdf.umd.min.js"),
  ]);
  await document.fonts.ready;
  await Promise.all(
    ["400 16px 'Thmanyah Sans'", "700 16px 'Thmanyah Sans'", "700 16px 'Thmanyah Serif Display'"].map((f) => document.fonts.load(f, "عربي")),
  );
  const pm = renderPdfModel(state);
  const stage = document.createElement("div");
  stage.className = "pdf-stage";
  document.body.append(stage);
  try {
    const pages = paginate(stage, pm, state.theme);
    await nextFrame();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      unit: "px",
      format: [PAGE_W, PAGE_H],
      orientation: "portrait",
      compress: true,
      hotfixes: ["px_scaling"],
    });
    pdf.setProperties({ title: pm.title || "تكوين", creator: "تكوين" });
    for (let i = 0; i < pages.length; i++) {
      onProgress(i + 1, pages.length);
      const canvas = await window.html2canvas(pages[i], {
        scale: SCALE,
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: null,
        logging: false,
      });
      if (i) pdf.addPage([PAGE_W, PAGE_H], "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, PAGE_W, PAGE_H, undefined, "FAST");
      canvas.width = canvas.height = 0;
      await nextFrame();
    }
    const blob = pdf.output("blob");
    return { blob, name: fileName(pm.title), pages: pages.length };
  } finally {
    stage.remove();
  }
}

/** Mobile: share sheet when the browser can share files; otherwise a normal download. */
export async function deliver({ blob, name }) {
  const file = new File([blob], name, { type: "application/pdf" });
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name.replace(/\.pdf$/, "") });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "downloaded";
}
