import { DatabaseSync } from "node:sqlite";

export interface BM25Result {
  memoryId: string;
  score: number;
}

interface BM25Row {
  memory_id: string;
  content: string;
  rank: number;
}

interface ScoredBM25Row {
  memoryId: string;
  score: number;
}

const TOKEN_PATTERN = /[\p{L}\p{N}_]+/gu;

function queryTokens(query: string): string[] {
  return [...new Set(query.toLowerCase().match(TOKEN_PATTERN) ?? [])];
}

function quoteFtsToken(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * BM25 full-text search using SQLite FTS5.
 * Native SQLite FTS5 provides BM25 ranking out of the box.
 */
export class BM25Store {
  constructor(private db: DatabaseSync) {}

  /** Initialize FTS5 virtual table. */
  static init(db: DatabaseSync): void {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_content_search USING fts5(
        content,
        memory_id UNINDEXED
      );
    `);
  }

  /** Index memory content for BM25. */
  index(memoryId: string, content: string): void {
    // Remove old entry if exists
    this.db.prepare(
      "DELETE FROM memory_content_search WHERE memory_id = ?"
    ).run(memoryId);

    // Insert new entry
    this.db.prepare(`
      INSERT INTO memory_content_search (memory_id, content)
      VALUES (?, ?)
    `).run(memoryId, content);
  }

  /** Remove indexed content. */
  remove(memoryId: string): void {
    this.db.prepare("DELETE FROM memory_content_search WHERE memory_id = ?").run(memoryId);
  }

  /** Search using BM25 ranking. Returns scored results sorted by relevance. */
  search(query: string, topK = 10): BM25Result[] {
    if (!query.trim() || !Number.isFinite(topK) || topK <= 0) return [];
    const limit = Math.floor(topK);

    const tokens = queryTokens(query);
    if (!tokens.length) return [];

    const candidateLimit = Math.max(limit * 8, 64);
    const exactPhrase = normalizeText(query);
    const attempts = this.buildMatchQueries(query, tokens);
    const byId = new Map<string, ScoredBM25Row>();

    for (const matchQuery of attempts) {
      let rows: BM25Row[];
      try {
        rows = this.runSearch(matchQuery, candidateLimit);
      } catch {
        continue;
      }

      for (const row of rows) {
        const score = this.scoreRow(row, tokens, exactPhrase);
        const current = byId.get(row.memory_id);
        if (!current || score > current.score) {
          byId.set(row.memory_id, { memoryId: row.memory_id, score });
        }
      }
    }

    return [...byId.values()]
      .sort((a, b) => b.score - a.score || a.memoryId.localeCompare(b.memoryId))
      .slice(0, limit);
  }

  private runSearch(matchQuery: string, limit: number): BM25Row[] {
    return this.db.prepare(`
      SELECT memory_id, content, bm25(memory_content_search) AS rank
      FROM memory_content_search
      WHERE memory_content_search MATCH ?
      ORDER BY rank ASC
      LIMIT ?
    `).all(matchQuery, limit) as unknown as BM25Row[];
  }

  private buildMatchQueries(rawQuery: string, tokens: string[]): string[] {
    const queries = new Set<string>();
    const phrase = normalizeText(rawQuery);
    if (phrase.includes(" ")) queries.add(quoteFtsToken(phrase));

    const quotedTokens = tokens.map(quoteFtsToken);
    queries.add(quotedTokens.join(" "));
    queries.add(quotedTokens.join(" OR "));

    const prefixTokens = tokens
      .filter((token) => token.length >= 3)
      .map((token) => `${token}*`);
    if (prefixTokens.length) {
      queries.add(prefixTokens.join(" OR "));
    }

    return [...queries];
  }

  private scoreRow(row: BM25Row, tokens: string[], exactPhrase: string): number {
    const content = normalizeText(row.content);
    const rawBm25 = Math.max(0, -row.rank);
    const matchedTokens = tokens.filter((token) => content.includes(token));
    const coverage = matchedTokens.length / tokens.length;
    const phraseBoost = exactPhrase.length > 0 && content.includes(exactPhrase) ? 0.35 : 0;
    const densityBoost = Math.min(0.2, matchedTokens.length / Math.max(8, content.split(" ").length));

    return rawBm25 + coverage + phraseBoost + densityBoost;
  }

  /** Search with phrase matching (strict). */
  phraseSearch(query: string, topK = 10): BM25Result[] {
    if (!query.trim() || !Number.isFinite(topK) || topK <= 0) return [];
    const phrase = normalizeText(query);
    if (!phrase) return [];
    const rows = this.runSearch(quoteFtsToken(phrase), Math.floor(topK));
    return rows.map((row) => ({
      memoryId: row.memory_id,
      score: this.scoreRow(row, queryTokens(query), phrase),
    }));
  }

  /** Get document count. */
  count(): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM memory_content_search"
    ).get() as { cnt: number };
    return row.cnt;
  }

  /** Clear all indexed content (for migrations). */
  clear(): void {
    this.db.prepare("DELETE FROM memory_content_search").run();
  }
}
