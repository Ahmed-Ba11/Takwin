// «مدونتي»: personal library saved on this device (IndexedDB, falling back to localStorage).
// Everything goes through createLibrary(backend), so a server backend can replace storage later.
import { sanitizeState, localDigits } from "./core.js";

const DB = "takween-library";
const STORE = "docs";
const LS_KEY = "takween-library-ls";

/* ---------- Backends: { all(), put(item), remove(id) } ---------- */
export function memoryBackend() {
  const m = new Map();
  return {
    kind: "memory",
    async all() {
      return [...m.values()].map((x) => ({ ...x }));
    },
    async put(item) {
      m.set(item.id, { ...item });
    },
    async remove(id) {
      m.delete(id);
    },
  };
}

export function localStorageBackend(storage = globalThis.localStorage) {
  const read = () => {
    try {
      return JSON.parse(storage.getItem(LS_KEY)) || [];
    } catch {
      return [];
    }
  };
  const write = (items) => storage.setItem(LS_KEY, JSON.stringify(items));
  return {
    kind: "localStorage",
    async all() {
      return read();
    },
    async put(item) {
      write([...read().filter((x) => x.id !== item.id), item]);
    },
    async remove(id) {
      write(read().filter((x) => x.id !== id));
    },
  };
}

function idbBackend() {
  const open = () =>
    new Promise((ok, fail) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((ok, fail) => {
      const tx = db.transaction(STORE, mode);
      const out = fn(tx.objectStore(STORE));
      tx.oncomplete = () => (db.close(), ok(out.result));
      tx.onerror = () => (db.close(), fail(tx.error));
    });
  };
  return {
    kind: "indexedDB",
    all: () => run("readonly", (s) => s.getAll()),
    put: (item) => run("readwrite", (s) => s.put(item)),
    remove: (id) => run("readwrite", (s) => s.delete(id)),
  };
}

export async function autoBackend() {
  try {
    if (!globalThis.indexedDB) throw new Error("no idb");
    const b = idbBackend();
    await b.all();
    return b;
  } catch {
    return localStorageBackend();
  }
}

/* ---------- Items ---------- */
const newId = () =>
  globalThis.crypto?.randomUUID?.() || `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function cleanItem(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const s = sanitizeState(raw);
  const now = Date.now();
  const createdAt = Number(raw.createdAt) || now;
  return {
    id: String(raw.id),
    title: s.title,
    form: s.form,
    theme: s.theme,
    source: s.source,
    createdAt,
    updatedAt: Number(raw.updatedAt) || createdAt,
  };
}

export function createLibrary(backend, clock = Date.now) {
  const items = new Map();
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => f());
  let ready = null;
  const init = () =>
    (ready ??= backend.all().then((all) => {
      for (const raw of all) {
        const it = cleanItem(raw);
        if (it) items.set(it.id, it);
      }
      emit();
    }));
  const sorted = () => [...items.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return {
    init,
    kind: backend.kind,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    list: sorted,
    count: () => items.size,
    get: (id) => items.get(id) || null,
    /** Creates the item (no id) or updates it. */
    async save({ id, title = "", form, theme, source = "" }) {
      await init();
      const now = clock();
      const old = id ? items.get(id) : null;
      const it = cleanItem({ id: old?.id || id || newId(), title, form, theme, source, createdAt: old?.createdAt || now, updatedAt: now });
      await backend.put(it);
      items.set(it.id, it);
      emit();
      return it;
    },
    /** Returns the removed item so the caller can offer undo with restore(). */
    async remove(id) {
      await init();
      const it = items.get(id);
      if (!it) return null;
      await backend.remove(id);
      items.delete(id);
      emit();
      return it;
    },
    async restore(item) {
      await init();
      await backend.put(item);
      items.set(item.id, item);
      emit();
      return item;
    },
    async duplicate(id) {
      await init();
      const src = items.get(id);
      if (!src) return null;
      return this.save({ ...src, id: undefined, title: src.title ? `${src.title} (نسخة)` : "(نسخة)" });
    },
    exportAll() {
      return JSON.stringify({ app: "takween", version: 1, exportedAt: clock(), items: sorted() }, null, 1);
    },
    /** Merges by id. A newer item already here is never overwritten. */
    async importAll(json) {
      await init();
      let data;
      try {
        data = JSON.parse(json);
      } catch {
        throw new Error("الملف ليس نسخة احتياطية صالحة");
      }
      if (!data || data.app !== "takween" || !Array.isArray(data.items)) throw new Error("الملف ليس نسخة احتياطية من تكوين");
      const r = { added: 0, updated: 0, skipped: 0 };
      for (const raw of data.items) {
        const it = cleanItem(raw);
        if (!it) continue;
        const have = items.get(it.id);
        if (have && have.updatedAt >= it.updatedAt) {
          r.skipped++;
          continue;
        }
        await backend.put(it);
        items.set(it.id, it);
        have ? r.updated++ : r.added++;
      }
      emit();
      return r;
    },
  };
}

/* ---------- Relative Arabic dates ---------- */
function unit(n, one, two, few, many) {
  const num = localDigits(n);
  return n === 1 ? one : n === 2 ? two : n <= 10 ? `${num} ${few}` : `${num} ${many}`;
}
export function relativeTime(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "قبل لحظات";
  const m = Math.round(s / 60);
  if (m < 60) return "قبل " + unit(m, "دقيقة", "دقيقتين", "دقائق", "دقيقة");
  const h = Math.round(m / 60);
  if (h < 24) return "قبل " + unit(h, "ساعة", "ساعتين", "ساعات", "ساعة");
  const d = Math.round(h / 24);
  if (d < 30) return "قبل " + unit(d, "يوم", "يومين", "أيام", "يومًا");
  return new Date(ts).toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" });
}

export const library = createLibrary({
  kind: "pending",
  all: async () => (await (backendPromise ??= autoBackend())).all(),
  put: async (i) => (await (backendPromise ??= autoBackend())).put(i),
  remove: async (id) => (await (backendPromise ??= autoBackend())).remove(id),
});
let backendPromise;
