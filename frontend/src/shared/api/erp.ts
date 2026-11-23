import { api } from "./client";
import type { ModuleKey, Role, User } from "./auth";
import { auth } from "../lib/firebase";
import { buildClientsCsv, validateImportRows } from "../lib/clientExcel";
import {
  batchCommitImportedClients,
  createClientRecord,
  createCompanyWorkspace,
  createOpportunityRecord,
  createTeamInvitation,
  deleteClientRecord,
  deleteOpportunityRecord,
  listActivities,
  listClients,
  listOpportunities,
  listTeam,
  removeCompanyMember,
  revokeTeamInvitation,
  updateClientRecord,
  updateCompanySettings,
  updateMemberRoleRecord,
  updateOpportunityRecord,
  upsertUserProfile,
} from "../lib/firestoreErp";

export type ClientStatus = "active" | "prospect" | "inactive";

export interface Client {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  status: ClientStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface Opportunity {
  id: string;
  companyId: string;
  clientId: string;
  clientName?: string;
  title: string;
  amount: number;
  probability: number;
  stage: OpportunityStage;
  expectedCloseDate: string;
  notes: string;
  ownerUserId: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  actorUid: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  joinedAt: string;
}

export interface TeamInvitation {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  token: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  expiresAt: string;
}

export interface CompanySummaryResponse {
  summary: {
    membersCount: number;
    clientsCount: number;
    activeClientsCount: number;
    opportunitiesCount: number;
    openOpportunitiesCount: number;
    pipelineValue: number;
    wonValue: number;
  };
  recentClients: Client[];
  recentOpportunities: Opportunity[];
  recentActivities: ActivityLog[];
}

export type ClientFieldKey =
  | "name"
  | "email"
  | "phone"
  | "companyName"
  | "status"
  | "notes";

export type ColumnMapping = Partial<Record<ClientFieldKey, string>>;
export type DuplicatePolicy = "skip" | "update" | "error";

export interface ImportPreviewResponse {
  importId: string;
  sheetName: string;
  headers: string[];
  suggestedMapping: ColumnMapping;
  totalRows: number;
  previewRows: Record<string, string>[];
}

export interface ImportValidationResponse {
  summary: {
    total: number;
    valid: number;
    duplicates: number;
    invalid: number;
  };
  issues: Array<{
    rowNumber: number;
    status: "duplicate" | "invalid";
    name: string;
    email: string;
    errors: string[];
  }>;
}

export interface ImportCommitResponse {
  report: {
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    rejected: number;
    errors: Array<{ rowNumber: number; reason: string }>;
  };
}

interface ParsedExcelPayload {
  sheetName: string;
  headers: string[];
  suggestedMapping: ColumnMapping;
  totalRows: number;
  rows: Record<string, string>[];
}

const pendingExcelImports = new Map<string, ParsedExcelPayload>();

async function requireSessionContext(): Promise<{
  user: User;
  companyId: string;
}> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }
  const companyId = api.getActiveCompanyId();
  if (!companyId) {
    throw new Error("Aucun espace d'entreprise actif sélectionné.");
  }
  const user = await upsertUserProfile(fbUser);
  return { user, companyId };
}

export const companiesApi = {
  async create(name: string) {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new Error("Session expirée. Veuillez vous reconnecter.");
    }
    const user = await upsertUserProfile(fbUser);
    const company = await createCompanyWorkspace({
      user,
      companyName: name,
    });
    return { company };
  },

  async updateCurrent(patch: {
    name?: string;
    slug?: string;
    enabledModules?: ModuleKey[];
  }) {
    const { user, companyId } = await requireSessionContext();
    const company = await updateCompanySettings(companyId, user, patch);
    return { company };
  },

  async getSummary(): Promise<CompanySummaryResponse> {
    const { companyId } = await requireSessionContext();
    const [team, clients, opportunities, recentActivities] = await Promise.all([
      listTeam(companyId),
      listClients(companyId),
      listOpportunities(companyId),
      listActivities(companyId, 8),
    ]);

    const openOpps = opportunities.filter(
      (o) => o.stage !== "won" && o.stage !== "lost",
    );
    const wonOpps = opportunities.filter((o) => o.stage === "won");

    return {
      summary: {
        membersCount: team.members.length || 1,
        clientsCount: clients.length,
        activeClientsCount: clients.filter((c) => c.status === "active").length,
        opportunitiesCount: opportunities.length,
        openOpportunitiesCount: openOpps.length,
        pipelineValue: openOpps.reduce((sum, o) => sum + o.amount, 0),
        wonValue: wonOpps.reduce((sum, o) => sum + o.amount, 0),
      },
      recentClients: clients.slice(0, 5),
      recentOpportunities: opportunities.slice(0, 5),
      recentActivities,
    };
  },
};

export const teamApi = {
  async list() {
    const { companyId } = await requireSessionContext();
    return listTeam(companyId);
  },

  async invite(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: Role;
  }) {
    const { user, companyId } = await requireSessionContext();
    const invitation = await createTeamInvitation(
      {
        id: companyId,
        name: "Espace qone",
        slug: "espace",
        role: "owner",
      },
      user,
      input,
    );
    return {
      addedDirectly: false,
      invitation,
    };
  },

  async revokeInvitation(id: string) {
    const { user, companyId } = await requireSessionContext();
    await revokeTeamInvitation(companyId, id, user);
    return { message: "Invitation révoquée." };
  },

  async updateRole(memberId: string, role: Role) {
    const { user, companyId } = await requireSessionContext();
    const member = await updateMemberRoleRecord(companyId, memberId, role, user);
    return { member };
  },

  async removeMember(memberId: string) {
    const { user, companyId } = await requireSessionContext();
    await removeCompanyMember(companyId, memberId, user);
    return { message: "Collaborateur retiré." };
  },
};

export const clientsApi = {
  async list(params?: { search?: string; status?: string }) {
    const { companyId } = await requireSessionContext();
    const clients = await listClients(companyId, params);
    return { clients };
  },

  async create(input: {
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: ClientStatus;
    notes?: string;
  }) {
    const { user, companyId } = await requireSessionContext();
    const client = await createClientRecord(companyId, user, input);
    return { client };
  },

  async update(
    id: string,
    patch: Partial<{
      name: string;
      email: string;
      phone: string;
      companyName: string;
      status: ClientStatus;
      notes: string;
    }>,
  ) {
    const { user, companyId } = await requireSessionContext();
    const client = await updateClientRecord(companyId, id, user, patch);
    return { client };
  },

  async remove(id: string) {
    const { user, companyId } = await requireSessionContext();
    await deleteClientRecord(companyId, id, user);
    return { message: "Client supprimé." };
  },

  async exportCsv(params?: { search?: string; status?: string; ids?: string[] }) {
    const { companyId } = await requireSessionContext();
    let clients = await listClients(companyId, {
      search: params?.search,
      status: params?.status,
    });
    if (params?.ids && params.ids.length > 0) {
      const idSet = new Set(params.ids);
      clients = clients.filter((c) => idSet.has(c.id));
    }
    const csv = buildClientsCsv(clients);
    return new Blob([csv], { type: "text/csv;charset=utf-8" });
  },

  downloadImportTemplate() {
    return api.downloadBlob("/api/excel/template");
  },

  async previewImport(file: File): Promise<ImportPreviewResponse> {
    const form = new FormData();
    form.append("file", file);
    const parsed = await api.postForm<ParsedExcelPayload>("/api/excel/parse", form);
    if (
      !parsed ||
      !Array.isArray(parsed.headers) ||
      !Array.isArray(parsed.rows)
    ) {
      throw new Error("Impossible de lire la structure de ce classeur Excel.");
    }
    const importId = crypto.randomUUID();
    pendingExcelImports.set(importId, parsed);
    return {
      importId,
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      suggestedMapping: parsed.suggestedMapping || {},
      totalRows: parsed.totalRows,
      previewRows: parsed.rows.slice(0, 8),
    };
  },

  async validateImport(input: {
    importId: string;
    mapping: ColumnMapping;
    duplicatePolicy: DuplicatePolicy;
  }): Promise<ImportValidationResponse> {
    const parsed = pendingExcelImports.get(input.importId);
    if (!parsed) {
      throw new Error(
        "Session d'import expirée. Veuillez recharger votre fichier Excel.",
      );
    }
    const { companyId } = await requireSessionContext();
    const existingClients = await listClients(companyId);
    const validated = validateImportRows(
      parsed.rows,
      input.mapping,
      existingClients,
    );

    const mappedRows = validated.map((row) => {
      if (row.status === "duplicate" && input.duplicatePolicy === "error") {
        return {
          ...row,
          status: "invalid" as const,
          errors: [...row.errors, "Client déjà existant (doublon rejeté)."],
        };
      }
      return row;
    });

    return {
      summary: {
        total: mappedRows.length,
        valid: mappedRows.filter((r) => r.status === "valid").length,
        duplicates: mappedRows.filter((r) => r.status === "duplicate").length,
        invalid: mappedRows.filter((r) => r.status === "invalid").length,
      },
      issues: mappedRows
        .filter((r) => r.status !== "valid")
        .slice(0, 50)
        .map((r) => ({
          rowNumber: r.rowNumber,
          status: r.status === "duplicate" ? "duplicate" : "invalid",
          name: r.data.name,
          email: r.data.email,
          errors:
            r.errors.length > 0
              ? r.errors
              : ["Doublon détecté avec un client existant."],
        })),
    };
  },

  async commitImport(input: {
    importId: string;
    mapping: ColumnMapping;
    duplicatePolicy: DuplicatePolicy;
  }): Promise<ImportCommitResponse> {
    const parsed = pendingExcelImports.get(input.importId);
    if (!parsed) {
      throw new Error(
        "Session d'import expirée. Veuillez recharger votre fichier Excel.",
      );
    }
    const { user, companyId } = await requireSessionContext();
    const existingClients = await listClients(companyId);
    const validated = validateImportRows(
      parsed.rows,
      input.mapping,
      existingClients,
    );

    const batchOps: Array<
      | {
          type: "create";
          data: {
            name: string;
            email: string;
            phone: string;
            companyName: string;
            status: ClientStatus;
            notes: string;
          };
        }
      | {
          type: "update";
          clientId: string;
          data: {
            name: string;
            email: string;
            phone: string;
            companyName: string;
            status: ClientStatus;
            notes: string;
          };
        }
    > = [];

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
        if (input.duplicatePolicy === "update" && row.duplicateMatchId) {
          batchOps.push({
            type: "update",
            clientId: row.duplicateMatchId,
            data: row.data,
          });
        } else if (input.duplicatePolicy === "error") {
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

      batchOps.push({
        type: "create",
        data: row.data,
      });
    }

    const { imported, updated } = await batchCommitImportedClients(
      companyId,
      user,
      batchOps,
    );

    pendingExcelImports.delete(input.importId);

    return {
      report: {
        total: validated.length,
        imported,
        updated,
        skipped,
        rejected,
        errors: errors.slice(0, 50),
      },
    };
  },
};

export const opportunitiesApi = {
  async list() {
    const { companyId } = await requireSessionContext();
    const opportunities = await listOpportunities(companyId);
    return { opportunities };
  },

  async create(input: {
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate?: string;
    notes?: string;
  }) {
    const { user, companyId } = await requireSessionContext();
    const opportunity = await createOpportunityRecord(companyId, user, input);
    return { opportunity };
  },

  async update(
    id: string,
    patch: Partial<{
      clientId: string;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expectedCloseDate: string;
      notes: string;
    }>,
  ) {
    const { user, companyId } = await requireSessionContext();
    const opportunity = await updateOpportunityRecord(companyId, id, user, patch);
    return { opportunity };
  },

  async remove(id: string) {
    const { user, companyId } = await requireSessionContext();
    await deleteOpportunityRecord(companyId, id, user);
    return { message: "Opportunité supprimée." };
  },
};
