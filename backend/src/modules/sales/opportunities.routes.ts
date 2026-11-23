import { Router } from "express";
import { getStore } from "../../db/store.js";
import {
  requireAuth,
  requireCompany,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import type { OpportunityStage } from "../../shared/types.js";

export const opportunitiesRouter = Router();

const VALID_STAGES: OpportunityStage[] = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

opportunitiesRouter.use(requireAuth, requireCompany());

opportunitiesRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const opportunities = await getStore().listOpportunities(
    req.companyContext!.companyId,
  );
  res.json({ opportunities });
});

opportunitiesRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const {
    clientId,
    title,
    amount,
    probability,
    stage,
    expectedCloseDate,
    notes,
  } = req.body ?? {};

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Le titre de l'opportunité est requis." });
    return;
  }

  if (typeof clientId !== "string" || !clientId.trim()) {
    res.status(400).json({ error: "Veuillez sélectionner un client associé." });
    return;
  }

  const store = getStore();
  const companyId = req.companyContext!.companyId;
  const client = await store.findClientById(companyId, clientId.trim());
  if (!client) {
    res.status(404).json({ error: "Client associé introuvable." });
    return;
  }

  const numAmount = Number(amount ?? 0);
  if (!Number.isFinite(numAmount) || numAmount < 0) {
    res.status(400).json({ error: "Montant invalide." });
    return;
  }

  const numProb = Number(probability ?? 25);
  const clampedProb = Number.isFinite(numProb)
    ? Math.max(0, Math.min(100, Math.round(numProb)))
    : 25;

  const validStage: OpportunityStage = VALID_STAGES.includes(stage)
    ? stage
    : "prospecting";

  const opportunity = await store.createOpportunity({
    companyId,
    clientId: client.id,
    title: title.trim(),
    amount: numAmount,
    probability: clampedProb,
    stage: validStage,
    expectedCloseDate:
      typeof expectedCloseDate === "string" ? expectedCloseDate.trim() : "",
    notes: typeof notes === "string" ? notes.trim() : "",
    ownerUserId: req.authUser!.id,
  });

  res.status(201).json({ opportunity });
});

opportunitiesRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const {
    clientId,
    title,
    amount,
    probability,
    stage,
    expectedCloseDate,
    notes,
  } = req.body ?? {};

  const store = getStore();
  const companyId = req.companyContext!.companyId;
  const patch: Partial<{
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate: string;
    notes: string;
  }> = {};

  if (clientId !== undefined) {
    if (typeof clientId !== "string" || !clientId.trim()) {
      res.status(400).json({ error: "Client associé invalide." });
      return;
    }
    const client = await store.findClientById(companyId, clientId.trim());
    if (!client) {
      res.status(404).json({ error: "Client associé introuvable." });
      return;
    }
    patch.clientId = client.id;
  }

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Le titre ne peut pas être vide." });
      return;
    }
    patch.title = title.trim();
  }

  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      res.status(400).json({ error: "Montant invalide." });
      return;
    }
    patch.amount = numAmount;
  }

  if (probability !== undefined) {
    const numProb = Number(probability);
    if (!Number.isFinite(numProb) || numProb < 0 || numProb > 100) {
      res.status(400).json({ error: "La probabilité doit être entre 0 et 100." });
      return;
    }
    patch.probability = Math.round(numProb);
  }

  if (stage !== undefined) {
    if (!VALID_STAGES.includes(stage)) {
      res.status(400).json({ error: "Étape de pipeline invalide." });
      return;
    }
    patch.stage = stage;
  }

  if (expectedCloseDate !== undefined) {
    patch.expectedCloseDate =
      typeof expectedCloseDate === "string" ? expectedCloseDate.trim() : "";
  }

  if (notes !== undefined) {
    patch.notes = typeof notes === "string" ? notes.trim() : "";
  }

  const updated = await store.updateOpportunity(
    companyId,
    String(req.params.id),
    patch,
  );
  if (!updated) {
    res.status(404).json({ error: "Opportunité introuvable." });
    return;
  }

  res.json({ opportunity: updated });
});

opportunitiesRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const deleted = await getStore().deleteOpportunity(
    req.companyContext!.companyId,
    String(req.params.id),
  );
  if (!deleted) {
    res.status(404).json({ error: "Opportunité introuvable." });
    return;
  }
  res.json({ message: "Opportunité supprimée." });
});
