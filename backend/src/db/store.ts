import crypto from "node:crypto";
import { Pool } from "pg";
import { env } from "../config/env.js";
import { ensurePostgresSchema } from "./schema.js";
import type {
  ClientRecord,
  ClientStatus,
  CompanyRecord,
  CompanyWithRole,
  InvitationRecord,
  MembershipRecord,
  ModuleKey,
  OpportunityRecord,
  OpportunityStage,
  PublicUser,
  Role,
  SessionRecord,
  TeamMemberView,
  UserRecord,
} from "../shared/types.js";

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "entreprise";
}

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    createdAt: u.createdAt,
  };
}

export interface DataStore {
  mode: "postgres" | "memory";
  healthCheck(): Promise<{ ok: boolean; mode: "postgres" | "memory" }>;

  hasAnyUsers(): Promise<boolean>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }): Promise<UserRecord>;

  createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: string;
  }): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;

  createCompanyWithOwner(input: {
    userId: string;
    name: string;
    enabledModules?: ModuleKey[];
  }): Promise<CompanyWithRole>;
  listCompaniesForUser(userId: string): Promise<CompanyWithRole[]>;
  findCompanyById(companyId: string): Promise<CompanyRecord | null>;
  updateCompany(
    companyId: string,
    patch: { name?: string; slug?: string; enabledModules?: ModuleKey[] },
  ): Promise<CompanyRecord | null>;
  getMembership(userId: string, companyId: string): Promise<MembershipRecord | null>;
  addMembership(input: {
    userId: string;
    companyId: string;
    role: Role;
  }): Promise<MembershipRecord>;
  updateMembershipRole(
    companyId: string,
    membershipId: string,
    role: Role,
  ): Promise<MembershipRecord | null>;
  removeMembership(companyId: string, membershipId: string): Promise<boolean>;
  listTeamMembers(companyId: string): Promise<TeamMemberView[]>;

  createInvitation(input: {
    companyId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    token: string;
    invitedByUserId: string;
    expiresAt: string;
  }): Promise<InvitationRecord>;
  listInvitations(companyId: string): Promise<InvitationRecord[]>;
  findInvitationByToken(token: string): Promise<(InvitationRecord & { companyName: string }) | null>;
  markInvitationAccepted(invitationId: string): Promise<void>;
  revokeInvitation(companyId: string, invitationId: string): Promise<boolean>;

  listClients(companyId: string): Promise<ClientRecord[]>;
  findClientById(companyId: string, clientId: string): Promise<ClientRecord | null>;
  createClient(input: {
    companyId: string;
    name: string;
    email: string;
    phone: string;
    companyName: string;
    status: ClientStatus;
    notes: string;
  }): Promise<ClientRecord>;
  updateClient(
    companyId: string,
    clientId: string,
    patch: Partial<{
      name: string;
      email: string;
      phone: string;
      companyName: string;
      status: ClientStatus;
      notes: string;
    }>,
  ): Promise<ClientRecord | null>;
  deleteClient(companyId: string, clientId: string): Promise<boolean>;

  listOpportunities(companyId: string): Promise<OpportunityRecord[]>;
  findOpportunityById(
    companyId: string,
    opportunityId: string,
  ): Promise<OpportunityRecord | null>;
  createOpportunity(input: {
    companyId: string;
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate: string;
    notes: string;
    ownerUserId: string;
  }): Promise<OpportunityRecord>;
  updateOpportunity(
    companyId: string,
    opportunityId: string,
    patch: Partial<{
      clientId: string;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expectedCloseDate: string;
      notes: string;
    }>,
  ): Promise<OpportunityRecord | null>;
  deleteOpportunity(companyId: string, opportunityId: string): Promise<boolean>;
}

class MemoryStore implements DataStore {
  mode: "memory" = "memory";
  private users = new Map<string, UserRecord>();
  private companies = new Map<string, CompanyRecord>();
  private memberships = new Map<string, MembershipRecord>();
  private sessions = new Map<string, SessionRecord>();
  private invitations = new Map<string, InvitationRecord>();
  private clients = new Map<string, ClientRecord>();
  private opportunities = new Map<string, OpportunityRecord>();

  async healthCheck() {
    return { ok: true, mode: this.mode };
  }

  async hasAnyUsers(): Promise<boolean> {
    return this.users.size > 0;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalized) return user;
    }
    return null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async createUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const user: UserRecord = {
      id: crypto.randomUUID(),
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: string;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: crypto.randomUUID(),
      tokenHash: input.tokenHash,
      userId: input.userId,
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(session.tokenHash, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(tokenHash);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(tokenHash);
      return null;
    }
    return session;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  private generateUniqueSlug(name: string, excludeCompanyId?: string): string {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;
    const isTaken = (slug: string) => {
      for (const c of this.companies.values()) {
        if (c.slug === slug && c.id !== excludeCompanyId) return true;
      }
      return false;
    };
    while (isTaken(candidate)) {
      candidate = `${base}-${counter++}`;
    }
    return candidate;
  }

  async createCompanyWithOwner(input: {
    userId: string;
    name: string;
    enabledModules?: ModuleKey[];
  }): Promise<CompanyWithRole> {
    const now = new Date().toISOString();
    const company: CompanyRecord = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      slug: this.generateUniqueSlug(input.name),
      enabledModules: input.enabledModules ?? ["crm", "sales"],
      createdAt: now,
    };
    this.companies.set(company.id, company);

    const membership: MembershipRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      companyId: company.id,
      role: "owner",
      createdAt: now,
    };
    this.memberships.set(membership.id, membership);

    return {
      ...company,
      role: "owner",
      member_since: now,
    };
  }

  async listCompaniesForUser(userId: string): Promise<CompanyWithRole[]> {
    const result: CompanyWithRole[] = [];
    for (const m of this.memberships.values()) {
      if (m.userId !== userId) continue;
      const company = this.companies.get(m.companyId);
      if (!company) continue;
      result.push({
        ...company,
        role: m.role,
        member_since: m.createdAt,
      });
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findCompanyById(companyId: string): Promise<CompanyRecord | null> {
    return this.companies.get(companyId) ?? null;
  }

  async updateCompany(
    companyId: string,
    patch: { name?: string; slug?: string; enabledModules?: ModuleKey[] },
  ): Promise<CompanyRecord | null> {
    const existing = this.companies.get(companyId);
    if (!existing) return null;
    const updated: CompanyRecord = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      slug:
        patch.slug !== undefined
          ? this.generateUniqueSlug(patch.slug, companyId)
          : existing.slug,
      enabledModules:
        patch.enabledModules !== undefined
          ? patch.enabledModules
          : existing.enabledModules,
    };
    this.companies.set(companyId, updated);
    return updated;
  }

  async getMembership(
    userId: string,
    companyId: string,
  ): Promise<MembershipRecord | null> {
    for (const m of this.memberships.values()) {
      if (m.userId === userId && m.companyId === companyId) return m;
    }
    return null;
  }

  async addMembership(input: {
    userId: string;
    companyId: string;
    role: Role;
  }): Promise<MembershipRecord> {
    const existing = await this.getMembership(input.userId, input.companyId);
    if (existing) return existing;
    const membership: MembershipRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      companyId: input.companyId,
      role: input.role,
      createdAt: new Date().toISOString(),
    };
    this.memberships.set(membership.id, membership);
    return membership;
  }

  async updateMembershipRole(
    companyId: string,
    membershipId: string,
    role: Role,
  ): Promise<MembershipRecord | null> {
    const m = this.memberships.get(membershipId);
    if (!m || m.companyId !== companyId) return null;
    const updated = { ...m, role };
    this.memberships.set(membershipId, updated);
    return updated;
  }

  async removeMembership(companyId: string, membershipId: string): Promise<boolean> {
    const m = this.memberships.get(membershipId);
    if (!m || m.companyId !== companyId) return false;
    return this.memberships.delete(membershipId);
  }

  async listTeamMembers(companyId: string): Promise<TeamMemberView[]> {
    const members: TeamMemberView[] = [];
    for (const m of this.memberships.values()) {
      if (m.companyId !== companyId) continue;
      const user = this.users.get(m.userId);
      if (!user) continue;
      members.push({
        id: m.id,
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: m.role,
        joinedAt: m.createdAt,
      });
    }
    return members.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async createInvitation(input: {
    companyId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    token: string;
    invitedByUserId: string;
    expiresAt: string;
  }): Promise<InvitationRecord> {
    const inv: InvitationRecord = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      role: input.role,
      token: input.token,
      invitedByUserId: input.invitedByUserId,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
    };
    this.invitations.set(inv.id, inv);
    return inv;
  }

  async listInvitations(companyId: string): Promise<InvitationRecord[]> {
    const list: InvitationRecord[] = [];
    for (const inv of this.invitations.values()) {
      if (inv.companyId === companyId && inv.status === "pending") {
        list.push(inv);
      }
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findInvitationByToken(
    token: string,
  ): Promise<(InvitationRecord & { companyName: string }) | null> {
    for (const inv of this.invitations.values()) {
      if (inv.token !== token) continue;
      if (inv.status !== "pending") return null;
      if (new Date(inv.expiresAt).getTime() <= Date.now()) return null;
      const company = this.companies.get(inv.companyId);
      if (!company) return null;
      return { ...inv, companyName: company.name };
    }
    return null;
  }

  async markInvitationAccepted(invitationId: string): Promise<void> {
    const inv = this.invitations.get(invitationId);
    if (inv) {
      this.invitations.set(invitationId, { ...inv, status: "accepted" });
    }
  }

  async revokeInvitation(companyId: string, invitationId: string): Promise<boolean> {
    const inv = this.invitations.get(invitationId);
    if (!inv || inv.companyId !== companyId) return false;
    this.invitations.set(invitationId, { ...inv, status: "revoked" });
    return true;
  }

  async listClients(companyId: string): Promise<ClientRecord[]> {
    const list: ClientRecord[] = [];
    for (const c of this.clients.values()) {
      if (c.companyId === companyId) list.push(c);
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findClientById(
    companyId: string,
    clientId: string,
  ): Promise<ClientRecord | null> {
    const c = this.clients.get(clientId);
    if (!c || c.companyId !== companyId) return null;
    return c;
  }

  async createClient(input: {
    companyId: string;
    name: string;
    email: string;
    phone: string;
    companyName: string;
    status: ClientStatus;
    notes: string;
  }): Promise<ClientRecord> {
    const now = new Date().toISOString();
    const record: ClientRecord = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      companyName: input.companyName.trim(),
      status: input.status,
      notes: input.notes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.clients.set(record.id, record);
    return record;
  }

  async updateClient(
    companyId: string,
    clientId: string,
    patch: Partial<{
      name: string;
      email: string;
      phone: string;
      companyName: string;
      status: ClientStatus;
      notes: string;
    }>,
  ): Promise<ClientRecord | null> {
    const existing = this.clients.get(clientId);
    if (!existing || existing.companyId !== companyId) return null;
    const updated: ClientRecord = {
      ...existing,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      email:
        patch.email !== undefined
          ? patch.email.trim().toLowerCase()
          : existing.email,
      phone: patch.phone !== undefined ? patch.phone.trim() : existing.phone,
      companyName:
        patch.companyName !== undefined
          ? patch.companyName.trim()
          : existing.companyName,
      status: patch.status !== undefined ? patch.status : existing.status,
      notes: patch.notes !== undefined ? patch.notes.trim() : existing.notes,
      updatedAt: new Date().toISOString(),
    };
    this.clients.set(clientId, updated);
    return updated;
  }

  async deleteClient(companyId: string, clientId: string): Promise<boolean> {
    const existing = this.clients.get(clientId);
    if (!existing || existing.companyId !== companyId) return false;
    for (const [oppId, opp] of this.opportunities.entries()) {
      if (opp.companyId === companyId && opp.clientId === clientId) {
        this.opportunities.delete(oppId);
      }
    }
    return this.clients.delete(clientId);
  }

  async listOpportunities(companyId: string): Promise<OpportunityRecord[]> {
    const list: OpportunityRecord[] = [];
    for (const opp of this.opportunities.values()) {
      if (opp.companyId !== companyId) continue;
      const client = this.clients.get(opp.clientId);
      const owner = this.users.get(opp.ownerUserId);
      list.push({
        ...opp,
        clientName: client?.name ?? "Client supprimé",
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : "",
      });
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async findOpportunityById(
    companyId: string,
    opportunityId: string,
  ): Promise<OpportunityRecord | null> {
    const opp = this.opportunities.get(opportunityId);
    if (!opp || opp.companyId !== companyId) return null;
    return opp;
  }

  async createOpportunity(input: {
    companyId: string;
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate: string;
    notes: string;
    ownerUserId: string;
  }): Promise<OpportunityRecord> {
    const now = new Date().toISOString();
    const client = this.clients.get(input.clientId);
    const owner = this.users.get(input.ownerUserId);
    const opp: OpportunityRecord = {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      clientId: input.clientId,
      clientName: client?.name ?? "",
      title: input.title.trim(),
      amount: input.amount,
      probability: input.probability,
      stage: input.stage,
      expectedCloseDate: input.expectedCloseDate.trim(),
      notes: input.notes.trim(),
      ownerUserId: input.ownerUserId,
      ownerName: owner ? `${owner.firstName} ${owner.lastName}` : "",
      createdAt: now,
      updatedAt: now,
    };
    this.opportunities.set(opp.id, opp);
    return opp;
  }

  async updateOpportunity(
    companyId: string,
    opportunityId: string,
    patch: Partial<{
      clientId: string;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expectedCloseDate: string;
      notes: string;
    }>,
  ): Promise<OpportunityRecord | null> {
    const existing = this.opportunities.get(opportunityId);
    if (!existing || existing.companyId !== companyId) return null;
    const nextClientId = patch.clientId ?? existing.clientId;
    const client = this.clients.get(nextClientId);
    const owner = this.users.get(existing.ownerUserId);
    const updated: OpportunityRecord = {
      ...existing,
      clientId: nextClientId,
      clientName: client?.name ?? existing.clientName,
      ownerName: owner ? `${owner.firstName} ${owner.lastName}` : existing.ownerName,
      title: patch.title !== undefined ? patch.title.trim() : existing.title,
      amount: patch.amount !== undefined ? patch.amount : existing.amount,
      probability:
        patch.probability !== undefined ? patch.probability : existing.probability,
      stage: patch.stage !== undefined ? patch.stage : existing.stage,
      expectedCloseDate:
        patch.expectedCloseDate !== undefined
          ? patch.expectedCloseDate.trim()
          : existing.expectedCloseDate,
      notes: patch.notes !== undefined ? patch.notes.trim() : existing.notes,
      updatedAt: new Date().toISOString(),
    };
    this.opportunities.set(opportunityId, updated);
    return updated;
  }

  async deleteOpportunity(
    companyId: string,
    opportunityId: string,
  ): Promise<boolean> {
    const existing = this.opportunities.get(opportunityId);
    if (!existing || existing.companyId !== companyId) return false;
    return this.opportunities.delete(opportunityId);
  }
}

class PostgresStore implements DataStore {
  mode: "postgres" = "postgres";
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async healthCheck() {
    await this.pool.query("SELECT 1");
    return { ok: true, mode: this.mode };
  }

  async hasAnyUsers(): Promise<boolean> {
    const res = await this.pool.query("SELECT 1 FROM users LIMIT 1");
    return res.rows.length > 0;
  }

  private mapUser(row: Record<string, unknown>): UserRecord {
    return {
      id: String(row.id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      passwordHash: String(row.password_hash),
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  private mapCompany(row: Record<string, unknown>): CompanyRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      enabledModules: Array.isArray(row.enabled_modules)
        ? (row.enabled_modules as ModuleKey[])
        : ["crm", "sales"],
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email.trim()],
    );
    return res.rows[0] ? this.mapUser(res.rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const res = await this.pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [
      id,
    ]);
    return res.rows[0] ? this.mapUser(res.rows[0]) : null;
  }

  async createUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const id = crypto.randomUUID();
    const res = await this.pool.query(
      `INSERT INTO users (id, email, first_name, last_name, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        id,
        input.email.trim().toLowerCase(),
        input.firstName.trim(),
        input.lastName.trim(),
        input.passwordHash,
      ],
    );
    return this.mapUser(res.rows[0]);
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: string;
  }): Promise<SessionRecord> {
    const id = crypto.randomUUID();
    const res = await this.pool.query(
      `INSERT INTO sessions (id, token_hash, user_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, input.tokenHash, input.userId, input.expiresAt],
    );
    const row = res.rows[0];
    return {
      id: String(row.id),
      tokenHash: String(row.token_hash),
      userId: String(row.user_id),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM sessions WHERE token_hash = $1 LIMIT 1",
      [tokenHash],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    const expiresAt = new Date(String(row.expires_at));
    if (expiresAt.getTime() <= Date.now()) {
      await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [
        tokenHash,
      ]);
      return null;
    }
    return {
      id: String(row.id),
      tokenHash: String(row.token_hash),
      userId: String(row.user_id),
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      tokenHash,
    ]);
  }

  private async generateUniqueSlug(
    name: string,
    excludeCompanyId?: string,
  ): Promise<string> {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;
    while (true) {
      const res = await this.pool.query(
        "SELECT id FROM companies WHERE slug = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1",
        [candidate, excludeCompanyId ?? null],
      );
      if (res.rows.length === 0) return candidate;
      candidate = `${base}-${counter++}`;
    }
  }

  async createCompanyWithOwner(input: {
    userId: string;
    name: string;
    enabledModules?: ModuleKey[];
  }): Promise<CompanyWithRole> {
    const companyId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const slug = await this.generateUniqueSlug(input.name);
    const modules = input.enabledModules ?? ["crm", "sales"];

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const compRes = await client.query(
        `INSERT INTO companies (id, name, slug, enabled_modules)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING *`,
        [companyId, input.name.trim(), slug, JSON.stringify(modules)],
      );
      const memRes = await client.query(
        `INSERT INTO memberships (id, user_id, company_id, role)
         VALUES ($1, $2, $3, 'owner')
         RETURNING *`,
        [membershipId, input.userId, companyId],
      );
      await client.query("COMMIT");
      return {
        ...this.mapCompany(compRes.rows[0]),
        role: "owner",
        member_since: new Date(String(memRes.rows[0].created_at)).toISOString(),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listCompaniesForUser(userId: string): Promise<CompanyWithRole[]> {
    const res = await this.pool.query(
      `SELECT c.*, m.role, m.created_at AS member_since
       FROM companies c
       INNER JOIN memberships m ON m.company_id = c.id
       WHERE m.user_id = $1
       ORDER BY c.created_at ASC`,
      [userId],
    );
    return res.rows.map((row) => ({
      ...this.mapCompany(row),
      role: String(row.role) as Role,
      member_since: new Date(String(row.member_since)).toISOString(),
    }));
  }

  async findCompanyById(companyId: string): Promise<CompanyRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM companies WHERE id = $1 LIMIT 1",
      [companyId],
    );
    return res.rows[0] ? this.mapCompany(res.rows[0]) : null;
  }

  async updateCompany(
    companyId: string,
    patch: { name?: string; slug?: string; enabledModules?: ModuleKey[] },
  ): Promise<CompanyRecord | null> {
    const existing = await this.findCompanyById(companyId);
    if (!existing) return null;
    const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
    const nextSlug =
      patch.slug !== undefined
        ? await this.generateUniqueSlug(patch.slug, companyId)
        : existing.slug;
    const nextModules =
      patch.enabledModules !== undefined
        ? patch.enabledModules
        : existing.enabledModules;

    const res = await this.pool.query(
      `UPDATE companies
       SET name = $1, slug = $2, enabled_modules = $3::jsonb
       WHERE id = $4
       RETURNING *`,
      [nextName, nextSlug, JSON.stringify(nextModules), companyId],
    );
    return res.rows[0] ? this.mapCompany(res.rows[0]) : null;
  }

  async getMembership(
    userId: string,
    companyId: string,
  ): Promise<MembershipRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM memberships WHERE user_id = $1 AND company_id = $2 LIMIT 1",
      [userId, companyId],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: String(row.id),
      userId: String(row.user_id),
      companyId: String(row.company_id),
      role: String(row.role) as Role,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async addMembership(input: {
    userId: string;
    companyId: string;
    role: Role;
  }): Promise<MembershipRecord> {
    const existing = await this.getMembership(input.userId, input.companyId);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const res = await this.pool.query(
      `INSERT INTO memberships (id, user_id, company_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, input.userId, input.companyId, input.role],
    );
    const row = res.rows[0];
    return {
      id: String(row.id),
      userId: String(row.user_id),
      companyId: String(row.company_id),
      role: String(row.role) as Role,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async updateMembershipRole(
    companyId: string,
    membershipId: string,
    role: Role,
  ): Promise<MembershipRecord | null> {
    const res = await this.pool.query(
      `UPDATE memberships SET role = $1
       WHERE id = $2 AND company_id = $3
       RETURNING *`,
      [role, membershipId, companyId],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: String(row.id),
      userId: String(row.user_id),
      companyId: String(row.company_id),
      role: String(row.role) as Role,
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  async removeMembership(companyId: string, membershipId: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM memberships WHERE id = $1 AND company_id = $2",
      [membershipId, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listTeamMembers(companyId: string): Promise<TeamMemberView[]> {
    const res = await this.pool.query(
      `SELECT m.id, m.user_id, m.role, m.created_at, u.email, u.first_name, u.last_name
       FROM memberships m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.company_id = $1
       ORDER BY m.created_at ASC`,
      [companyId],
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      role: String(row.role) as Role,
      joinedAt: new Date(String(row.created_at)).toISOString(),
    }));
  }

  async createInvitation(input: {
    companyId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    token: string;
    invitedByUserId: string;
    expiresAt: string;
  }): Promise<InvitationRecord> {
    const id = crypto.randomUUID();
    const res = await this.pool.query(
      `INSERT INTO invitations (id, company_id, email, first_name, last_name, role, token, invited_by_user_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
       RETURNING *`,
      [
        id,
        input.companyId,
        input.email.trim().toLowerCase(),
        input.firstName.trim(),
        input.lastName.trim(),
        input.role,
        input.token,
        input.invitedByUserId,
        input.expiresAt,
      ],
    );
    const row = res.rows[0];
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      role: String(row.role) as Role,
      token: String(row.token),
      invitedByUserId: String(row.invited_by_user_id),
      status: String(row.status) as "pending" | "accepted" | "revoked",
      createdAt: new Date(String(row.created_at)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    };
  }

  async listInvitations(companyId: string): Promise<InvitationRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM invitations
       WHERE company_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [companyId],
    );
    return res.rows.map((row) => ({
      id: String(row.id),
      companyId: String(row.company_id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      role: String(row.role) as Role,
      token: String(row.token),
      invitedByUserId: String(row.invited_by_user_id),
      status: String(row.status) as "pending" | "accepted" | "revoked",
      createdAt: new Date(String(row.created_at)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    }));
  }

  async findInvitationByToken(
    token: string,
  ): Promise<(InvitationRecord & { companyName: string }) | null> {
    const res = await this.pool.query(
      `SELECT i.*, c.name AS company_name
       FROM invitations i
       INNER JOIN companies c ON c.id = i.company_id
       WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW()
       LIMIT 1`,
      [token],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      role: String(row.role) as Role,
      token: String(row.token),
      invitedByUserId: String(row.invited_by_user_id),
      status: String(row.status) as "pending" | "accepted" | "revoked",
      createdAt: new Date(String(row.created_at)).toISOString(),
      expiresAt: new Date(String(row.expires_at)).toISOString(),
      companyName: String(row.company_name),
    };
  }

  async markInvitationAccepted(invitationId: string): Promise<void> {
    await this.pool.query(
      "UPDATE invitations SET status = 'accepted' WHERE id = $1",
      [invitationId],
    );
  }

  async revokeInvitation(companyId: string, invitationId: string): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE invitations SET status = 'revoked' WHERE id = $1 AND company_id = $2",
      [invitationId, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapClient(row: Record<string, unknown>): ClientRecord {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      name: String(row.name),
      email: String(row.email),
      phone: String(row.phone),
      companyName: String(row.company_name),
      status: String(row.status) as ClientStatus,
      notes: String(row.notes),
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async listClients(companyId: string): Promise<ClientRecord[]> {
    const res = await this.pool.query(
      "SELECT * FROM clients WHERE company_id = $1 ORDER BY created_at DESC",
      [companyId],
    );
    return res.rows.map((r) => this.mapClient(r));
  }

  async findClientById(
    companyId: string,
    clientId: string,
  ): Promise<ClientRecord | null> {
    const res = await this.pool.query(
      "SELECT * FROM clients WHERE id = $1 AND company_id = $2 LIMIT 1",
      [clientId, companyId],
    );
    return res.rows[0] ? this.mapClient(res.rows[0]) : null;
  }

  async createClient(input: {
    companyId: string;
    name: string;
    email: string;
    phone: string;
    companyName: string;
    status: ClientStatus;
    notes: string;
  }): Promise<ClientRecord> {
    const id = crypto.randomUUID();
    const res = await this.pool.query(
      `INSERT INTO clients (id, company_id, name, email, phone, company_name, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        input.companyId,
        input.name.trim(),
        input.email.trim().toLowerCase(),
        input.phone.trim(),
        input.companyName.trim(),
        input.status,
        input.notes.trim(),
      ],
    );
    return this.mapClient(res.rows[0]);
  }

  async updateClient(
    companyId: string,
    clientId: string,
    patch: Partial<{
      name: string;
      email: string;
      phone: string;
      companyName: string;
      status: ClientStatus;
      notes: string;
    }>,
  ): Promise<ClientRecord | null> {
    const existing = await this.findClientById(companyId, clientId);
    if (!existing) return null;
    const res = await this.pool.query(
      `UPDATE clients
       SET name = $1, email = $2, phone = $3, company_name = $4, status = $5, notes = $6, updated_at = NOW()
       WHERE id = $7 AND company_id = $8
       RETURNING *`,
      [
        patch.name !== undefined ? patch.name.trim() : existing.name,
        patch.email !== undefined
          ? patch.email.trim().toLowerCase()
          : existing.email,
        patch.phone !== undefined ? patch.phone.trim() : existing.phone,
        patch.companyName !== undefined
          ? patch.companyName.trim()
          : existing.companyName,
        patch.status !== undefined ? patch.status : existing.status,
        patch.notes !== undefined ? patch.notes.trim() : existing.notes,
        clientId,
        companyId,
      ],
    );
    return res.rows[0] ? this.mapClient(res.rows[0]) : null;
  }

  async deleteClient(companyId: string, clientId: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM clients WHERE id = $1 AND company_id = $2",
      [clientId, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapOpportunity(row: Record<string, unknown>): OpportunityRecord {
    return {
      id: String(row.id),
      companyId: String(row.company_id),
      clientId: String(row.client_id),
      clientName: row.client_name ? String(row.client_name) : "",
      title: String(row.title),
      amount: Number(row.amount),
      probability: Number(row.probability),
      stage: String(row.stage) as OpportunityStage,
      expectedCloseDate: String(row.expected_close_date),
      notes: String(row.notes),
      ownerUserId: String(row.owner_user_id),
      ownerName: row.owner_name ? String(row.owner_name) : "",
      createdAt: new Date(String(row.created_at)).toISOString(),
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async listOpportunities(companyId: string): Promise<OpportunityRecord[]> {
    const res = await this.pool.query(
      `SELECT o.*, c.name AS client_name, CONCAT(u.first_name, ' ', u.last_name) AS owner_name
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN users u ON u.id = o.owner_user_id
       WHERE o.company_id = $1
       ORDER BY o.updated_at DESC`,
      [companyId],
    );
    return res.rows.map((r) => this.mapOpportunity(r));
  }

  async findOpportunityById(
    companyId: string,
    opportunityId: string,
  ): Promise<OpportunityRecord | null> {
    const res = await this.pool.query(
      `SELECT o.*, c.name AS client_name, CONCAT(u.first_name, ' ', u.last_name) AS owner_name
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN users u ON u.id = o.owner_user_id
       WHERE o.id = $1 AND o.company_id = $2
       LIMIT 1`,
      [opportunityId, companyId],
    );
    return res.rows[0] ? this.mapOpportunity(res.rows[0]) : null;
  }

  async createOpportunity(input: {
    companyId: string;
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate: string;
    notes: string;
    ownerUserId: string;
  }): Promise<OpportunityRecord> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO opportunities (id, company_id, client_id, title, amount, probability, stage, expected_close_date, notes, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.companyId,
        input.clientId,
        input.title.trim(),
        input.amount,
        input.probability,
        input.stage,
        input.expectedCloseDate.trim(),
        input.notes.trim(),
        input.ownerUserId,
      ],
    );
    const created = await this.findOpportunityById(input.companyId, id);
    if (!created) {
      throw new Error("Opportunity creation failed");
    }
    return created;
  }

  async updateOpportunity(
    companyId: string,
    opportunityId: string,
    patch: Partial<{
      clientId: string;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expectedCloseDate: string;
      notes: string;
    }>,
  ): Promise<OpportunityRecord | null> {
    const existing = await this.findOpportunityById(companyId, opportunityId);
    if (!existing) return null;
    await this.pool.query(
      `UPDATE opportunities
       SET client_id = $1, title = $2, amount = $3, probability = $4, stage = $5, expected_close_date = $6, notes = $7, updated_at = NOW()
       WHERE id = $8 AND company_id = $9`,
      [
        patch.clientId ?? existing.clientId,
        patch.title !== undefined ? patch.title.trim() : existing.title,
        patch.amount !== undefined ? patch.amount : existing.amount,
        patch.probability !== undefined ? patch.probability : existing.probability,
        patch.stage !== undefined ? patch.stage : existing.stage,
        patch.expectedCloseDate !== undefined
          ? patch.expectedCloseDate.trim()
          : existing.expectedCloseDate,
        patch.notes !== undefined ? patch.notes.trim() : existing.notes,
        opportunityId,
        companyId,
      ],
    );
    return this.findOpportunityById(companyId, opportunityId);
  }

  async deleteOpportunity(
    companyId: string,
    opportunityId: string,
  ): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM opportunities WHERE id = $1 AND company_id = $2",
      [opportunityId, companyId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

let activeStore: DataStore | null = null;

export async function initStore(): Promise<DataStore> {
  if (activeStore) return activeStore;

  if (env.databaseUrl) {
    try {
      const pool = new Pool({ connectionString: env.databaseUrl });
      await pool.query("SELECT 1");
      await ensurePostgresSchema(pool);
      activeStore = new PostgresStore(pool);
      console.log("[qone] PostgreSQL connecté");
      return activeStore;
    } catch {
      console.warn(
        "[qone] PostgreSQL indisponible — bascule vers le stockage en mémoire",
      );
    }
  } else {
    console.warn(
      "[qone] DATABASE_URL non configuré — stockage en mémoire actif",
    );
  }

  activeStore = new MemoryStore();
  return activeStore;
}

export function getStore(): DataStore {
  if (!activeStore) {
    activeStore = new MemoryStore();
  }
  return activeStore;
}
