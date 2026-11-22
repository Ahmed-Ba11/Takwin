import test from "node:test";
import assert from "node:assert/strict";
import { createLibrary, memoryBackend, localStorageBackend, relativeTime } from "../library.js";

const doc = (o = {}) => ({ title: "عنوان", form: "cards", theme: "sand", source: "# أ\nب", ...o });
const lib = () => {
  let t = 1000;
  return createLibrary(memoryBackend(), () => (t += 1000));
};

test("save creates, then updates the same item", async () => {
  const l = lib();
  const a = await l.save(doc());
  assert.ok(a.id && a.createdAt && a.updatedAt);
  const b = await l.save(doc({ id: a.id, title: "جديد" }));
  assert.equal(b.id, a.id);
  assert.equal(b.createdAt, a.createdAt);
  assert.ok(b.updatedAt > a.updatedAt);
  assert.equal(l.count(), 1);
  assert.equal(l.get(a.id).title, "جديد");
});

test("list is newest first; remove returns the item and restore brings it back", async () => {
  const l = lib();
  const a = await l.save(doc({ title: "1" }));
  const b = await l.save(doc({ title: "2" }));
  assert.deepEqual(l.list().map((x) => x.title), ["2", "1"]);
  const gone = await l.remove(b.id);
  assert.equal(gone.title, "2");
  assert.equal(l.count(), 1);
  await l.restore(gone);
  assert.equal(l.count(), 2);
  assert.equal(l.get(a.id).title, "1");
});

test("duplicate makes an independent copy", async () => {
  const l = lib();
  const a = await l.save(doc());
  const c = await l.duplicate(a.id);
  assert.notEqual(c.id, a.id);
  assert.equal(c.source, a.source);
  assert.ok(c.title.includes("نسخة"));
});

test("export/import merges by id and never overwrites newer items", async () => {
  const a = lib();
  const x = await a.save(doc({ title: "قديم" }));
  const json = a.exportAll();
  const b = lib();
  assert.deepEqual(await b.importAll(json), { added: 1, updated: 0, skipped: 0 });
  await b.save({ ...doc({ title: "أحدث" }), id: x.id });
  assert.deepEqual(await b.importAll(json), { added: 0, updated: 0, skipped: 1 });
  assert.equal(b.get(x.id).title, "أحدث");
  const c = lib();
  await c.importAll(json);
  const newer = JSON.parse(json);
  newer.items[0].updatedAt += 10 ** 9;
  newer.items[0].title = "من نسخة أحدث";
  assert.deepEqual(await c.importAll(JSON.stringify(newer)), { added: 0, updated: 1, skipped: 0 });
  assert.equal(c.get(x.id).title, "من نسخة أحدث");
});

test("import rejects foreign files", async () => {
  await assert.rejects(lib().importAll("not json"));
  await assert.rejects(lib().importAll(JSON.stringify({ items: [] })));
});

test("localStorage backend persists and reloads", async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const l1 = createLibrary(localStorageBackend(storage));
  const a = await l1.save(doc());
  const l2 = createLibrary(localStorageBackend(storage));
  await l2.init();
  assert.equal(l2.get(a.id).title, "عنوان");
  await l2.remove(a.id);
  const l3 = createLibrary(localStorageBackend(storage));
  await l3.init();
  assert.equal(l3.count(), 0);
});

test("relative Arabic time", () => {
  const now = 10 ** 10;
  assert.equal(relativeTime(now - 5000, now), "قبل لحظات");
  assert.equal(relativeTime(now - 60000 * 2, now), "قبل دقيقتين");
  assert.equal(relativeTime(now - 60000 * 5, now), "قبل ٥ دقائق");
  assert.equal(relativeTime(now - 3600000, now), "قبل ساعة");
  assert.equal(relativeTime(now - 86400000 * 3, now), "قبل ٣ أيام");
});
