import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

export interface VectorRecord {
  memoryId: string;
  embedding: number[];
  updatedAt: string;
}

interface VectorRow {
  memory_id: string;
  vector: Buffer;
  dimension?: number | null;
  magnitude?: number | null;
}

interface ScoredVectorResult {
  memoryId: string;
  score: number;
}

/** SQLite-backed vector store with compact binary embeddings and cosine search. */
export class SQLiteVectorStore {
  constructor(private db: DatabaseSync) {}

  /** Initialize schema if needed. */
  static init(db: DatabaseSync): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL UNIQUE,
        vector BLOB NOT NULL,
        dimension INTEGER,
        magnitude REAL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS memory_embeddings_memory_idx
        ON memory_embeddings(memory_id);
    `);
    this.ensureColumn(db, "dimension", "INTEGER");
    this.ensureColumn(db, "magnitude", "REAL");
  }

  /** Index a memory with its embedding. Upserts if exists. */
  index(memoryId: string, embedding: number[]): void {
    const vector = SQLiteVectorStore.toFloat32Vector(embedding);
    if (!memoryId || !vector) return;

    const id = crypto.randomUUID();
    const vectorBlob = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
    const magnitude = SQLiteVectorStore.magnitude(vector);
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO memory_embeddings (id, memory_id, vector, dimension, magnitude, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(memory_id) DO UPDATE SET
        id = excluded.id,
        vector = excluded.vector,
        dimension = excluded.dimension,
        magnitude = excluded.magnitude,
        updated_at = excluded.updated_at
    `).run(id, memoryId, vectorBlob, vector.length, magnitude, now);
  }

  /** Remove a memory's embedding. */
  remove(memoryId: string): void {
    this.db.prepare("DELETE FROM memory_embeddings WHERE memory_id = ?").run(memoryId);
  }

  /** Search for top-k similar embeddings using cosine similarity. */
  search(queryEmbedding: number[], topK = 10): { memoryId: string; score: number }[] {
    if (!Number.isFinite(topK) || topK <= 0) return [];
    const query = SQLiteVectorStore.toFloat32Vector(queryEmbedding);
    if (!query) return [];
    const queryMagnitude = SQLiteVectorStore.magnitude(query);
    if (queryMagnitude === 0) return [];

    const rows = this.db.prepare(`
      SELECT memory_id, vector, dimension, magnitude FROM memory_embeddings
      ORDER BY memory_id
    `).all() as unknown as VectorRow[];

    const scored: ScoredVectorResult[] = [];
    for (const row of rows) {
      const storedEmbedding = SQLiteVectorStore.decode(row.vector);
      if (storedEmbedding.length === 0) continue;

      const storedMagnitude = row.magnitude && row.magnitude > 0
        ? row.magnitude
        : SQLiteVectorStore.magnitude(storedEmbedding);
      const score = SQLiteVectorStore.cosineSimilarity(query, queryMagnitude, storedEmbedding, storedMagnitude);
      if (Number.isFinite(score) && score > 0) {
        scored.push({ memoryId: row.memory_id, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score || a.memoryId.localeCompare(b.memoryId))
      .slice(0, Math.floor(topK));
  }

  private static ensureColumn(db: DatabaseSync, name: string, type: string): void {
    const columns = db.prepare("PRAGMA table_info(memory_embeddings)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE memory_embeddings ADD COLUMN ${name} ${type}`);
    }
  }

  private static decode(vector: Buffer): Float32Array {
    const bytes = vector as Uint8Array;
    const start = bytes.byteOffset;
    const end = start + bytes.byteLength;
    if (bytes.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) return new Float32Array();
    return new Float32Array(bytes.buffer.slice(start, end));
  }

  private static toFloat32Vector(values: number[]): Float32Array | null {
    if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return null;
    return new Float32Array(values);
  }

  private static magnitude(vector: Float32Array): number {
    let norm = 0;
    for (const value of vector) norm += value * value;
    return Math.sqrt(norm);
  }

  private static cosineSimilarity(
    a: Float32Array,
    normA: number,
    b: Float32Array,
    normB: number
  ): number {
    let dotProduct = 0;

    // Providers can occasionally change dimensions; compare only the common
    // prefix and penalize the score for mismatched vector lengths.
    const length = Math.min(a.length, b.length);
    if (length === 0 || normA === 0 || normB === 0) return 0;

    for (let i = 0; i < length; i++) {
      dotProduct += a[i]! * b[i]!;
    }

    const dimensionPenalty = length / Math.max(a.length, b.length);
    return (dotProduct / (normA * normB)) * dimensionPenalty;
  }

  /** Get embedding count. */
  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM memory_embeddings").get() as {
      cnt: number;
    };
    return row.cnt;
  }

  /** Get a record by memory ID. */
  getRecord(memoryId: string): VectorRecord | null {
    const row = this.db.prepare(`
      SELECT memory_id, vector, updated_at FROM memory_embeddings WHERE memory_id = ?
    `).get(memoryId) as { memory_id: string; vector: Buffer; updated_at: string } | undefined;

    if (!row) return null;
    const embedding = Array.from(SQLiteVectorStore.decode(row.vector));
    return {
      memoryId: row.memory_id,
      embedding,
      updatedAt: row.updated_at
    };
  }
}
