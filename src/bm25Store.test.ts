import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BM25Store } from "./bm25Store.js";

describe("BM25Store", () => {
  let db: DatabaseSync;
  let store: BM25Store;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    BM25Store.init(db);
    store = new BM25Store(db);
  });

  afterEach(() => {
    db.close();
  });

  it("ranks exact phrase coverage above sparse token overlap", () => {
    store.index("phrase", "release checklist owner escalation");
    store.index("sparse", "release notes mention many unrelated details before checklist appears");
    store.index("other", "container runtime configuration");

    const hits = store.search("release checklist", 3);

    expect(hits.map((hit) => hit.memoryId)).toEqual(["phrase", "sparse"]);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });

  it("handles punctuation-heavy user queries without throwing", () => {
    store.index("cpp", "C++ parser migration notes");
    store.index("ci", "CI/CD release pipeline");

    expect(store.search('"C++ parser?', 5).map((hit) => hit.memoryId)).toContain("cpp");
    expect(store.search("CI/CD", 5).map((hit) => hit.memoryId)).toContain("ci");
  });

  it("falls back to prefix matches for partial terms", () => {
    store.index("deploy", "Deployment uses CI pipeline gates");
    store.index("docker", "Docker containers isolate builds");

    expect(store.search("deploy", 2)[0]?.memoryId).toBe("deploy");
  });

  it("updates and removes indexed content by memory id", () => {
    store.index("memory", "old datastore name");
    store.index("memory", "new vector retrieval plan");

    expect(store.search("old", 5)).toHaveLength(0);
    expect(store.search("vector", 5)[0]?.memoryId).toBe("memory");

    store.remove("memory");
    expect(store.search("vector", 5)).toHaveLength(0);
  });
});
