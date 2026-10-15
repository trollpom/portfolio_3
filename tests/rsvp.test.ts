import assert from "node:assert/strict";
import { test } from "node:test";
import { createBlobDatabase, type RsvpBlobStore } from "../lib/netlify-rsvp-database.ts";
import { postRsvp, getRsvp, deleteRsvp } from "../lib/rsvp-service.ts";

function storage() {
  const rows = new Map<string, unknown>();
  const store: RsvpBlobStore = {
    async get(key) { return structuredClone(rows.get(key) ?? null); },
    async setJSON(key, value, options) {
      assert.equal(options.onlyIfNew, true);
      if (rows.has(key)) return { modified: false };
      rows.set(key, structuredClone(value)); return { modified: true };
    },
    async delete(key) { rows.delete(key); },
  };
  return { rows, store, db: createBlobDatabase(store) };
}
const payload = () => ({ id: crypto.randomUUID(), accessToken: crypto.randomUUID(), fullName: "Тестовый Гость", attendance: "yes", guests: 2, companionNames: "Тестовая Гостья", menu: "vegetarian", drinks: ["nonalcoholic"], notes: "Демонстрационный ответ", consent: true, website: "" });
const post = (data: unknown, origin = "https://wedding.example") => new Request("https://wedding.example/api/rsvp", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(data) });
const own = (data: ReturnType<typeof payload>, method = "GET", token = data.accessToken) => new Request(`https://wedding.example/api/rsvp?id=${data.id}`, { method, headers: { Authorization: `Bearer ${token}` } });
const json = async (response: Response) => await response.json() as { saved?: boolean; duplicate?: boolean; response: { guests: number; fullName: string; companionNames: string; drinks: string[] } };

test("save, retry, restore on another instance, protect and delete one response", async () => {
  const { store, rows, db } = storage(); const data = payload();
  const saved = await postRsvp(post(data), db); assert.equal(saved.status, 201);
  assert.equal(saved.headers.get("Cache-Control"), "no-store");
  const body = await json(saved); assert.equal(body.saved, true); assert.equal(body.response.guests, 2);
  assert.ok(!JSON.stringify(body).includes(data.accessToken));
  assert.ok(!JSON.stringify([...rows.values()]).includes(data.accessToken));
  const retry = await postRsvp(post({ ...data, fullName: "Не перезаписывать" }), createBlobDatabase(store));
  assert.equal(retry.status, 200); assert.equal((await json(retry)).duplicate, true); assert.equal(rows.size, 1);
  const restored = await getRsvp(own(data), createBlobDatabase(store)); assert.equal(restored.status, 200);
  assert.equal((await json(restored)).response.fullName, data.fullName);
  assert.equal((await getRsvp(own(data, "GET", crypto.randomUUID()), db)).status, 404);
  assert.equal((await deleteRsvp(own(data, "DELETE", crypto.randomUUID()), db)).status, 404);
  assert.equal((await postRsvp(post({ ...data, accessToken: crypto.randomUUID() }), db)).status, 409);
  const other = payload(); assert.equal((await postRsvp(post(other), db)).status, 201);
  assert.equal((await deleteRsvp(own(data, "DELETE"), createBlobDatabase(store))).status, 200);
  assert.equal((await getRsvp(own(data), db)).status, 404);
  assert.equal((await getRsvp(own(other), db)).status, 200); assert.equal(rows.size, 1);
});

test("atomic create does not overwrite another caller's response", async () => {
  const { store, rows } = storage(); const first = payload();
  const second = { ...first, accessToken: crypto.randomUUID(), fullName: "Другой Гость" };
  const results = await Promise.all([postRsvp(post(first), createBlobDatabase(store)), postRsvp(post(second), createBlobDatabase(store))]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]); assert.equal(rows.size, 1);
});

test("validation, cross-origin protection, missing storage and decline normalization", async () => {
  const { db } = storage();
  for (const change of [{ fullName: "А" }, { consent: false }, { guests: 5 }, { companionNames: "" }, { drinks: ["red", "red"] }, { website: "spam" }, { attendance: "invalid" }]) {
    assert.equal((await postRsvp(post({ ...payload(), ...change }), db)).status, 400);
  }
  assert.equal((await postRsvp(post(payload(), "https://other.example"), db)).status, 403);
  assert.equal((await postRsvp(post(payload()), undefined)).status, 503);
  assert.equal((await getRsvp(new Request("https://wedding.example/api/rsvp"), db)).status, 404);
  assert.equal((await postRsvp(post({ ...payload(), notes: "x".repeat(9000) }), db)).status, 413);
  const no = { ...payload(), attendance: "no" }; const result = await postRsvp(post(no), db);
  const answer = (await json(result)).response;
  assert.equal(answer.guests, 0); assert.equal(answer.companionNames, ""); assert.deepEqual(answer.drinks, []);
});

test("storage failures never report successful save or deletion", async () => {
  const { store } = storage();
  const broken = createBlobDatabase({ ...store, async setJSON() { throw new Error("offline"); } });
  assert.equal((await postRsvp(post(payload()), broken)).status, 503);
  const lostWrite = createBlobDatabase({ ...store, async setJSON() { return { modified: true }; } });
  const lostResult = await postRsvp(post(payload()), lostWrite);
  assert.notEqual(lostResult.status, 201); assert.ok(!(await json(lostResult)).saved);
  const data = payload(); await postRsvp(post(data), createBlobDatabase(store));
  const lostDelete = createBlobDatabase({ ...store, async delete() {} });
  assert.equal((await deleteRsvp(own(data, "DELETE"), lostDelete)).status, 503);
});
