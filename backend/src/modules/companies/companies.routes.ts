import { Router } from "express";
import { getStore } from "../../db/store.js";
import {
  requireAuth,
  requireCompany,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import type { ModuleKey } from "../../shared/types.js";

export const companiesRouter = Router();

companiesRouter.use(requireAuth);

companiesRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const companies = await getStore().listCompaniesForUser(req.authUser!.id);
  res.json({ companies });
});

companiesRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({
      error: "Le nom de l'entreprise doit comporter au moins 2 caractères.",
    });
    return;
  }

  const company = await getStore().createCompanyWithOwner({
    userId: req.authUser!.id,
    name: name.trim(),
  });
  res.status(201).json({ company });
});

companiesRouter.patch(
  "/current",
  requireCompany(["owner", "admin"]),
  async (req: AuthenticatedRequest, res) => {
    const { name, slug, enabledModules } = req.body ?? {};
    const patch: { name?: string; slug?: string; enabledModules?: ModuleKey[] } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        res.status(400).json({
          error: "Le nom de l'entreprise doit comporter au moins 2 caractères.",
        });
        return;
      }
      patch.name = name.trim();
    }

    if (slug !== undefined) {
      if (typeof slug !== "string" || slug.trim().length < 2) {
        res.status(400).json({
          error: "Le slug doit comporter au moins 2 caractères.",
        });
        return;
      }
      patch.slug = slug.trim();
    }

    if (enabledModules !== undefined) {
      if (!Array.isArray(enabledModules)) {
        res.status(400).json({ error: "Format de modules invalide." });
        return;
      }
      const validSet = new Set<ModuleKey>(["crm", "sales"]);
      patch.enabledModules = enabledModules.filter((m): m is ModuleKey =>
        validSet.has(m as ModuleKey),
      );
    }

    const updated = await getStore().updateCompany(
      req.companyContext!.companyId,
      patch,
    );
    if (!updated) {
      res.status(404).json({ error: "Entreprise introuvable." });
      return;
    }

    res.json({
      company: {
        ...updated,
        role: req.companyContext!.role,
      },
    });
  },
);

companiesRouter.get(
  "/current/summary",
  requireCompany(),
  async (req: AuthenticatedRequest, res) => {
    const store = getStore();
    const companyId = req.companyContext!.companyId;
    const [members, clients, opportunities] = await Promise.all([
      store.listTeamMembers(companyId),
      store.listClients(companyId),
      store.listOpportunities(companyId),
    ]);

    const openOpportunities = opportunities.filter(
      (o) => o.stage !== "won" && o.stage !== "lost",
    );
    const wonOpportunities = opportunities.filter((o) => o.stage === "won");
    const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.amount, 0);
    const wonValue = wonOpportunities.reduce((sum, o) => sum + o.amount, 0);

    res.json({
      summary: {
        membersCount: members.length,
        clientsCount: clients.length,
        activeClientsCount: clients.filter((c) => c.status === "active").length,
        opportunitiesCount: opportunities.length,
        openOpportunitiesCount: openOpportunities.length,
        pipelineValue,
        wonValue,
      },
      recentClients: clients.slice(0, 5),
      recentOpportunities: opportunities.slice(0, 5),
    });
  },
);
