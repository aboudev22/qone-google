import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import { createNodeSqliteAdapter } from "./backend/src/adapters/nodeSqlite.js";
import { ensureSchema } from "./backend/src/core/db.js";
import type { RuntimeConfig } from "./backend/src/core/types.js";
import { createExpressApiRouter } from "./backend/src/expressApp.js";

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return ["http://localhost:3000", "http://127.0.0.1:3000"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "0.0.0.0";
  const isProd = process.env.NODE_ENV === "production";
  const apiOnly = process.env.API_ONLY === "true";

  const dbPath = process.env.SQLITE_DB_PATH || "./data/qone.sqlite";
  const db = createNodeSqliteAdapter(dbPath);
  await ensureSchema(db);

  const sessionSecret =
    process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString("hex");

  const config: RuntimeConfig = {
    sessionSecret,
    runtimeName: "express",
    allowedOrigins: parseAllowedOrigins(process.env.CORS_ORIGIN),
  };

  const app = express();
  app.set("trust proxy", 1);

  const apiRouter = createExpressApiRouter(db, config);
  app.use(apiRouter);

  if (!apiOnly) {
    if (!isProd) {
      const frontendReq = createRequire(path.resolve("frontend/package.json"));
      const vitePath = frontendReq.resolve("vite");
      const viteMod = (await import(pathToFileURL(vitePath).href)) as {
        createServer: (opts: Record<string, unknown>) => Promise<{
          middlewares: express.RequestHandler;
        }>;
      };
      const vite = await viteMod.createServer({
        root: path.resolve("frontend"),
        server: {
          middlewareMode: true,
          allowedHosts: true,
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve("frontend/dist");
      app.use(express.static(distDir));
      app.get("/{*splat}", (_req, res) => {
        res.sendFile(path.join(distDir, "index.html"));
      });
    }
  }

  app.listen(port, host, () => {
    console.log(
      `[qone] Express server listening on http://${host}:${port} (${isProd ? "production" : "development"})`,
    );
  });
}

startServer().catch((err) => {
  console.error("[qone] Failed to start server:", err);
  process.exit(1);
});
