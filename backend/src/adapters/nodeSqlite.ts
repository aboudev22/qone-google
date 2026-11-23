import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { DbAdapter, SqlStatement } from "../core/types.js";

export function createNodeSqliteAdapter(dbFilePath: string): DbAdapter {
  const resolved = path.resolve(dbFilePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new DatabaseSync(resolved);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  const toSqlParams = (params: unknown[] = []): SQLInputValue[] =>
    params.map((p) => {
      if (p === undefined || p === null) return null;
      if (typeof p === "boolean") return p ? 1 : 0;
      return p as SQLInputValue;
    });

  return {
    async queryAll<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T[]> {
      const stmt = db.prepare(sql);
      return stmt.all(...toSqlParams(params)) as T[];
    },

    async queryFirst<T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ): Promise<T | null> {
      const stmt = db.prepare(sql);
      const row = stmt.get(...toSqlParams(params)) as T | undefined;
      return row ?? null;
    },

    async execute(
      sql: string,
      params: unknown[] = [],
    ): Promise<{ changes: number }> {
      const stmt = db.prepare(sql);
      const info = stmt.run(...toSqlParams(params));
      return { changes: Number(info.changes ?? 0) };
    },

    async batch(statements: SqlStatement[]): Promise<void> {
      db.exec("BEGIN");
      try {
        for (const item of statements) {
          const stmt = db.prepare(item.sql);
          stmt.run(...toSqlParams(item.params));
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  };
}
