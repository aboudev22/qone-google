import express, { type Express, type Request, type Response } from "express";
import { handleApiRequest } from "./core/router.js";
import type { ApiRequest, DbAdapter, RuntimeConfig } from "./core/types.js";

function isOriginAllowed(
  origin: string | undefined,
  req: Request,
  allowedOrigins: string[],
): string | null {
  if (!origin) return null;
  // Allow exact same-origin requests
  const host = req.get("x-forwarded-host") || req.get("host");
  if (host) {
    try {
      const parsed = new URL(origin);
      if (parsed.host === host) {
        return origin;
      }
    } catch {
      return null;
    }
  }
  if (allowedOrigins.includes(origin)) {
    return origin;
  }
  return null;
}

export function createExpressApiRouter(db: DbAdapter, config: RuntimeConfig): Express {
  const api = express();
  api.set("trust proxy", 1);
  api.use(express.json({ limit: "2mb" }));

  api.use("/api", (req: Request, res: Response, next) => {
    const origin = req.get("origin");
    const allowedOrigin = isOriginAllowed(origin, req, config.allowedOrigins);
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Company-Id, X-Requested-With",
    );

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  api.all("/api/{*splat}", async (req: Request, res: Response) => {
    const fullUrl = new URL(
      req.originalUrl,
      `${req.protocol || "http"}://${req.get("host") || "localhost"}`,
    );

    const normalizedHeaders: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) normalizedHeaders[k.toLowerCase()] = v.join(", ");
      else if (typeof v === "string") normalizedHeaders[k.toLowerCase()] = v;
    }

    const isHttps =
      req.secure ||
      req.get("x-forwarded-proto") === "https" ||
      (req.get("origin")?.startsWith("https://") ?? false);

    const apiReq: ApiRequest = {
      method: req.method.toUpperCase(),
      path: fullUrl.pathname,
      query: fullUrl.searchParams,
      headers: normalizedHeaders,
      body: req.body,
      origin: req.get("origin") || null,
      isHttps,
    };

    const result = await handleApiRequest(apiReq, db, config);
    if (result.setCookie) {
      res.setHeader("Set-Cookie", result.setCookie);
    }
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }
    res.status(result.status).json(result.body);
  });

  return api;
}
