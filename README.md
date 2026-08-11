# dek — Open-source AI agent ecosystem

A complete, modular infrastructure for building and running AI agents with persistent memory, multi-provider routing, and tool integration.

## Packages

- **[`dek-memory`](packages/dek-memory/)** — Hybrid retrieval engine (BM25 + vector + entity/AST graph) over SQLite with consolidation, decay, file anchors, and eval harness. Zero runtime dependencies.
- **`dek-agent`** — Agent loop with checkpoints, approval gates, and sandboxing. Merges the best of ClewCode and Oracle.
- **`dek-gateway`** — OpenAI-compatible LLM proxy with multi-provider failover, key pooling, thinking translation (8 model families), and smart caching. From FLUX.
- **`dek-mcp`** — MCP server wrapper for memory, agent, and gateway so any agent (Claude Code, prime-agent, etc.) can use dek services.
- **`dek-cli`** — Terminal UI (Ink + React) and daemon for interactive Q&A, autonomous tasks, and multi-agent coordination.

## Quick Start

```bash
# Install monorepo
npm install

# Build all packages
npm run build

# Test
npm test
```

## Design

- **Decoupled by default** — Each package is usable standalone.
- **Standards-based** — MCP for IDE integration, OpenAI API for LLM compatibility.
- **No lock-in** — Pure TypeScript + Node.js 24 built-ins. No framework bloat.
- **Persistent state** — SQLite + file-based, zero external dependencies.

## License

MIT — built by Jonus Nattapong (@jonusnattapong)
