# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**vecgraph** is a hybrid retrieval engine for AI agents. It combines **BM25 keyword search + vector similarity + entity graph + AST graph** over SQLite, with consolidation, decay, file anchors, and eval harness. **Zero runtime dependencies** — pure Node.js 24+ built-ins.

Extracted from Oracle-Ecosystems as a standalone package, now part of the dek ecosystem (vecgraph, dek-agent, dek-gateway).

## Architecture

The memory system is layered:

1. **Storage** (`sqliteMemoryBackend.ts`, `sqliteVectorStore.ts`): SQLite backing with WAL mode, prepared statements
2. **Retrieval routes** (`bm25Store.ts`, `vectorStore.ts`, `entityGraph.ts`, `astGraph.ts`, `hybridRetrieval.ts`):
   - **BM25**: Fast keyword matching (full-text search)
   - **Vector**: Embedding-based similarity (configurable providers: OpenAI, Gemini, Voyage, Ollama)
   - **Entity graph**: Concept relationships extracted from memories
   - **AST graph**: Code structure and dependencies
   - **Hybrid**: Routes queries intelligently through all layers
3. **Maintenance** (`consolidation.ts`, `maintenance.ts`, `reflect.ts`):
   - **Consolidation**: Merge duplicate memories by tag overlap
   - **Decay**: Prune stale entries, promote working memories to insights
   - **Reflect**: LLM-based synthesis of insights
4. **Anchors** (`anchors.ts`): Track memories to exact file + line ranges; verify freshness with git/file mtime

The **adapter** (`adapter.ts`) implements `MemoryPort` interface — a clean boundary for swapping backends (file-based, MCP-backed, remote).

## Development

### Build & Test

```bash
# Install
npm install

# Build (compiles src/ → dist/)
npm run build

# Typecheck (strict mode)
npm run typecheck

# Run all tests
npm test

# Run single test file
npx vitest run src/consolidation.test.ts

# Watch mode (dev)
npx vitest src
```

### Key Files by Task

- **Add a new memory type** → `src/adapter.ts` (MemoryStoreEntry.type), `src/types.ts` (MemoryType export)
- **Tune retrieval scoring** → `src/hybridRetrieval.ts` (weights, thresholds)
- **Add embedding provider** → `src/embeddingProviders.ts` (add class, register in globalRegistry)
- **Fix consolidation bugs** → `src/consolidation.ts` + `src/consolidation.test.ts`
- **Audit retrieval quality** → `src/evalHarness.ts`, `tests/memory/eval.dataset.json`
- **Maintenance cycles** → `src/maintenance.ts`, `src/reflect.ts`

### Testing Strategy

- **Unit tests** cover each module independently (BM25, vector, entity graph, consolidation, etc.)
- **E2E test** (`adapter.e2e.test.ts`) exercises real file I/O, git state, full pipeline
- **Eval harness** (`evalHarness.test.ts`) benchmarks retrieval quality against committed thresholds — see `src/eval.thresholds.json` for acceptable ranges
- **Fixture data**: `tests/memory/eval.dataset.json` contains sample queries + expected results

Current status: **130/130 passing**, including on a fresh clone.

The long-reported "128/130, 2 eval gates need env tuning" was never an eval-quality problem. `evalHarness.test.ts` read its floors from `src/memory/eval.thresholds.json`, but the file committed to the repo is `src/eval.thresholds.json`. On any fresh checkout that `readFile` threw and both eval gates failed. A local, untracked copy at the wrong path had been papering over it.

Fixed by pointing the test at the tracked path and deleting the stray duplicate. If those two tests fail again, check the threshold path before touching retrieval weights.

### Dependencies

**Zero at runtime.** Dev-only: TypeScript, Vitest, Node types.

Uses only Node 24 built-ins: `node:sqlite`, `node:fs`, `node:path`, `node:crypto`, `node:util`, `node:os`.

### Integration Points

- **ChatGPT Saved Memory sync**: not in this package. `chatgptMemoryAdapter.ts` and `hybridMemoryAdapter.ts` remain in Oracle-Ecosystems (`src/memory/`) and were never extracted. The browser-side half now lives in [dek-chatgpt](../dek-chatgpt/CLAUDE.md) (`accountMemory.ts`, `accountMemoryApi.ts`); wiring it to this package is unstarted work.
- **For agents**: Import `MemoryAdapter`, call `remember()`, `recall()`, `searchMemories()`
- **For CLI/MCP**: Wrap adapter in a server; see dek-agent and dek-gateway for patterns

## Common Tasks

### Debug a retrieval issue

1. Check what memories are stored: `memory.getStats()`
2. Run hybrid search with different limits: `memory.searchMemories(query, { limit: 50, type: "fact" })`
3. Check entity graph: `memory.graphQuery(query)` (optional method)
4. Inspect anchor status: `memory.verifyAnchors()`

### Add a new embedding provider

Edit `src/embeddingProviders.ts`:
1. Implement `EmbeddingProvider` interface (embed method)
2. Add class (e.g., `MistralEmbedding`)
3. Register in `globalRegistry` constructor
4. Add env var check (e.g., `MISTRAL_API_KEY`)

### Tune consolidation aggressiveness

Edit `src/consolidation.ts` thresholds:
- `minTagOverlapRatio`: How much tag overlap to consider duplicates (0.5 = 50%)
- `minImportance`: Minimum importance to keep after consolidation

### Run eval harness

```bash
npm run test:eval
```

This runs `evalHarness.test.ts`, which loads `tests/memory/eval.dataset.json` and benchmarks against `src/eval.thresholds.json`.

## Notes for Future Work

1. **Coupling to Oracle gone** — Already decoupled; imports only from `node:*` and local modules
2. **Vector provider abstraction** — Extensible but currently requires explicit env var setup
3. **No MCP server yet** — Will be wrapped by dek-gateway or standalone MCP adapter
4. **Reflect prompt tuning** — `src/reflect.ts` uses hardcoded prompts; could be parameterized
5. **Graph pruning is conservative** — Only removes truly isolated nodes; may accumulate orphan entities over time

## License

MIT — built by Jonus Nattapong (@jonusnattapong)
