import {
  acceptInvitationRecord,
  buildClearSessionCookie,
  buildSessionCookie,
  EMAIL_RE,
  getPendingInvitationsForEmail,
  getUserCompanies,
  HttpError,
  makeUniqueSlug,
  requireAuth,
  requireCompanyMember,
  seedDemoDataForCompany,
  toPublicUser,
  type UserRow,
} from "../core/context.js";
import { hashPassword, randomHex, signSessionToken, verifyPassword } from "../core/crypto.js";
import { makeId, nowIso, writeActivityLog } from "../core/db.js";
import type { AccountType, ApiRequest, ApiResponse, DbAdapter, Role, RuntimeConfig } from "../core/types.js";

export async function handleAuthRoutes(
  req: ApiRequest,
  db: DbAdapter,
  config: RuntimeConfig,
): Promise<ApiResponse | null> {
  const path = req.path;

  if (req.method === "POST" && path === "/api/auth/register") {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const accountType: AccountType =
      body.accountType === "individual" ? "individual" : "company";
    const companyNameInput = String(body.companyName || "").trim();
    const jobTitle = String(body.jobTitle || "").trim();
    const inviteToken = String(body.inviteToken || "").trim();

    if (!EMAIL_RE.test(email)) {
      throw new HttpError(400, "Adresse email invalide.");
    }
    if (password.length < 8) {
      throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (!firstName) {
      throw new HttpError(400, "Le prénom est obligatoire.");
    }
    if (!inviteToken && accountType === "company" && !companyNameInput) {
      throw new HttpError(400, "Le nom de l'entreprise est obligatoire.");
    }

    const existing = await db.queryFirst<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`,
      [email],
    );
    if (existing) {
      throw new HttpError(409, "Un compte existe déjà avec cette adresse email.");
    }

    const now = nowIso();
    const userId = makeId();
    const passwordHash = await hashPassword(password);

    await db.execute(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, account_type, job_title, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, passwordHash, firstName, lastName, accountType, jobTitle, now],
    );

    const userRow: UserRow = {
      id: userId,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      account_type: accountType,
      job_title: jobTitle,
      created_at: now,
    };

    if (inviteToken) {
      const inv = await db.queryFirst<{
        id: string;
        company_id: string;
        company_name: string;
        email: string;
        role: Role;
        project_id: string | null;
        project_name: string | null;
        status: string;
        expires_at: string;
      }>(
        `SELECT id, company_id, company_name, email, role, project_id, project_name, status, expires_at
         FROM invitations WHERE token = ?`,
        [inviteToken],
      );

      if (!inv || inv.status !== "pending" || inv.expires_at < now) {
        throw new HttpError(400, "Cette invitation est invalide ou expirée.");
      }
      if (inv.email.toLowerCase() !== email) {
        throw new HttpError(
          400,
          `Cette invitation est réservée à l'adresse ${inv.email}.`,
        );
      }

      await acceptInvitationRecord(db, inv, userRow);
    } else if (accountType === "company") {
      const companyId = makeId();
      const slug = await makeUniqueSlug(db, companyNameInput);
      const modulesJson = JSON.stringify(["crm", "sales", "stock", "projects"]);

      await db.execute(
        `INSERT INTO companies (id, name, slug, workspace_type, enabled_modules, created_by, created_at)
         VALUES (?, ?, ?, 'company', ?, ?, ?)`,
        [companyId, companyNameInput, slug, modulesJson, userId, now],
      );
      await db.execute(
        `INSERT INTO memberships (id, user_id, company_id, role, department, joined_at)
         VALUES (?, ?, ?, 'owner', 'Direction', ?)`,
        [makeId(), userId, companyId, now],
      );

      const actorName = `${firstName} ${lastName}`.trim() || email;
      await writeActivityLog(db, {
        companyId,
        actorUid: userId,
        actorName,
        actorEmail: email,
        category: "settings",
        action: "company.created",
        summary: `Entreprise « ${companyNameInput} » créée par ${actorName}`,
      });
    } else {
      // Individual / Employee personal workspace
      const personalName = `Espace personnel — ${firstName}`;
      const companyId = makeId();
      const slug = await makeUniqueSlug(db, `perso-${firstName}-${userId.slice(0, 4)}`);
      const modulesJson = JSON.stringify(["projects", "stock", "crm", "sales"]);

      await db.execute(
        `INSERT INTO companies (id, name, slug, workspace_type, enabled_modules, created_by, created_at)
         VALUES (?, ?, ?, 'personal', ?, ?, ?)`,
        [companyId, personalName, slug, modulesJson, userId, now],
      );
      await db.execute(
        `INSERT INTO memberships (id, user_id, company_id, role, department, joined_at)
         VALUES (?, ?, ?, 'owner', 'Personnel', ?)`,
        [makeId(), userId, companyId, now],
      );

      const actorName = `${firstName} ${lastName}`.trim() || email;
      await writeActivityLog(db, {
        companyId,
        actorUid: userId,
        actorName,
        actorEmail: email,
        category: "settings",
        action: "personal.created",
        summary: `Compte particulier créé pour ${actorName}`,
      });
    }

    const companies = await getUserCompanies(db, userId);
    const pendingInvitations = await getPendingInvitationsForEmail(db, email);
    const token = await signSessionToken(userId, email, config.sessionSecret);

    return {
      status: 201,
      setCookie: buildSessionCookie(token, req.isHttps),
      body: {
        user: toPublicUser(userRow),
        companies,
        company: companies[0],
        pendingInvitations,
        token,
      },
    };
  }

  if (req.method === "POST" && path === "/api/auth/login") {
    const body = (req.body || {}) as Record<string, unknown>;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const mode: AccountType | undefined =
      body.mode === "company" || body.mode === "individual" ? body.mode : undefined;
    const inviteToken = String(body.inviteToken || "").trim();

    if (!email || !password) {
      throw new HttpError(400, "Veuillez renseigner votre email et votre mot de passe.");
    }

    const user = await db.queryFirst<UserRow>(
      `SELECT id, email, password_hash, first_name, last_name, account_type, job_title, created_at
       FROM users WHERE LOWER(email) = LOWER(?)`,
      [email],
    );
    if (!user) {
      throw new HttpError(401, "Email ou mot de passe incorrect.");
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      throw new HttpError(401, "Email ou mot de passe incorrect.");
    }

    if (inviteToken) {
      const now = nowIso();
      const inv = await db.queryFirst<{
        id: string;
        company_id: string;
        company_name: string;
        email: string;
        role: Role;
        project_id: string | null;
        project_name: string | null;
        status: string;
        expires_at: string;
      }>(
        `SELECT id, company_id, company_name, email, role, project_id, project_name, status, expires_at
         FROM invitations WHERE token = ?`,
        [inviteToken],
      );
      if (!inv || inv.status !== "pending" || inv.expires_at < now) {
        throw new HttpError(400, "Cette invitation est invalide ou expirée.");
      }
      if (inv.email.toLowerCase() !== email) {
        throw new HttpError(
          400,
          `Cette invitation est destinée à ${inv.email}.`,
        );
      }
      await acceptInvitationRecord(db, inv, user);
    }

    let companies = await getUserCompanies(db, user.id);
    const pendingInvitations = await getPendingInvitationsForEmail(db, user.email);

    if (mode === "company") {
      const hasCompanyWorkspace = companies.some((c) => c.workspaceType === "company");
      if (!hasCompanyWorkspace && pendingInvitations.length === 0) {
        throw new HttpError(
          403,
          "Aucun espace entreprise n'est encore associé à ce compte. Connectez-vous en mode Particulier ou demandez une invitation d'entreprise.",
        );
      }
      companies = [
        ...companies.filter((c) => c.workspaceType === "company"),
        ...companies.filter((c) => c.workspaceType !== "company"),
      ];
    } else if (mode === "individual") {
      companies = [
        ...companies.filter((c) => c.workspaceType === "personal"),
        ...companies.filter((c) => c.workspaceType !== "personal"),
      ];
    }

    const token = await signSessionToken(user.id, user.email, config.sessionSecret);

    return {
      status: 200,
      setCookie: buildSessionCookie(token, req.isHttps),
      body: {
        user: toPublicUser(user),
        companies,
        pendingInvitations,
        token,
      },
    };
  }

  if (req.method === "POST" && path === "/api/auth/logout") {
    return {
      status: 200,
      setCookie: buildClearSessionCookie(req.isHttps),
      body: { message: "Déconnecté." },
    };
  }

  if (req.method === "GET" && path === "/api/auth/me") {
    const { user, token } = await requireAuth(req, db, config.sessionSecret);
    const companies = await getUserCompanies(db, user.id);
    const pendingInvitations = await getPendingInvitationsForEmail(db, user.email);
    return {
      status: 200,
      body: {
        user: toPublicUser(user),
        companies,
        pendingInvitations,
        token,
      },
    };
  }

  if (req.method === "GET" && path.startsWith("/api/auth/invitations/")) {
    const tokenParam = decodeURIComponent(path.slice("/api/auth/invitations/".length));
    const now = nowIso();
    const inv = await db.queryFirst<{
      email: string;
      first_name: string;
      last_name: string;
      role: Role;
      company_name: string;
      project_name: string | null;
      status: string;
      expires_at: string;
    }>(
      `SELECT email, first_name, last_name, role, company_name, project_name, status, expires_at
       FROM invitations WHERE token = ?`,
      [tokenParam],
    );
    if (!inv || inv.status !== "pending" || inv.expires_at < now) {
      throw new HttpError(404, "Invitation introuvable ou expirée.");
    }
    return {
      status: 200,
      body: {
        invitation: {
          email: inv.email,
          firstName: inv.first_name,
          lastName: inv.last_name,
          role: inv.role,
          companyName: inv.company_name,
          projectName: inv.project_name,
        },
      },
    };
  }

  const acceptMatch = path.match(/^\/api\/auth\/invitations\/([^/]+)\/accept$/);
  if (req.method === "POST" && acceptMatch) {
    const invId = decodeURIComponent(acceptMatch[1]);
    const { user } = await requireAuth(req, db, config.sessionSecret);
    const now = nowIso();
    const inv = await db.queryFirst<{
      id: string;
      company_id: string;
      company_name: string;
      email: string;
      role: Role;
      project_id: string | null;
      project_name: string | null;
      status: string;
      expires_at: string;
    }>(
      `SELECT id, company_id, company_name, email, role, project_id, project_name, status, expires_at
       FROM invitations WHERE id = ?`,
      [invId],
    );
    if (!inv || inv.status !== "pending" || inv.expires_at < now) {
      throw new HttpError(404, "Invitation introuvable ou expirée.");
    }
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new HttpError(403, "Cette invitation ne correspond pas à votre email.");
    }
    await acceptInvitationRecord(db, inv, user);
    const companies = await getUserCompanies(db, user.id);
    const pendingInvitations = await getPendingInvitationsForEmail(db, user.email);
    return {
      status: 200,
      body: { companies, pendingInvitations, joinedCompanyId: inv.company_id },
    };
  }

  const declineMatch = path.match(/^\/api\/auth\/invitations\/([^/]+)\/decline$/);
  if (req.method === "POST" && declineMatch) {
    const invId = decodeURIComponent(declineMatch[1]);
    const { user } = await requireAuth(req, db, config.sessionSecret);
    const inv = await db.queryFirst<{ id: string; email: string }>(
      `SELECT id, email FROM invitations WHERE id = ? AND status = 'pending'`,
      [invId],
    );
    if (!inv || inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new HttpError(404, "Invitation introuvable.");
    }
    await db.execute(`UPDATE invitations SET status = 'revoked' WHERE id = ?`, [invId]);
    const pendingInvitations = await getPendingInvitationsForEmail(db, user.email);
    return { status: 200, body: { pendingInvitations } };
  }

  // Search registered users on the platform (by email or name) to invite as employees
  if (req.method === "GET" && path === "/api/users/search") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret, [
      "owner",
      "admin",
    ]);
    const q = (req.query.get("q") || "").trim().toLowerCase();
    if (q.length < 2) {
      return { status: 200, body: { users: [] } };
    }
    const pattern = `%${q}%`;
    const rows = await db.queryAll<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      account_type: AccountType;
      job_title: string;
    }>(
      `SELECT id, email, first_name, last_name, account_type, job_title
       FROM users
       WHERE LOWER(email) LIKE ?
          OR LOWER(first_name || ' ' || last_name) LIKE ?
       ORDER BY CASE WHEN LOWER(email) LIKE ? THEN 0 ELSE 1 END, first_name ASC
       LIMIT 12`,
      [pattern, pattern, `${q}%`],
    );

    const members = await db.queryAll<{ user_id: string }>(
      `SELECT user_id FROM memberships WHERE company_id = ?`,
      [companyId],
    );
    const memberIds = new Set(members.map((m) => m.user_id));

    const pendingInvs = await db.queryAll<{ email: string }>(
      `SELECT LOWER(email) AS email FROM invitations WHERE company_id = ? AND status = 'pending'`,
      [companyId],
    );
    const invitedEmails = new Set(pendingInvs.map((i) => i.email));

    return {
      status: 200,
      body: {
        users: rows.map((r) => ({
          id: r.id,
          email: r.email,
          firstName: r.first_name,
          lastName: r.last_name,
          accountType: r.account_type,
          jobTitle: r.job_title,
          alreadyMember: memberIds.has(r.id),
          alreadyInvited: invitedEmails.has(r.email.toLowerCase()),
        })),
      },
    };
  }

  return null;
}

export { randomHex };
