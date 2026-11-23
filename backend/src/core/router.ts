import { HttpError } from "./context.js";
import type { ApiRequest, ApiResponse, DbAdapter, RuntimeConfig } from "./types.js";
import { handleAuthRoutes } from "../routes/auth.js";
import { handleCompanyAndTeamRoutes } from "../routes/companies.js";
import { handleProjectRoutes } from "../routes/projects.js";
import { handleStockRoutes } from "../routes/stock.js";
import { handleCrmAndSalesRoutes } from "../routes/crm.js";

export async function handleApiRequest(
  req: ApiRequest,
  db: DbAdapter,
  config: RuntimeConfig,
): Promise<ApiResponse> {
  try {
    if (req.method === "GET" && req.path === "/api/health") {
      return {
        status: 200,
        body: { ok: true, runtime: config.runtimeName },
      };
    }

    const handlers = [
      handleAuthRoutes,
      handleCompanyAndTeamRoutes,
      handleProjectRoutes,
      handleStockRoutes,
      handleCrmAndSalesRoutes,
    ];

    for (const handler of handlers) {
      const result = await handler(req, db, config);
      if (result) return result;
    }

    return {
      status: 404,
      body: { message: `Route introuvable : ${req.method} ${req.path}` },
    };
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return {
        status: err.status,
        body: { message: err.message },
      };
    }
    const message =
      err instanceof Error ? err.message : "Erreur interne du serveur.";
    console.error("[qone-api]", err);
    return {
      status: 500,
      body: { message },
    };
  }
}
