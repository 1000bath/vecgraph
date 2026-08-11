import { describe, expect, it } from "vitest";
import { HybridRetrieval } from "./hybridRetrieval.js";
import type { BM25Store } from "./bm25Store.js";
import type { SQLiteVectorStore } from "./sqliteVectorStore.js";

describe("HybridRetrieval", () => {
  it("uses a deeper candidate pool before fusion", () => {
    const bm25 = {
      search(_query: string, topK = 10) {
        return Array.from({ length: topK }, (_, index) => ({
          memoryId: `lex-${index}`,
          score: 1 / (index + 1),
        }));
      },
    } as unknown as BM25Store;
    const vector = {
      search(_embedding: number[], topK = 10) {
        return [
          ...Array.from({ length: topK - 1 }, (_, index) => ({
            memoryId: `vec-${index}`,
            score: 1 / (index + 1),
          })),
          { memoryId: "lex-9", score: 0.01 },
        ];
      },
    } as unknown as SQLiteVectorStore;

    const hits = new HybridRetrieval(vector, bm25, 60, 8).search("query", [1], 3);

    expect(hits.map((hit) => hit.memoryId)).toContain("lex-9");
  });

  it("sorts tied fused results deterministically", () => {
    const bm25 = {
      search() {
        return [{ memoryId: "b", score: 1 }];
      },
    } as unknown as BM25Store;
    const vector = {
      search() {
        return [{ memoryId: "a", score: 1 }];
      },
    } as unknown as SQLiteVectorStore;

    expect(new HybridRetrieval(vector, bm25).search("query", [1], 2).map((hit) => hit.memoryId)).toEqual(["a", "b"]);
  });
});
