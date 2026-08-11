# dek-memory Development

## Prerequisites

Node.js 24+ is required for `node:sqlite`.

## Setup and Validation

```bash
npm ci
npm run typecheck
npm run build
npm test
```

The evaluation dataset and thresholds are committed fixtures. Retrieval changes should be checked against unit, integration, and evaluation tests.

## Ownership

This package owns memory storage, BM25/vector retrieval, entity and AST graphs, consolidation, decay, maintenance, reflection, and file anchors.
