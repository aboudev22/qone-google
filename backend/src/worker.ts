import { createD1Adapter, type D1DatabaseLike } from "./adapters/d1.js";
import { ensureSchema } from "./core/db.js";
import { handleApiRequest } from "./core/router.js";
import type { ApiRequest, RuntimeConfig } from "./core/types.js";

export interface WorkerEnv {
  DB: D1DatabaseLike;
  SESSION_SECRET?: string;
  CORS_ORIGIN?: string;
}

let schemaInitialized = false;
let fallbackSecret: string | null = null;

function getSessionSecret(env: WorkerEnv): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.trim()) {
    return env.SESSION_SECRET.trim();
  }
  return "qone-erp-default-session-hmac-secret-cf-workers-2026";
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeadersFor(
  origin: string | null,
  requestUrl: URL,
  allowedOrigins: string[],
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Company-Id, X-Requested-With",
  };

  if (origin) {
    let allowed = false;
    try {
      const parsed = new URL(origin);
      if (parsed.host === requestUrl.host) allowed = true;
    } catch {
      allowed = false;
    }
    if (!allowed && allowedOrigins.includes(origin)) {
      allowed = true;
    }
    if (allowed) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
      headers["Vary"] = "Origin";
    }
  }

  return headers;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);
    const cors = corsHeadersFor(origin, url, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const db = createD1Adapter(env.DB);
    if (!schemaInitialized) {
      await ensureSchema(db);
      schemaInitialized = true;
    }

    let body: unknown = undefined;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = await request.json();
        } catch {
          body = {};
        }
      }
    }

    const normalizedHeaders: Record<string, string | undefined> = {};
    request.headers.forEach((value, key) => {
      normalizedHeaders[key.toLowerCase()] = value;
    });

    const apiReq: ApiRequest = {
      method: request.method.toUpperCase(),
      path: url.pathname,
      query: url.searchParams,
      headers: normalizedHeaders,
      body,
      origin,
      isHttps: url.protocol === "https:",
    };

    const config: RuntimeConfig = {
      sessionSecret: getSessionSecret(env),
      runtimeName: "cloudflare-worker",
      allowedOrigins,
    };

    const result = await handleApiRequest(apiReq, db, config);
    const responseHeaders = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      ...cors,
      ...(result.headers || {}),
    });
    if (result.setCookie) {
      responseHeaders.append("Set-Cookie", result.setCookie);
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: responseHeaders,
    });
  },
};
