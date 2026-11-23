import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { env } from "./config/env.js";
import { initStore } from "./db/store.js";
import { csrfGuard } from "./middleware/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { companiesRouter } from "./modules/companies/companies.routes.js";
import { clientsRouter } from "./modules/crm/clients.routes.js";
import { excelRouter } from "./modules/crm/excel.routes.js";
import { opportunitiesRouter } from "./modules/sales/opportunities.routes.js";
import { teamRouter } from "./modules/users/team.routes.js";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use("/api", csrfGuard);

const store = await initStore();

app.get("/api/health", async (_req, res) => {
  try {
    const status = await store.healthCheck();
    res.json({
      status: "ok",
      database: status.mode === "postgres" ? "connected" : "memory",
    });
  } catch {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/team", teamRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/excel", excelRouter);
app.use("/api/opportunities", opportunitiesRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use(
  "/api",
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    void _next;
    console.error("[qone API error]", err);
    if (res.headersSent) return;
    res.status(500).json({
      error: "Une erreur interne est survenue. Veuillez réessayer.",
    });
  },
);

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = path.resolve(currentDir, "../../frontend/dist");

if (fs.existsSync(frontendDistDir)) {
  app.use(express.static(frontendDistDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(frontendDistDir, "index.html"));
    }
    return next();
  });
}

app.listen(env.port, "0.0.0.0", () => {
  console.log(`API qone démarrée sur le port ${env.port} (${store.mode})`);
});
