import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { getStore } from "../../db/store.js";
import {
  requireAuth,
  requireCompany,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import type { ClientStatus } from "../../shared/types.js";
import {
  buildClientsCsv,
  buildClientTemplateXlsx,
  parseXlsxBuffer,
  suggestMapping,
  validateImportRows,
  type ColumnMapping,
  type DuplicatePolicy,
  type ParsedSheetData,
} from "./importExport.js";

export const clientsRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES: ClientStatus[] = ["active", "prospect", "inactive"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxImportFileBytes,
    files: 1,
  },
});

interface PendingImportSession {
  id: string;
  companyId: string;
  userId: string;
  parsed: ParsedSheetData;
  expiresAt: number;
}

const pendingImports = new Map<string, PendingImportSession>();

function pruneExpiredImports() {
  const now = Date.now();
  for (const [id, session] of pendingImports.entries()) {
    if (session.expiresAt <= now) {
      pendingImports.delete(id);
    }
  }
}

clientsRouter.use(requireAuth, requireCompany());

clientsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  const companyId = req.companyContext!.companyId;
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().toLowerCase()
      : "";
  const statusFilter =
    typeof req.query.status === "string" ? req.query.status.trim() : "";

  let clients = await getStore().listClients(companyId);

  if (statusFilter && VALID_STATUSES.includes(statusFilter as ClientStatus)) {
    clients = clients.filter((c) => c.status === statusFilter);
  }

  if (search) {
    clients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.companyName.toLowerCase().includes(search) ||
        c.phone.toLowerCase().includes(search),
    );
  }

  res.json({ clients });
});

clientsRouter.get("/export", async (req: AuthenticatedRequest, res) => {
  const companyId = req.companyContext!.companyId;
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().toLowerCase()
      : "";
  const statusFilter =
    typeof req.query.status === "string" ? req.query.status.trim() : "";
  const idsParam =
    typeof req.query.ids === "string" ? req.query.ids.trim() : "";

  let clients = await getStore().listClients(companyId);

  if (idsParam) {
    const idSet = new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean));
    clients = clients.filter((c) => idSet.has(c.id));
  } else {
    if (statusFilter && VALID_STATUSES.includes(statusFilter as ClientStatus)) {
      clients = clients.filter((c) => c.status === statusFilter);
    }
    if (search) {
      clients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.companyName.toLowerCase().includes(search) ||
          c.phone.toLowerCase().includes(search),
      );
    }
  }

  const csv = buildClientsCsv(clients);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="qone-clients.csv"',
  );
  res.send(csv);
});

clientsRouter.get("/import/template", async (_req: AuthenticatedRequest, res) => {
  const buffer = await buildClientTemplateXlsx();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="qone-modele-clients.xlsx"',
  );
  res.send(buffer);
});

clientsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const { name, email, phone, companyName, status, notes } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Le nom du client est obligatoire." });
    return;
  }

  const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
    res.status(400).json({ error: "Adresse email invalide." });
    return;
  }

  const cleanStatus: ClientStatus = VALID_STATUSES.includes(status)
    ? status
    : "active";

  const client = await getStore().createClient({
    companyId: req.companyContext!.companyId,
    name: name.trim(),
    email: cleanEmail,
    phone: typeof phone === "string" ? phone.trim() : "",
    companyName: typeof companyName === "string" ? companyName.trim() : "",
    status: cleanStatus,
    notes: typeof notes === "string" ? notes.trim() : "",
  });

  res.status(201).json({ client });
});

clientsRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const { name, email, phone, companyName, status, notes } = req.body ?? {};
  const patch: {
    name?: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: ClientStatus;
    notes?: string;
  } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Le nom du client ne peut pas être vide." });
      return;
    }
    patch.name = name.trim();
  }

  if (email !== undefined) {
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      res.status(400).json({ error: "Adresse email invalide." });
      return;
    }
    patch.email = cleanEmail;
  }

  if (phone !== undefined) {
    patch.phone = typeof phone === "string" ? phone.trim() : "";
  }
  if (companyName !== undefined) {
    patch.companyName = typeof companyName === "string" ? companyName.trim() : "";
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: "Statut client invalide." });
      return;
    }
    patch.status = status;
  }
  if (notes !== undefined) {
    patch.notes = typeof notes === "string" ? notes.trim() : "";
  }

  const updated = await getStore().updateClient(
    req.companyContext!.companyId,
    String(req.params.id),
    patch,
  );
  if (!updated) {
    res.status(404).json({ error: "Client introuvable." });
    return;
  }

  res.json({ client: updated });
});

clientsRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const deleted = await getStore().deleteClient(
    req.companyContext!.companyId,
    String(req.params.id),
  );
  if (!deleted) {
    res.status(404).json({ error: "Client introuvable." });
    return;
  }
  res.json({ message: "Client supprimé." });
});

clientsRouter.post(
  "/import/preview",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({
            error: "Le fichier dépasse la taille maximale autorisée de 5 Mo.",
          });
          return;
        }
        res.status(400).json({ error: "Erreur lors du téléversement du fichier." });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Veuillez sélectionner un fichier .xlsx." });
      return;
    }

    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      res.status(400).json({
        error: "Seuls les classeurs Excel au format .xlsx sont acceptés.",
      });
      return;
    }

    try {
      pruneExpiredImports();
      const parsed = await parseXlsxBuffer(file.buffer);
      const importId = crypto.randomUUID();
      pendingImports.set(importId, {
        id: importId,
        companyId: req.companyContext!.companyId,
        userId: req.authUser!.id,
        parsed,
        expiresAt: Date.now() + 30 * 60 * 1000,
      });

      res.json({
        importId,
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        suggestedMapping: suggestMapping(parsed.headers),
        totalRows: parsed.rows.length,
        previewRows: parsed.rows.slice(0, 8),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de lire ce fichier Excel.";
      res.status(400).json({ error: message });
    }
  },
);

clientsRouter.post("/import/validate", async (req: AuthenticatedRequest, res) => {
  const { importId, mapping, duplicatePolicy } = req.body ?? {};
  if (typeof importId !== "string" || !importId.trim()) {
    res.status(400).json({ error: "Session d'import manquante." });
    return;
  }

  const session = pendingImports.get(importId);
  if (
    !session ||
    session.companyId !== req.companyContext!.companyId ||
    session.expiresAt <= Date.now()
  ) {
    res.status(404).json({
      error: "Session d'import expirée. Veuillez recharger votre fichier Excel.",
    });
    return;
  }

  const colMapping: ColumnMapping =
    mapping && typeof mapping === "object" ? (mapping as ColumnMapping) : {};
  if (!colMapping.name) {
    res.status(400).json({
      error: "Vous devez associer une colonne au champ obligatoire « Nom ».",
    });
    return;
  }

  const policy: DuplicatePolicy =
    duplicatePolicy === "update" || duplicatePolicy === "error"
      ? duplicatePolicy
      : "skip";

  const existingClients = await getStore().listClients(
    req.companyContext!.companyId,
  );
  const validated = validateImportRows(
    session.parsed.rows,
    colMapping,
    existingClients,
  );

  const mappedRows = validated.map((row) => {
    if (row.status === "duplicate" && policy === "error") {
      return {
        ...row,
        status: "invalid" as const,
        errors: [...row.errors, "Client déjà existant (doublon rejeté)."],
      };
    }
    return row;
  });

  const validCount = mappedRows.filter((r) => r.status === "valid").length;
  const duplicateCount = mappedRows.filter(
    (r) => r.status === "duplicate",
  ).length;
  const invalidCount = mappedRows.filter((r) => r.status === "invalid").length;

  res.json({
    summary: {
      total: mappedRows.length,
      valid: validCount,
      duplicates: duplicateCount,
      invalid: invalidCount,
    },
    rows: mappedRows.slice(0, 100),
    issues: mappedRows
      .filter((r) => r.status !== "valid")
      .slice(0, 50)
      .map((r) => ({
        rowNumber: r.rowNumber,
        status: r.status,
        name: r.data.name,
        email: r.data.email,
        errors:
          r.errors.length > 0
            ? r.errors
            : ["Doublon détecté avec un client existant."],
      })),
  });
});

clientsRouter.post("/import/commit", async (req: AuthenticatedRequest, res) => {
  const { importId, mapping, duplicatePolicy } = req.body ?? {};
  if (typeof importId !== "string" || !importId.trim()) {
    res.status(400).json({ error: "Session d'import manquante." });
    return;
  }

  const session = pendingImports.get(importId);
  if (
    !session ||
    session.companyId !== req.companyContext!.companyId ||
    session.expiresAt <= Date.now()
  ) {
    res.status(404).json({
      error: "Session d'import expirée. Veuillez recharger votre fichier Excel.",
    });
    return;
  }

  const colMapping: ColumnMapping =
    mapping && typeof mapping === "object" ? (mapping as ColumnMapping) : {};
  if (!colMapping.name) {
    res.status(400).json({
      error: "Vous devez associer une colonne au champ obligatoire « Nom ».",
    });
    return;
  }

  const policy: DuplicatePolicy =
    duplicatePolicy === "update" || duplicatePolicy === "error"
      ? duplicatePolicy
      : "skip";

  const store = getStore();
  const companyId = req.companyContext!.companyId;
  const existingClients = await store.listClients(companyId);
  const validated = validateImportRows(
    session.parsed.rows,
    colMapping,
    existingClients,
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let rejected = 0;
  const errors: Array<{ rowNumber: number; reason: string }> = [];

  for (const row of validated) {
    if (row.status === "invalid") {
      rejected++;
      errors.push({
        rowNumber: row.rowNumber,
        reason: row.errors.join(" "),
      });
      continue;
    }

    if (row.status === "duplicate") {
      if (policy === "update" && row.duplicateMatchId) {
        await store.updateClient(companyId, row.duplicateMatchId, row.data);
        updated++;
      } else if (policy === "error") {
        rejected++;
        errors.push({
          rowNumber: row.rowNumber,
          reason: "Doublon rejeté selon la règle sélectionnée.",
        });
      } else {
        skipped++;
      }
      continue;
    }

    await store.createClient({
      companyId,
      ...row.data,
    });
    imported++;
  }

  pendingImports.delete(importId);

  res.json({
    report: {
      total: validated.length,
      imported,
      updated,
      skipped,
      rejected,
      errors: errors.slice(0, 50),
    },
  });
});
