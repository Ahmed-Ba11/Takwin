import {
  layouts,
  escapeHTML as e,
  uid,
  parseText,
  paginate,
  direction,
  renderDocument,
  validateProject,
} from "./core.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let state = {
    title: "",
    source: "",
    scenes: [],
    format: "article",
    theme: "mist",
    motion: "expressive",
    dir: "auto",
  },
  history = [],
  index = 0,
  viewerIndex = 0,
  pendingExample = null,
  saveTimer,
  aiSession,
  aiAvailable = false;
const examples = {
  article: {
    title: "فن الانتباه للأشياء الصغيرة",
    format: "article",
    source:
      "في يومٍ مزدحم، قد تمرّ التفاصيل الجميلة دون أن نراها. ضوء الصباح على النافذة، حديث عابر، أو صفحة تمنحنا فكرة جديدة. الانتباه ليس وقتًا إضافيًا نحتاجه، بل طريقة مختلفة لرؤية الوقت الذي نملكه.\n\n«ليست كل الأشياء المهمة كبيرة. بعض المعاني تختبئ في التفاصيل.»\n\nمساحة صغيرة للتأمل\nامنح نفسك دقائق بلا إشعارات. اختر شيئًا حولك وتأمله: لونه، ملمسه، وما يذكّرك به. حين نبطئ قليلًا، نرى أكثر.\n\n- دوّن تفصيلًا أسعدك اليوم.\n- شارك فكرة لطيفة مع شخص تحبه.\n- اترك مساحة لشيء غير مخطط له.\n\nقد لا يتغير اليوم كله، لكن علاقتك به ستتغير. وهذه بداية تستحق الاهتمام.",
  },
  steps: {
    title: "من فكرة صغيرة إلى مشروع حيّ",
    format: "slides",
    source:
      "١. اكتشف السؤال\nابدأ بما يحتاجه الناس فعلًا. راقب، واسأل، واجمع الملاحظات قبل أن تتعلق بحل واحد.\n\n٢. ارسم الاحتمالات\nضع أفكارك أمامك. جرّب أكثر من اتجاه، واختر الفكرة التي تجيب عن السؤال بوضوح.\n\n٣. اصنع نسخة بسيطة\nحوّل الفكرة إلى تجربة يمكن لمسها واختبارها. يكفي أن تشرح جوهر الحل.\n\n٤. اختبر وتعلّم\nراقب استخدام الناس للتجربة. استمع إلى ما يصعب عليهم، ودوّن ما يحتاج إلى تغيير.\n\n٥. حسّن ثم انطلق\nكل تجربة تمنحك معرفة جديدة. طوّر المشروع تدريجيًا، واحتفظ بالسؤال الأول قريبًا منك.",
  },
  cards: {
    title: "مساحة لأفكار أفضل",
    format: "cards",
    source:
      "- اسأل قبل أن تفترض. السؤال الجيد يفتح احتمالات لم تكن تراها.\n- اكتب قبل أن تنسى. الأفكار الصغيرة تستحق مكانًا تحفظ فيه.\n- جرّب قبل أن تحكم. التجربة البسيطة تعلّمك أكثر من التوقع.\n- شارك قبل أن تكتمل. وجهة نظر أخرى قد تكشف ما ينقص الفكرة.\n- استرح لتعود. بعض الحلول تظهر عندما تمنح ذهنك مساحة.",
  },
};
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
function snapshot() {
  history.push(structuredClone(state));
  if (history.length > 30) history.shift();
  $("#undo").disabled = false;
}
function save() {
  clearTimeout(saveTimer);
  $("#save-status").textContent = "جارٍ الحفظ…";
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem("takween-v4", JSON.stringify(state));
      $("#save-status").textContent = "محفوظ على هذا المتصفح";
    } catch {
      $("#save-status").textContent = "تعذّر الحفظ؛ نزّل HTML لحفظ نسخة";
    }
  }, 350);
}
function restore() {
  try {
    const saved = localStorage.getItem("takween-v4");
    if (saved) {
      state = validateProject(JSON.parse(saved));
      return;
    }
    const old = JSON.parse(localStorage.getItem("takween-v1") || "null");
    if (old && Array.isArray(old.items)) {
      state.title = String(old.projectTitle || "");
      state.scenes = old.items.map((x) => ({
        id: uid(),
        title: String(x.title || ""),
        body: String(x.desc || ""),
        layout: "card",
      }));
      state.source = state.scenes
        .map((x) => x.title + "\n" + x.body)
        .join("\n\n");
      state.format =
        old.format === "story"
          ? "slides"
          : old.format === "cards"
            ? "cards"
            : "article";
    }
  } catch {
    notify("تعذّر استعادة النسخة المحفوظة. يمكنك بدء تجربة جديدة.");
  }
}
function count() {
  const n = state.source.trim() ? state.source.trim().split(/\s+/).length : 0;
  $("#word-count").textContent = `${n.toLocaleString("ar")} كلمة`;
}
function paint() {
  document.body.classList.remove("motion-none", "motion-calm");
  if (state.motion !== "expressive")
    document.body.classList.add("motion-" + state.motion);
  $("#motion").textContent =
    state.motion === "none" ? "الحركة متوقفة" : "الحركة مفعّلة";
  $("#motion").setAttribute("aria-pressed", state.motion !== "none");
  index = Math.min(
    index,
    Math.max(0, paginate(state.scenes, state.format).length - 1),
  );
  $("#preview").className =
    `preview theme-${state.theme}${$("#preview-width").getAttribute("aria-pressed") === "true" ? " narrow" : ""}`;
  $("#preview").innerHTML = renderDocument(state, index);
  $("#scene-count").textContent =
    `${state.scenes.length} مشهد · ${paginate(state.scenes, "slides").length} شريحة عند العرض`;
  $("#present").disabled =
    $("#pdf").disabled =
    $("#export").disabled =
      !state.scenes.length;
  if ($("#viewer").open) paintViewer();
}
function sync() {
  $("#project-title").value = state.title;
  $("#source-text").value = state.source;
  $("#format").value = state.format;
  $("#motion-level").value = state.motion;
  $("#content-dir").value = state.dir;
  $$("[data-theme]").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.theme === state.theme),
  );
  count();
  outline();
  paint();
}
function editorTab(name) {
  for (const n of ["source", "outline", "design"])
    $(`#${n}-panel`).hidden = n !== name;
  $$("[data-editor]").forEach((b) =>
    b.setAttribute("aria-selected", b.dataset.editor === name),
  );
}
function panel(name) {
  $(".workspace").dataset.panel = name;
  $$("[data-panel]")
    .filter((x) => x.tagName === "BUTTON")
    .forEach((b) => b.setAttribute("aria-selected", b.dataset.panel === name));
}
function route() {
  const studio = location.hash === "#studio";
  $("#home").hidden = studio;
  $("#studio").hidden = !studio;
  if (studio) {
    paint();
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "instant" }),
    );
  } else if (location.hash === "#inspiration")
    requestAnimationFrame(() => $("#inspiration").scrollIntoView());
}
function outline() {
  const el = $("#scene-list");
  el.replaceChildren();
  const frag = document.createDocumentFragment();
  state.scenes.forEach((s, i) => {
    const details = document.createElement("details");
    details.className = "scene-editor";
    details.dataset.id = s.id;
    details.innerHTML = `<summary><b>${i + 1}</b><span>${e(s.title || s.body.trim().slice(0, 45) || "مشهد جديد")}</span></summary><label for="title-${s.id}">عنوان المشهد</label><input id="title-${s.id}" data-field="title" value="${e(s.title)}" dir="auto"><label for="body-${s.id}">المحتوى</label><textarea id="body-${s.id}" data-field="body" rows="5" dir="auto">${e(s.body)}</textarea><label for="layout-${s.id}">تركيب المشهد</label><select id="layout-${s.id}" data-field="layout">${Object.entries(
      layouts,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${s.layout === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select><div class="scene-tools"><button data-action="up" aria-label="نقل المشهد لأعلى" ${i === 0 ? "disabled" : ""}>↑</button><button data-action="down" aria-label="نقل المشهد لأسفل" ${i === state.scenes.length - 1 ? "disabled" : ""}>↓</button><button data-action="copy">تكرار</button><button data-action="delete">حذف</button></div>`;
    frag.append(details);
  });
  el.append(frag);
}
$("#scene-list").addEventListener("focusin", (ev) => {
  if (ev.target.matches("input,textarea,select")) snapshot();
});
$("#scene-list").addEventListener("input", (ev) => {
  const field = ev.target.dataset.field;
  if (!field) return;
  const s = state.scenes.find(
    (x) => x.id === ev.target.closest("details").dataset.id,
  );
  s[field] = ev.target.value;
  ev.target.closest("details").querySelector("summary span").textContent =
    s.title || s.body.trim().slice(0, 45) || "مشهد جديد";
  paint();
  save();
});
$("#scene-list").addEventListener("click", (ev) => {
  const action = ev.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const id = ev.target.closest("details").dataset.id,
    i = state.scenes.findIndex((x) => x.id === id);
  snapshot();
  if (action === "delete") state.scenes.splice(i, 1);
  if (action === "copy")
    state.scenes.splice(i + 1, 0, { ...state.scenes[i], id: uid() });
  if (action === "up" && i > 0)
    [state.scenes[i - 1], state.scenes[i]] = [
      state.scenes[i],
      state.scenes[i - 1],
    ];
  if (action === "down" && i < state.scenes.length - 1)
    [state.scenes[i + 1], state.scenes[i]] = [
      state.scenes[i],
      state.scenes[i + 1],
    ];
  outline();
  paint();
  save();
  notify(
    action === "delete" ? "حُذف المشهد. يمكنك التراجع." : "تم تحديث المخطط",
  );
});
$("#add-scene").onclick = () => {
  snapshot();
  state.scenes.push({ id: uid(), title: "", body: "", layout: "text" });
  outline();
  const d = $("#scene-list").lastElementChild;
  d.open = true;
  d.querySelector("input").focus();
  paint();
  save();
};
function generate() {
  if (!state.source.trim()) {
    notify("أضف نصًا أولًا لنكوّن تجربتك.");
    $("#source-text").focus();
    return;
  }
  if (state.scenes.length) snapshot();
  state.scenes = parseText(state.source);
  index = 0;
  outline();
  paint();
  save();
  if ($("#review-first").checked) {
    editorTab("outline");
    panel("editor");
  } else panel("preview");
  notify("تكوّن النص دون حذف. يمكنك تعديل المشاهد والمظهر.");
}
$("#generate").onclick = generate;
function loadExample(key) {
  snapshot();
  Object.assign(state, examples[key]);
  state.scenes = parseText(state.source);
  index = 0;
  sync();
  save();
  location.hash = "studio";
  editorTab("outline");
  panel("preview");
  notify("تم تحميل المثال. يمكنك التراجع.");
}
$$("[data-example]").forEach(
  (b) =>
    (b.onclick = () => {
      if (state.source.trim() || state.scenes.length) {
        pendingExample = b.dataset.example;
        $("#confirm").showModal();
      } else loadExample(b.dataset.example);
    }),
);
$("#cancel-confirm").onclick = () => $("#confirm").close();
$("#accept-confirm").onclick = () => {
  $("#confirm").close();
  loadExample(pendingExample);
};
$("#try-demo").onclick = () => {
  if (state.scenes.length) {
    openViewer();
    return;
  }
  loadExample("steps");
  openViewer();
};
$("#project-title").addEventListener("focus", snapshot);
$("#source-text").addEventListener("focus", snapshot);
$("#project-title").oninput = (ev) => {
  state.title = ev.target.value;
  paint();
  save();
};
$("#source-text").oninput = (ev) => {
  state.source = ev.target.value;
  count();
  save();
};
$("#undo").onclick = () => {
  if (!history.length) return;
  state = history.pop();
  $("#undo").disabled = !history.length;
  sync();
  save();
  notify("تمت استعادة الحالة السابقة");
};
$$("[data-editor]").forEach(
  (b) => (b.onclick = () => editorTab(b.dataset.editor)),
);
$$(".mobile-tabs button").forEach(
  (b) => (b.onclick = () => panel(b.dataset.panel)),
);
for (const [selector, key] of [
  ["#format", "format"],
  ["#motion-level", "motion"],
  ["#content-dir", "dir"],
])
  $(selector).onchange = (ev) => {
    snapshot();
    state[key] = ev.target.value;
    index = 0;
    paint();
    save();
  };
$$("[data-theme]").forEach(
  (b) =>
    (b.onclick = () => {
      snapshot();
      state.theme = b.dataset.theme;
      sync();
      save();
    }),
);
$("#motion").onclick = () => {
  state.motion = state.motion === "none" ? "expressive" : "none";
  $("#motion-level").value = state.motion;
  paint();
  save();
};
$("#preview-width").onclick = () => {
  const b = $("#preview-width");
  b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
  paint();
};
function paintViewer() {
  viewerIndex = Math.min(
    viewerIndex,
    Math.max(0, paginate(state.scenes, state.format).length - 1),
  );
  $("#view-content").className = `preview theme-${state.theme}`;
  $("#view-content").innerHTML = renderDocument(state, viewerIndex);
}
function openViewer() {
  if (!state.scenes.length) {
    notify("كوّن نصًا أولًا.");
    return;
  }
  viewerIndex = 0;
  $("#viewer").showModal();
  paintViewer();
}
$("#present").onclick = $("#preview-open").onclick = openViewer;
$("#close-viewer").onclick = () => $("#viewer").close();
$("#viewer").addEventListener("close", () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
});
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#viewer").requestFullscreen();
  } catch {
    notify("ملء الشاشة غير متاح في هذا المتصفح");
  }
};
function navigate(root, delta) {
  const total = paginate(state.scenes, state.format).length;
  if (root === "view")
    viewerIndex = Math.max(0, Math.min(total - 1, viewerIndex + delta));
  else index = Math.max(0, Math.min(total - 1, index + delta));
  root === "view" ? paintViewer() : paint();
}
for (const [sel, root] of [
  ["#preview", "preview"],
  ["#view-content", "view"],
])
  $(sel).onclick = (ev) => {
    const btn = ev.target.closest("[data-step]");
    if (btn) navigate(root, Number(btn.dataset.step));
  };
$("#viewer").addEventListener("keydown", (ev) => {
  if (state.format !== "slides" || ev.target.matches("input,textarea,select"))
    return;
  const rtl = direction(state.title + state.source, state.dir) === "rtl";
  if (["ArrowRight", "ArrowLeft"].includes(ev.key)) {
    ev.preventDefault();
    navigate("view", (ev.key === "ArrowLeft") === rtl ? 1 : -1);
  }
});
// Standalone export embeds styles, fonts, content, and a tiny viewer; never executes user text.
async function exportProject(pdf = false) {
  const popup = pdf ? window.open("", "_blank") : null;
  if (pdf && !popup) {
    notify("اسمح بفتح نافذة الطباعة ثم أعد المحاولة.");
    return;
  }
  const btn = $(pdf ? "#pdf" : "#export");
  btn.disabled = true;
  try {
    const [styles, fonts] = await Promise.all(
      ["styles.css", "fonts.css"].map(async (p) => {
        const r = await fetch(p);
        if (!r.ok) throw Error("asset missing");
        return r.text();
      }),
    );
    const project = JSON.stringify(state)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    const runtime = `const layouts=${JSON.stringify(layouts)};const escapeHTML=${e.toString()};const direction=${direction.toString()};const splitText=${(await import("./core.js")).splitText.toString()};const paginate=${paginate.toString()};const renderDocument=${renderDocument.toString()};const state=JSON.parse(document.getElementById('project').textContent);let index=0;const root=document.getElementById('content');function render(){root.innerHTML=renderDocument(state,index)}function step(n){index=Math.max(0,Math.min(paginate(state.scenes,state.format).length-1,index+n));render()}root.onclick=e=>{const b=e.target.closest('[data-step]');if(b)step(Number(b.dataset.step))};document.addEventListener('keydown',e=>{if(state.format==='slides'&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();step((e.key==='ArrowLeft')===(direction(state.title+state.source,state.dir)==='rtl')?1:-1)}});document.getElementById('motion-toggle').onclick=()=>document.body.classList.toggle('motion-none');render();`;
    const printCSS = `@page{size:${state.format === "slides" ? "A4 landscape" : "A4"};margin:12mm}@media print{html,body{background:var(--surface);-webkit-print-color-adjust:exact;print-color-adjust:exact}.export-header,.slide-controls,.slide-progress{display:none!important}.export-page .preview{padding:0;min-height:0}.print-slide{break-after:page}.print-slide:last-child{break-after:auto}.scene{animation:none!important;box-shadow:none;break-inside:avoid}.format-slides .scene{min-height:120mm}.document{max-width:none}.document-heading{margin:0 0 15px}.document-heading h2{font-size:30px}.scene p{orphans:3;widows:3}}`;
    const printRuntime = `document.getElementById('content').innerHTML=state.format==='slides'?paginate(state.scenes,'slides').map((_,i)=>'<section class="print-slide">'+renderDocument(state,i)+'</section>').join(''):renderDocument(state,0);document.fonts.ready.then(()=>{setTimeout(()=>window.print(),250)});`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(state.title || "تكوين")}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>${fonts}\n${styles}\n${pdf ? printCSS : ""}</style><body class="export-page motion-${state.motion}"><main class="preview theme-${state.theme}"><div class="export-header"><span>تكوين / من كلمات إلى تجربة</span><button id="motion-toggle" class="quiet">تشغيل / إيقاف الحركة</button></div><div id="content"></div></main><script type="application/json" id="project">${project}</script><script>${runtime}\n${pdf ? printRuntime : ""}</script></body></html>`;
    if (pdf) {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      notify(
        "اختر حفظ بصيغة PDF؛ فعّل رسومات الخلفية وأوقف ترويسات المتصفح. PDF ثابت، وHTML يحفظ الحركة.",
      );
      return;
    }
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (state.title || "takween")
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
        .slice(0, 100) + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    notify("تم تجهيز HTML مستقل بالحركة والخطوط والنص الأصلي.");
  } catch {
    popup?.close();
    notify("تعذّر تجهيز الملف. تأكد من تحميل ملفات الموقع ثم حاول مجددًا.");
  } finally {
    btn.disabled = false;
  }
}
$("#export").onclick = () => exportProject(false);
$("#pdf").onclick = () => exportProject(true);
let localBusy = false;
let localCancelled = false;
async function checkAI() {
  aiAvailable =
    typeof Worker !== "undefined" && typeof WebAssembly !== "undefined";
  $("#local-ai").disabled = !aiAvailable;
  $("#ai-status").textContent = aiAvailable
    ? "إعادة صياغة محلية تجريبية. تتطلب تنزيل نموذج بحجم مئات الميغابايت أول مرة؛ لا يُرسل نصك للخادم."
    : "المعالجة المحلية غير مدعومة في هذا المتصفح. التنسيق متاح.";
}
$("#local-ai").onclick = async () => {
  if (localBusy) {
    localCancelled = true;
    (await import("./local-ai.js")).cancelLocalAI();
    return;
  }
  if (!state.source.trim()) {
    notify("أضف النص أولًا.");
    return;
  }
  if (
    !window.confirm(
      "سيتم تنزيل نموذج لغوي على جهازك (مئات الميغابايت) وقد تكون المعالجة بطيئة، خصوصًا على الهاتف. النص لا يُرسل للخادم. النتيجة تجريبية وتحتاج مراجعة. هل تريد المتابعة؟",
    )
  )
    return;
  localBusy = true;
  localCancelled = false;
  const btn = $("#local-ai");
  btn.textContent = "إلغاء المعالجة";
  const source = state.source;
  try {
    const { rewriteLocal } = await import("./local-ai.js");
    const { splitText } = await import("./core.js");
    const chunks = splitText(source, 1800),
      result = [];
    for (let i = 0; i < chunks.length; i++) {
      if (localCancelled) throw Error("cancelled");
      $("#ai-status").textContent =
        `معالجة على جهازك: ${i + 1} / ${chunks.length}`;
      result.push(
        await rewriteLocal(chunks[i], (p) => {
          $("#ai-status").textContent =
            p.status === "progress"
              ? `تنزيل ملفات النموذج: ${Math.round(p.progress || 0)}٪`
              : "جارٍ تجهيز النموذج على جهازك…";
        }),
      );
    }
    if (state.source !== source || localCancelled) throw Error("changed");
    snapshot();
    state.scenes = parseText(result.join("\n\n"));
    outline();
    paint();
    save();
    editorTab("outline");
    panel("editor");
    notify("راجع الصياغة الجديدة. النص الأصلي محفوظ كاملًا في تبويب النص.");
    $("#ai-status").textContent =
      "اكتملت المعالجة المحلية. راجع المعنى قبل المشاركة.";
  } catch {
    notify(
      localCancelled
        ? "أُلغيت المعالجة دون تغيير محتواك."
        : "تعذّر تنزيل النموذج أو تشغيله. لم يتغير المحتوى؛ التنسيق المحلي متاح.",
    );
    $("#ai-status").textContent =
      "المعالجة لم تكتمل. يمكنك إعادة المحاولة أو استخدام التنسيق المحلي.";
  } finally {
    localBusy = false;
    btn.textContent = "إعادة صياغة بذكاء محلي";
  }
};
window.addEventListener("hashchange", route);
window.addEventListener("pagehide", () => {
  try {
    localStorage.setItem("takween-v4", JSON.stringify(state));
  } catch {}
});
restore();
sync();
route();
checkAI();
