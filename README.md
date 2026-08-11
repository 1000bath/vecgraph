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

## Features

- **Hybrid retrieval** — BM25 keyword + vector similarity + entity graph expansion
- **Consolidation** — Auto-merge duplicate memories by tag overlap
- **Decay & maintenance** — Prune stale entries, promote working memory to insights
- **File anchors** — Track memories to exact code locations; verify freshness
- **Entity graph** — Extract and navigate relations between concepts
- **AST graph** — Map code structure for dependency-aware recall
- **Eval harness** — Benchmark retrieval quality with configurable thresholds
- **No deps** — Pure Node.js: `node:sqlite`, `node:fs`, `node:path`

## Design

- **Decoupled by default** — Each package is usable standalone.
- **Standards-based** — MCP for IDE integration, OpenAI API for LLM compatibility.
- **No lock-in** — Pure TypeScript + Node.js 24 built-ins. No framework bloat.
- **Persistent state** — SQLite + file-based, zero external dependencies.

## License

MIT — built by Jonus Nattapong (@jonusnattapong)
