# dek-memory Architecture

## Layers

```text
MemoryAdapter / MemoryPort
  ├── SQLite memory backend
  ├── BM25 retrieval
  ├── vector retrieval
  ├── entity graph
  ├── AST graph
  ├── hybrid fusion
  └── maintenance, consolidation and anchors
```

## Data Ownership

Dek Memory owns persistent memory records and retrieval indexes. Agent sessions remain owned by Dek Agent; model routing remains owned by Dek Gateway.

## Design Constraints

- Node.js built-ins only at runtime where practical
- Deterministic fallback when embeddings are unavailable
- Validated paths for file anchors
- Explicit maintenance and retention behavior
