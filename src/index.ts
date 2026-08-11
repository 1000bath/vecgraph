/**
 * dek-memory — hybrid memory engine for AI agents.
 *
 * BM25 + vector + entity/AST graph retrieval over SQLite (node:sqlite),
 * with consolidation, decay, file anchors, and an eval harness.
 */

export * from "./port.js";
export * from "./adapter.js";
export * from "./anchors.js";
export * from "./astGraph.js";
export * from "./bm25Store.js";
export * from "./consolidation.js";
export * from "./embeddingProviders.js";
export * from "./entityGraph.js";
export * from "./evalHarness.js";
export * from "./hybridRetrieval.js";
export * from "./maintenance.js";
export * from "./reflect.js";
export * from "./sqliteMemoryBackend.js";
export * from "./sqliteVectorStore.js";
export * from "./vectorStore.js";
