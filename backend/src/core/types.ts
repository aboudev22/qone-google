export type AccountType = "company" | "individual";
export type WorkspaceType = "company" | "personal";
export type Role = "owner" | "admin" | "member";
export type ModuleKey = "crm" | "sales" | "stock" | "projects";
export type LogCategory = "team" | "projects" | "stock" | "crm" | "sales" | "settings";

export type ProjectStatus = "active" | "paused" | "completed";
export type ProjectRole = "lead" | "contributor";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type StockMovementType = "in" | "out" | "adjustment";
export type ClientStatus = "active" | "prospect" | "inactive";
export type OpportunityStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface SqlStatement {
  sql: string;
  params?: unknown[];
}

export interface DbAdapter {
  queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryFirst<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  batch(statements: SqlStatement[]): Promise<void>;
}

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body: unknown;
  origin: string | null;
  isHttps: boolean;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  setCookie?: string;
}

export interface RuntimeConfig {
  sessionSecret: string;
  runtimeName: "express" | "cloudflare-worker";
  allowedOrigins: string[];
}
