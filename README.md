# dek-memory

Hybrid memory engine for AI agents — **BM25 + vector + entity/AST graph retrieval** over SQLite with consolidation, decay, file anchors, and eval harness. **Zero runtime dependencies** (Node 24 built-ins only).

## Quick Start

```bash
# Install
npm install dek-memory

# Use
import { MemoryAdapter } from "dek-memory";

const memory = new MemoryAdapter(".oracle-memory");
await memory.remember("agent", "fact", "Important insight about the codebase");

const results = await memory.recall({ type: "fact", limit: 10 });
const searched = await memory.searchMemories("search query");
```

SQLite-backed hybrid search is enabled when you provide a `node:sqlite` database:

```ts
import { DatabaseSync } from "node:sqlite";
import { MemoryAdapter } from "dek-memory";

const db = new DatabaseSync(".oracle-memory/memory.db");
const memory = new MemoryAdapter(process.cwd());
memory.initWithDatabase(db);

await memory.remember("agent", "fact", "Postgres owns transactional data", {
  tags: ["database", "postgres"],
});

const hits = await memory.searchMemories("postgres database", { type: "fact", limit: 5 });

// Keep the database open for the lifetime of the adapter, then close it on shutdown.
db.close();
```

`remember()` persists the memory to `.oracle-memory/` and updates the SQLite FTS5 index immediately. Embeddings are generated asynchronously when an embedding provider is configured; without one, BM25 search remains available.

## Features

- **Integration-tested lifecycle** — real file storage plus SQLite indexing is covered by `src/adapter.e2e.test.ts`.

- **Hybrid retrieval** — BM25 keyword + vector similarity + entity graph expansion
- **Consolidation** — Auto-merge duplicate memories by tag overlap
- **Decay & maintenance** — Prune stale entries, promote working memory to insights
- **File anchors** — Track memories to exact code locations; verify freshness
- **Entity graph** — Extract and navigate relations between concepts
- **AST graph** — Map code structure for dependency-aware recall
- **Eval harness** — Benchmark retrieval quality with configurable thresholds
- **No deps** — Pure Node.js: `node:sqlite`, `node:fs`, `node:path`

## Search Behavior

`searchMemories(query)` prefers the SQLite hybrid backend when initialized, then falls back to an in-process lexical scorer. Results are filtered through live memory files, so archived, pruned, superseded, missing-anchor, agent, and type filters still apply.

BM25 search:

- Uses SQLite FTS5 with sanitized query parsing, so punctuation-heavy queries such as `CI/CD`, `C++`, or unmatched quotes do not fail the search.
- Runs exact phrase, all-token, OR-token, and prefix-token attempts, then merges candidates.
- Re-ranks candidates with BM25 rank, query-term coverage, phrase matches, and term density.
- Indexes tags alongside content through `MemoryAdapter`, so tag-only matches can rank.

Vector search:

- Stores embeddings as compact `Float32Array` blobs with dimension and magnitude metadata.
- Computes the query magnitude once per search and scores directly against decoded typed arrays.
- Ignores invalid, zero, and corrupted vectors instead of letting them pollute the result set.
- Penalizes dimension mismatches so a short common prefix does not outrank a full matching vector.

Hybrid retrieval:

- Uses Reciprocal Rank Fusion over deeper BM25 and vector candidate pools before truncating to `limit`.
- Sorts ties deterministically by memory id for stable tests and reproducible recall.
- Falls back to BM25 if embedding generation is unavailable or fails.

## Performance Notes

- `remember()` updates the BM25 index synchronously and vector embeddings asynchronously, so writes stay responsive even if an embedder is slow.
- `updateMemory()` refreshes lexical index rows for content or tag changes and refreshes vectors for content changes.
- `forget()` and `clearWorking()` remove matching SQLite search rows.
- For large stores, initialize with SQLite and keep a long-lived database connection open instead of relying on filesystem-only fallback search.

## Development

```bash
npm run typecheck
npm test
```

The package uses strict TypeScript with additional checks for casing, switch fallthrough, override declarations, and side-effect imports. The test suite includes focused ranking coverage for BM25, vector similarity, hybrid fusion, adapter recall scope, consolidation, maintenance, anchors, and graph behavior.

## Design

- **Decoupled by default** — Each package is usable standalone.
- **Standards-based** — MCP for IDE integration, OpenAI API for LLM compatibility.
- **No lock-in** — Pure TypeScript + Node.js 24 built-ins. No framework bloat.
- **Persistent state** — SQLite + file-based, zero external dependencies.

## License

MIT — built by Jonus Nattapong (@jonusnattapong)
