import { signSessionToken, verifySessionToken } from "./crypto.js";
import { makeId, nowIso, writeActivityLog } from "./db.js";
import type {
  AccountType,
  ApiRequest,
  DbAdapter,
  ModuleKey,
  Role,
  WorkspaceType,
} from "./types.js";

export const SESSION_COOKIE_NAME = "qone_session";
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const VALID_MODULES: ModuleKey[] = ["crm", "sales", "stock", "projects"];

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  account_type: AccountType;
  job_title: string;
  created_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  jobTitle: string;
  createdAt: string;
}

export interface CompanyInfo {
  id: string;
  name: string;
  slug: string;
  workspaceType: WorkspaceType;
  role: Role;
  enabledModules: ModuleKey[];
  member_since: string;
}

export interface PendingUserInvitation {
  id: string;
  companyId: string;
  companyName: string;
  role: Role;
  projectId: string | null;
  projectName: string | null;
  token: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    accountType: row.account_type === "individual" ? "individual" : "company",
    jobTitle: row.job_title || "",
    createdAt: row.created_at,
  };
}

export function parseEnabledModules(raw: string | null | undefined): ModuleKey[] {
  if (!raw) return [...VALID_MODULES];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...VALID_MODULES];
    const filtered = parsed.filter((m): m is ModuleKey =>
      VALID_MODULES.includes(m as ModuleKey),
    );
    return filtered.length > 0 ? filtered : [...VALID_MODULES];
  } catch {
    return [...VALID_MODULES];
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function buildSessionCookie(token: string, isHttps: boolean, maxAgeSeconds = 60 * 60 * 24 * 7): string {
  const encoded = encodeURIComponent(token);
  if (isHttps) {
    return `${SESSION_COOKIE_NAME}=${encoded}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=${maxAgeSeconds}`;
  }
  return `${SESSION_COOKIE_NAME}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function buildClearSessionCookie(isHttps: boolean): string {
  if (isHttps) {
    return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0`;
  }
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function extractRequestToken(req: ApiRequest): { token: string | null; viaCookie: boolean } {
  const auth = req.headers["authorization"];
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    if (bearer) return { token: bearer, viaCookie: false };
  }
  const cookies = parseCookies(req.headers["cookie"]);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return { token: cookieToken, viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

export async function requireAuth(
  req: ApiRequest,
  db: DbAdapter,
  sessionSecret: string,
): Promise<{ user: UserRow; token: string }> {
  const { token, viaCookie } = extractRequestToken(req);
  if (!token) {
    throw new HttpError(401, "Authentification requise.");
  }

  // CSRF defense for cookie-authenticated mutations
  if (viaCookie && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
    const requestedWith = req.headers["x-requested-with"];
    if (requestedWith !== "qone-erp") {
      throw new HttpError(403, "En-tête de sécurité manquant pour cette action.");
    }
  }

  const payload = await verifySessionToken(token, sessionSecret);
  if (!payload) {
    throw new HttpError(401, "Session expirée ou invalide. Veuillez vous reconnecter.");
  }

  const user = await db.queryFirst<UserRow>(
    `SELECT id, email, password_hash, first_name, last_name, account_type, job_title, created_at
     FROM users WHERE id = ?`,
    [payload.sub],
  );
  if (!user) {
    throw new HttpError(401, "Compte utilisateur introuvable.");
  }

  // Issue a fresh bearer token so in-memory client state stays hydrated
  const freshToken = await signSessionToken(user.id, user.email, sessionSecret);
  return { user, token: freshToken };
}

export async function getUserCompanies(
  db: DbAdapter,
  userId: string,
): Promise<CompanyInfo[]> {
  const rows = await db.queryAll<{
    id: string;
    name: string;
    slug: string;
    workspace_type: WorkspaceType;
    role: Role;
    enabled_modules: string;
    joined_at: string;
  }>(
    `SELECT c.id, c.name, c.slug, c.workspace_type, m.role, c.enabled_modules, m.joined_at
     FROM memberships m
     INNER JOIN companies c ON c.id = m.company_id
     WHERE m.user_id = ?
     ORDER BY CASE WHEN c.workspace_type = 'company' THEN 0 ELSE 1 END, m.joined_at ASC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    workspaceType: r.workspace_type === "personal" ? "personal" : "company",
    role: r.role,
    enabledModules: parseEnabledModules(r.enabled_modules),
    member_since: r.joined_at,
  }));
}

export async function getPendingInvitationsForEmail(
  db: DbAdapter,
  email: string,
): Promise<PendingUserInvitation[]> {
  const now = nowIso();
  const rows = await db.queryAll<{
    id: string;
    company_id: string;
    company_name: string;
    role: Role;
    project_id: string | null;
    project_name: string | null;
    token: string;
    invited_by_name: string;
    created_at: string;
    expires_at: string;
  }>(
    `SELECT id, company_id, company_name, role, project_id, project_name, token, invited_by_name, created_at, expires_at
     FROM invitations
     WHERE LOWER(email) = LOWER(?) AND status = 'pending' AND expires_at > ?
     ORDER BY created_at DESC`,
    [email.trim(), now],
  );

  return rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: r.company_name,
    role: r.role,
    projectId: r.project_id,
    projectName: r.project_name,
    token: r.token,
    invitedByName: r.invited_by_name,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

export async function requireCompanyMember(
  req: ApiRequest,
  db: DbAdapter,
  sessionSecret: string,
  allowedRoles?: Role[],
): Promise<{
  user: UserRow;
  token: string;
  companyId: string;
  companyName: string;
  role: Role;
  workspaceType: WorkspaceType;
}> {
  const { user, token } = await requireAuth(req, db, sessionSecret);
  const requestedCompanyId = req.headers["x-company-id"]?.trim() || "";

  let membership: {
    company_id: string;
    name: string;
    workspace_type: WorkspaceType;
    role: Role;
  } | null = null;

  if (requestedCompanyId) {
    membership = await db.queryFirst(
      `SELECT m.company_id, c.name, c.workspace_type, m.role
       FROM memberships m
       INNER JOIN companies c ON c.id = m.company_id
       WHERE m.user_id = ? AND m.company_id = ?`,
      [user.id, requestedCompanyId],
    );
  } else {
    membership = await db.queryFirst(
      `SELECT m.company_id, c.name, c.workspace_type, m.role
       FROM memberships m
       INNER JOIN companies c ON c.id = m.company_id
       WHERE m.user_id = ?
       ORDER BY CASE WHEN c.workspace_type = 'company' THEN 0 ELSE 1 END, m.joined_at ASC
       LIMIT 1`,
      [user.id],
    );
  }

  if (!membership) {
    throw new HttpError(403, "Vous n'avez pas accès à cet espace.");
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new HttpError(
      403,
      "Droits insuffisants pour effectuer cette action dans cet espace.",
    );
  }

  return {
    user,
    token,
    companyId: membership.company_id,
    companyName: membership.name,
    role: membership.role,
    workspaceType: membership.workspace_type === "personal" ? "personal" : "company",
  };
}

export function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "espace";
}

export async function makeUniqueSlug(
  db: DbAdapter,
  name: string,
  excludeCompanyId?: string,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let counter = 2;
  while (true) {
    const existing = await db.queryFirst<{ id: string }>(
      excludeCompanyId
        ? `SELECT id FROM companies WHERE slug = ? AND id != ?`
        : `SELECT id FROM companies WHERE slug = ?`,
      excludeCompanyId ? [candidate, excludeCompanyId] : [candidate],
    );
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

export async function acceptInvitationRecord(
  db: DbAdapter,
  invitation: {
    id: string;
    company_id: string;
    company_name: string;
    email: string;
    role: Role;
    project_id: string | null;
    project_name: string | null;
  },
  user: UserRow,
): Promise<void> {
  const now = nowIso();
  const existingMembership = await db.queryFirst<{ id: string }>(
    `SELECT id FROM memberships WHERE user_id = ? AND company_id = ?`,
    [user.id, invitation.company_id],
  );

  if (!existingMembership) {
    await db.execute(
      `INSERT INTO memberships (id, user_id, company_id, role, department, joined_at)
       VALUES (?, ?, ?, ?, '', ?)`,
      [makeId(), user.id, invitation.company_id, invitation.role, now],
    );
  }

  if (invitation.project_id) {
    const project = await db.queryFirst<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND company_id = ?`,
      [invitation.project_id, invitation.company_id],
    );
    if (project) {
      await db.execute(
        `INSERT OR IGNORE INTO project_members (id, company_id, project_id, user_id, project_role, added_by, added_at)
         VALUES (?, ?, ?, ?, 'contributor', ?, ?)`,
        [makeId(), invitation.company_id, invitation.project_id, user.id, user.id, now],
      );
    }
  }

  await db.execute(`UPDATE invitations SET status = 'accepted' WHERE id = ?`, [
    invitation.id,
  ]);

  const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
  await writeActivityLog(db, {
    companyId: invitation.company_id,
    actorUid: user.id,
    actorName,
    actorEmail: user.email,
    category: "team",
    action: "team.invitation_accepted",
    summary: invitation.project_name
      ? `${actorName} a rejoint l'équipe et le projet « ${invitation.project_name} »`
      : `${actorName} a rejoint l'entreprise`,
  });
}

export async function seedDemoDataForCompany(
  _db: DbAdapter,
  _companyId: string,
  _owner: UserRow,
): Promise<void> {
  // Demo data seeding disabled: newly created accounts start completely empty and clean.
}
