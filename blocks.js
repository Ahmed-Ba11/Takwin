// Block model for the line editor. Pure functions (no DOM) so they are unit-tested.
// The stored text stays plain markup, so parsing, PDF and saved drafts keep working.
import { parseBlocks, reStat } from "./core.js";

export const TYPES = {
  p: { label: "فقرة", hint: "نص عادي" },
  h: { label: "عنوان", hint: "يقسّم النص إلى أقسام", key: "# " },
  ul: { label: "نقطة", hint: "عنصر في قائمة", key: "- " },
  ol: { label: "خطوة", hint: "عنصر مرقّم", key: "1. " },
  quote: { label: "اقتباس", hint: "جملة بارزة", key: "> " },
  stat: { label: "رقم بارز", hint: "سطر يبدأ برقم أو نسبة", key: "85% " },
  front: { label: "وجه البطاقة", hint: "سؤال أو مصطلح", key: "?? " },
  back: { label: "ظهر البطاقة", hint: "الجواب أو الشرح", key: "!! " },
};
export const TYPE_ORDER = ["h", "p", "ul", "ol", "quote", "stat", "front", "back"];

let counter = 0;
export const newBlock = (t = "p", text = "", level = 1) => ({ id: ++counter, t, text, level });

export function sourceToBlocks(src) {
  const out = [];
  for (const b of parseBlocks(src)) {
    if (b.t === "h") out.push(newBlock("h", b.text, b.level));
    else if (b.t === "p") b.text.split("\n").forEach((l) => out.push(newBlock("p", l)));
    else if (b.t === "ul" || b.t === "ol") b.items.forEach((x) => out.push(newBlock(b.t, x)));
    else if (b.t === "quote") b.text.split("\n").forEach((l) => out.push(newBlock("quote", l)));
    else if (b.t === "stat") out.push(newBlock("stat", `${b.value} ${b.label}`));
    else out.push(newBlock(b.t, b.text));
  }
  return out.length ? out : [newBlock()];
}

export function blocksToSource(blocks) {
  const lines = [];
  let n = 0;
  let prev = null;
  for (const b of blocks) {
    const text = b.text.replace(/\n/g, " ").trim();
    if (!text) continue;
    n = b.t === "ol" && prev?.t === "ol" ? n + 1 : 1;
    let line = text;
    if (b.t === "h") line = `${"#".repeat(b.level || 1)} ${text}`;
    else if (b.t === "ul") line = `- ${text}`;
    else if (b.t === "ol") line = `${n}. ${text}`;
    else if (b.t === "quote") line = `> ${text}`;
    else if (b.t === "front") line = `?? ${text}`;
    else if (b.t === "back") line = `!! ${text}`;
    const glue =
      !prev ? "" : (b.t === "ul" || b.t === "ol") && prev.t === b.t ? "\n" : prev.t === "front" && b.t === "back" ? "\n" : "\n\n";
    lines.push(glue + line);
    prev = b;
  }
  return lines.join("");
}

/** Typing shortcut at the start of a block: "# ", "- ", "1. ", "> ", "85% x". */
export function detectShortcut(text) {
  let m;
  if ((m = text.match(/^(#{1,3})\s(.*)$/))) return { t: "h", level: m[1].length, text: m[2] };
  if ((m = text.match(/^[-*•–]\s(.*)$/))) return { t: "ul", text: m[1] };
  if ((m = text.match(/^[0-9٠-٩]+[.)]\s(.*)$/))) return { t: "ol", text: m[1] };
  if ((m = text.match(/^>\s(.*)$/))) return { t: "quote", text: m[1] };
  if ((m = text.match(/^\?\?\s(.*)$/))) return { t: "front", text: m[1] };
  if ((m = text.match(/^!!\s(.*)$/))) return { t: "back", text: m[1] };
  if (reStat.test(text)) return { t: "stat", text };
  return null;
}

const short = (s, max = 60) => s.length > 0 && s.length <= max && !/[.؟?!،,:؛;。]$/.test(s);
const isText = (b) => b && b.t === "p" && b.text.trim();

/** Rule-based hint for one paragraph block. Returns { t, label } or null. */
export function suggest(blocks, i) {
  const b = blocks[i];
  if (!isText(b)) return null;
  const s = b.text.trim();
  const next = blocks[i + 1];
  const prev = blocks[i - 1];
  if (/^[«“"].*[»”"]$/.test(s)) return { t: "quote", label: "يبدو اقتباسًا" };
  if (reStat.test(s)) return { t: "stat", label: "رقم بارز؟" };
  if (short(s) && isText(next) && next.text.trim().length > s.length * 1.3) return { t: "h", label: "يبدو عنوانًا" };
  if (short(s, 70) && (isText(next) && short(next.text.trim(), 70) || isText(prev) && short(prev.text.trim(), 70)))
    return { t: "ul", label: "نقاط؟" };
  return null;
}

/** «ترتيب سريع»: proposes a type for every plain line. Returns { blocks, changed }. */
export function arrange(blocks) {
  let changed = 0;
  const out = blocks.map((b, i) => {
    if (b.t !== "p") return b;
    const s = suggest(blocks, i);
    if (!s) return b;
    changed++;
    return { ...b, t: s.t, level: s.t === "h" ? 1 : b.level };
  });
  return { blocks: out, changed };
}
