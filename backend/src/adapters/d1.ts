import type { DbAdapter, SqlStatement } from "../core/types.js";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

function normalizeParams(params: unknown[] = []): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p;
  });
}

export function createD1Adapter(d1: D1DatabaseLike): DbAdapter {
  return {
    async queryAll<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T[]> {
      const res = await d1
        .prepare(sql)
        .bind(...normalizeParams(params))
        .all<T>();
      return res.results ?? [];
    },

    async queryFirst<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T | null> {
      const row = await d1
        .prepare(sql)
        .bind(...normalizeParams(params))
        .first<T>();
      return row ?? null;
    },

    async execute(
      sql: string,
      params: unknown[] = [],
    ): Promise<{ changes: number }> {
      const res = await d1
        .prepare(sql)
        .bind(...normalizeParams(params))
        .run();
      return { changes: Number(res.meta?.changes ?? 0) };
    },

    async batch(statements: SqlStatement[]): Promise<void> {
      if (statements.length === 0) return;
      const prepared = statements.map((s) =>
        d1.prepare(s.sql).bind(...normalizeParams(s.params)),
      );
      await d1.batch(prepared);
    },
  };
}
