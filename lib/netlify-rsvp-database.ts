import { getStore } from "@netlify/blobs";
import type { RsvpDatabase } from "./rsvp-service.ts";

type Row = Record<string, unknown> & { id: string; access_token_hash: string };

export type RsvpBlobStore = {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  setJSON(key: string, value: unknown, options: { onlyIfNew: true }): Promise<{ modified: boolean }>;
  delete(key: string): Promise<unknown>;
};

// A narrow adapter for the three statements used by rsvp-service. It is not a
// general SQL engine; it preserves the existing validation and HTTP contract.
export function createBlobDatabase(store: RsvpBlobStore): RsvpDatabase {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const id = String(values[0]);
          const key = `responses/${id}.json`;
          return {
            async first<T>() {
              if (!sql.startsWith("SELECT ")) throw new Error("Unsupported query");
              return await store.get(key, { type: "json" }) as T | null;
            },
            async run() {
              if (sql.startsWith("INSERT INTO rsvps ")) {
                const columns = ["id", "access_token_hash", "full_name", "attendance", "guests", "companion_names", "menu", "drinks", "notes", "consent_at", "created_at"];
                const row = Object.fromEntries(columns.map((column, i) => [column, values[i]]));
                // Atomic create: concurrent retries cannot overwrite a response.
                const result = await store.setJSON(key, row, { onlyIfNew: true });
                return { success: true, meta: { changes: result.modified ? 1 : 0 } };
              }
              if (sql === "DELETE FROM rsvps WHERE id = ? AND access_token_hash = ?") {
                const existing = await store.get(key, { type: "json" }) as Row | null;
                if (!existing || existing.access_token_hash !== values[1]) return { success: true, meta: { changes: 0 } };
                await store.delete(key);
                // Do not claim deletion if the backing service failed silently.
                if (await store.get(key, { type: "json" }) !== null) throw new Error("Delete not confirmed");
                return { success: true, meta: { changes: 1 } };
              }
              throw new Error("Unsupported statement");
            },
          };
        },
      };
    },
  };
}

export function netlifyRsvpDatabase(): RsvpDatabase | undefined {
  try {
    // The current Netlify Next.js adapter supplies the Blobs context. A
    // site-wide store survives new deployments. No browser token or PAT needed.
    const store = getStore({ name: "wedding-rsvp", consistency: "strong" });
    return createBlobDatabase(store);
  } catch {
    // Local `next dev` without Netlify context must fail honestly, not pretend
    // to save to volatile process memory.
    return undefined;
  }
}
