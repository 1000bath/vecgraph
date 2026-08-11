import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SQLiteVectorStore } from "./sqliteVectorStore.js";

describe("SQLiteVectorStore", () => {
  let db: DatabaseSync;
  let store: SQLiteVectorStore;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    SQLiteVectorStore.init(db);
    store = new SQLiteVectorStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("orders vectors by cosine similarity with stable positive scores", () => {
    store.index("near", [1, 0, 0]);
    store.index("far", [0, 1, 0]);
    store.index("also-near", [0.8, 0.2, 0]);

    const hits = store.search([1, 0, 0], 3);

    expect(hits.map((hit) => hit.memoryId)).toEqual(["near", "also-near"]);
    expect(hits[0]!.score).toBeCloseTo(1);
    expect(hits[1]!.score).toBeGreaterThan(0.9);
  });

  it("penalizes dimension mismatches instead of over-ranking common prefixes", () => {
    store.index("same-dim", [1, 0, 0]);
    store.index("short-prefix", [1]);

    const hits = store.search([1, 0, 0], 2);

    expect(hits.map((hit) => hit.memoryId)).toEqual(["same-dim", "short-prefix"]);
    expect(hits[1]!.score).toBeLessThan(hits[0]!.score);
  });

  it("ignores zero, invalid, and corrupted vectors during search", () => {
    store.index("zero", [0, 0, 0]);
    store.index("invalid", [0, Number.NaN, 1]);
    store.index("valid", [0, 0, 1]);
    db.prepare(`
      INSERT INTO memory_embeddings (id, memory_id, vector, dimension, magnitude, updated_at)
      VALUES ('bad', 'bad', ?, 1, 1, '2026-01-01T00:00:00.000Z')
    `).run(Buffer.from([1, 2, 3]));

    expect(store.search([0, 0, 1], 5).map((hit) => hit.memoryId)).toEqual(["valid"]);
  });

  it("upserts and removes embeddings by memory id", () => {
    store.index("memory", [1, 0]);
    store.index("memory", [0, 1]);

    expect(store.search([1, 0], 1)).toHaveLength(0);
    expect(store.search([0, 1], 1)[0]?.memoryId).toBe("memory");

    store.remove("memory");
    expect(store.count()).toBe(0);
  });
});
