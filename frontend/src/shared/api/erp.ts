import type { ModuleKey, Role } from "./auth";
import {
  buildClientsCsv,
  buildClientTemplateXlsxBlob,
  parseXlsxFile,
  suggestMapping,
  validateImportRows,
  type ParsedSheetData,
} from "../lib/clientExcel";
import { localErpStore } from "../lib/localErpStore";

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

interface ParsedExcelPayload extends ParsedSheetData {
  suggestedMapping: ColumnMapping;
  totalRows: number;
}

const pendingExcelImports = new Map<string, ParsedExcelPayload>();

export const companiesApi = {
  async create(name: string) {
    return { company: localErpStore.createCompany(name) };
  },

  async updateCurrent(patch: {
    name?: string;
    slug?: string;
    enabledModules?: ModuleKey[];
  }) {
    return { company: localErpStore.updateCurrentCompany(patch) };
  },

  async getSummary(): Promise<CompanySummaryResponse> {
    return localErpStore.getCompanySummary();
  },
};

export const teamApi = {
  async list() {
    return localErpStore.listTeam();
  },

  async invite(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: Role;
  }) {
    return localErpStore.inviteMember(input);
  },

  async revokeInvitation(id: string) {
    localErpStore.revokeInvitation(id);
    return { message: "Invitation révoquée." };
  },

  async updateRole(memberId: string, role: Role) {
    return { member: localErpStore.updateMemberRole(memberId, role) };
  },

  async removeMember(memberId: string) {
    localErpStore.removeMember(memberId);
    return { message: "Collaborateur retiré." };
  },
};

export const clientsApi = {
  async list(params?: { search?: string; status?: string }) {
    return { clients: localErpStore.listClients(params) };
  },

  async create(input: {
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: ClientStatus;
    notes?: string;
  }) {
    return { client: localErpStore.createClient(input) };
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
    return { client: localErpStore.updateClient(id, patch) };
  },

  async remove(id: string) {
    localErpStore.deleteClient(id);
    return { message: "Client supprimé." };
  },

  async exportCsv(params?: { search?: string; status?: string; ids?: string[] }) {
    let clients = localErpStore.listClients({
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

  async downloadImportTemplate() {
    return buildClientTemplateXlsxBlob();
  },

  async previewImport(file: File): Promise<ImportPreviewResponse> {
    const parsed = await parseXlsxFile(file);
    const suggested = suggestMapping(parsed.headers);
    const payload: ParsedExcelPayload = {
      ...parsed,
      suggestedMapping: suggested,
      totalRows: parsed.rows.length,
    };
    const importId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingExcelImports.set(importId, payload);

    return {
      importId,
      sheetName: payload.sheetName,
      headers: payload.headers,
      suggestedMapping: payload.suggestedMapping,
      totalRows: payload.totalRows,
      previewRows: payload.rows.slice(0, 8),
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
    const existingClients = localErpStore.listClients();
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
    const existingClients = localErpStore.listClients();
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

    const { imported, updated } = localErpStore.commitImportedClients(batchOps);
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
    return { opportunities: localErpStore.listOpportunities() };
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
    return { opportunity: localErpStore.createOpportunity(input) };
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
    return { opportunity: localErpStore.updateOpportunity(id, patch) };
  },

  async remove(id: string) {
    localErpStore.deleteOpportunity(id);
    return { message: "Opportunité supprimée." };
  },
};
