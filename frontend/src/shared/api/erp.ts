import type { Company, ModuleKey, Role } from "./auth";
import { apiRequest } from "./http";
import {
  buildClientsCsv,
  buildClientTemplateXlsxBlob,
  parseXlsxFile,
  suggestMapping,
  validateImportRows,
  type ParsedSheetData,
} from "../lib/clientExcel";

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

export type LogCategory =
  | "team"
  | "projects"
  | "stock"
  | "crm"
  | "sales"
  | "settings";

export interface ActivityLog {
  id: string;
  companyId: string;
  actorUid: string;
  actorName: string;
  actorEmail?: string;
  category: LogCategory;
  action: string;
  summary: string;
  details?: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string;
  accountType?: string;
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
  projectId?: string | null;
  projectName?: string | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  expiresAt: string;
}

export type ProjectStatus = "active" | "paused" | "completed";
export type ProjectRole = "lead" | "contributor";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface ProjectMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  projectRole: ProjectRole;
  addedAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
  };
}

export interface TaskItem {
  id: string;
  companyId: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeUserId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  dueDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType = "in" | "out" | "adjustment";

export interface StockItem {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  supplier: string;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  companyId: string;
  itemId: string;
  itemName: string;
  type: StockMovementType;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  actorUserId: string;
  actorName: string;
  createdAt: string;
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
    projectsCount: number;
    tasksCount: number;
    openTasksCount: number;
    stockItemsCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    stockValue: number;
  };
  charts: {
    pipelineByStage: Array<{
      stage: string;
      label: string;
      count: number;
      amount: number;
    }>;
    tasksByStatus: Array<{
      status: string;
      label: string;
      count: number;
    }>;
    stockHealth: {
      healthy: number;
      low: number;
      out: number;
    };
  };
  lowStockItems: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    minQuantity: number;
    unit: string;
  }>;
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
  async create(name: string): Promise<{ company: Company }> {
    return apiRequest("/api/companies", {
      method: "POST",
      body: { name },
    });
  },

  async updateCurrent(patch: {
    name?: string;
    slug?: string;
    enabledModules?: ModuleKey[];
  }): Promise<{ company: Company }> {
    return apiRequest("/api/companies/current", {
      method: "PATCH",
      body: patch,
    });
  },

  async getSummary(): Promise<CompanySummaryResponse> {
    return apiRequest("/api/companies/current/summary");
  },
};

export const teamApi = {
  async list(): Promise<{ members: TeamMember[]; invitations: TeamInvitation[] }> {
    return apiRequest("/api/team");
  },

  async invite(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: Role;
    projectId?: string;
    directAdd?: boolean;
  }): Promise<{ invitation?: TeamInvitation; addedDirectly?: boolean }> {
    return apiRequest("/api/team/invite", {
      method: "POST",
      body: input,
    });
  },

  async revokeInvitation(id: string): Promise<{ message: string }> {
    return apiRequest(`/api/team/invitations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async updateRole(memberId: string, role: Role): Promise<{ message: string }> {
    return apiRequest(`/api/team/members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      body: { role },
    });
  },

  async removeMember(memberId: string): Promise<{ message: string }> {
    return apiRequest(`/api/team/members/${encodeURIComponent(memberId)}`, {
      method: "DELETE",
    });
  },
};

export const projectsApi = {
  async list(): Promise<{ projects: Project[] }> {
    return apiRequest("/api/projects");
  },

  async create(input: {
    name: string;
    description?: string;
    status?: ProjectStatus;
  }): Promise<{ project: Project }> {
    return apiRequest("/api/projects", {
      method: "POST",
      body: input,
    });
  },

  async update(
    id: string,
    patch: Partial<{ name: string; description: string; status: ProjectStatus }>,
  ): Promise<{ message: string }> {
    return apiRequest(`/api/projects/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async remove(id: string): Promise<{ message: string }> {
    return apiRequest(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async addMember(
    projectId: string,
    input: {
      userId?: string;
      email?: string;
      projectRole?: ProjectRole;
      directAdd?: boolean;
    },
  ): Promise<{ status: "added" | "invited"; message: string; token?: string }> {
    return apiRequest(`/api/projects/${encodeURIComponent(projectId)}/members`, {
      method: "POST",
      body: input,
    });
  },

  async removeMember(projectId: string, userId: string): Promise<{ message: string }> {
    return apiRequest(
      `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },
};

export const tasksApi = {
  async list(params?: {
    projectId?: string;
    assigneeUserId?: string;
    status?: string;
  }): Promise<{ tasks: TaskItem[] }> {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set("projectId", params.projectId);
    if (params?.assigneeUserId) qs.set("assigneeUserId", params.assigneeUserId);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiRequest(`/api/tasks${query ? `?${query}` : ""}`);
  },

  async create(input: {
    projectId: string;
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeUserId?: string | null;
    dueDate?: string;
  }): Promise<{ id: string }> {
    return apiRequest("/api/tasks", {
      method: "POST",
      body: input,
    });
  },

  async update(
    id: string,
    patch: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      assigneeUserId: string | null;
      dueDate: string;
    }>,
  ): Promise<{ message: string }> {
    return apiRequest(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async remove(id: string): Promise<{ message: string }> {
    return apiRequest(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

export const stockApi = {
  async list(params?: {
    search?: string;
    category?: string;
    lowStock?: boolean;
  }): Promise<{
    items: StockItem[];
    movements: StockMovement[];
    categories: string[];
    summary: {
      totalItems: number;
      totalUnits: number;
      totalValue: number;
      lowStockCount: number;
      outOfStockCount: number;
    };
  }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category) qs.set("category", params.category);
    if (params?.lowStock) qs.set("lowStock", "true");
    const query = qs.toString();
    return apiRequest(`/api/stock/items${query ? `?${query}` : ""}`);
  },

  async create(input: {
    sku?: string;
    name: string;
    category?: string;
    unit?: string;
    quantity?: number;
    minQuantity?: number;
    unitPrice?: number;
    supplier?: string;
    location?: string;
    notes?: string;
  }): Promise<{ id: string }> {
    return apiRequest("/api/stock/items", {
      method: "POST",
      body: input,
    });
  },

  async update(
    id: string,
    patch: Partial<{
      sku: string;
      name: string;
      category: string;
      unit: string;
      minQuantity: number;
      unitPrice: number;
      supplier: string;
      location: string;
      notes: string;
    }>,
  ): Promise<{ message: string }> {
    return apiRequest(`/api/stock/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async remove(id: string): Promise<{ message: string }> {
    return apiRequest(`/api/stock/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async addMovement(
    itemId: string,
    input: { type: StockMovementType; quantity: number; reason?: string },
  ): Promise<{ previousQuantity: number; newQuantity: number; delta: number }> {
    return apiRequest(`/api/stock/items/${encodeURIComponent(itemId)}/movements`, {
      method: "POST",
      body: input,
    });
  },
};

export const logsApi = {
  async list(params?: {
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<{ logs: ActivityLog[] }> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return apiRequest(`/api/logs${query ? `?${query}` : ""}`);
  },
};

export const clientsApi = {
  async list(params?: { search?: string; status?: string }): Promise<{ clients: Client[] }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiRequest(`/api/clients${query ? `?${query}` : ""}`);
  },

  async create(input: {
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: ClientStatus;
    notes?: string;
  }): Promise<{ client: Client }> {
    return apiRequest("/api/clients", {
      method: "POST",
      body: input,
    });
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
  ): Promise<{ client: Client }> {
    return apiRequest(`/api/clients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async remove(id: string): Promise<{ message: string }> {
    return apiRequest(`/api/clients/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async exportCsv(params?: { search?: string; status?: string; ids?: string[] }) {
    const res = await this.list({
      search: params?.search,
      status: params?.status,
    });
    let clients = res.clients;
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
    const { clients: existingClients } = await this.list();
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
    const { clients: existingClients } = await this.list();
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

    const res = await apiRequest<{ imported: number; updated: number }>(
      "/api/clients/import",
      {
        method: "POST",
        body: { ops: batchOps },
      },
    );
    pendingExcelImports.delete(input.importId);

    return {
      report: {
        total: validated.length,
        imported: res.imported,
        updated: res.updated,
        skipped,
        rejected,
        errors: errors.slice(0, 50),
      },
    };
  },
};

export const opportunitiesApi = {
  async list(): Promise<{ opportunities: Opportunity[] }> {
    return apiRequest("/api/opportunities");
  },

  async create(input: {
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate?: string;
    notes?: string;
  }): Promise<{ opportunity: Opportunity }> {
    return apiRequest("/api/opportunities", {
      method: "POST",
      body: input,
    });
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
  ): Promise<{ message: string }> {
    return apiRequest(`/api/opportunities/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },

  async remove(id: string): Promise<{ message: string }> {
    return apiRequest(`/api/opportunities/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
