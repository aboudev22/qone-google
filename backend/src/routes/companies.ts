import {
  EMAIL_RE,
  HttpError,
  makeUniqueSlug,
  parseEnabledModules,
  requireAuth,
  requireCompanyMember,
  VALID_MODULES,
} from "../core/context.js";
import { randomHex } from "../core/crypto.js";
import { makeId, nowIso, writeActivityLog } from "../core/db.js";
import type {
  ApiRequest,
  ApiResponse,
  DbAdapter,
  ModuleKey,
  Role,
  RuntimeConfig,
} from "../core/types.js";

export async function handleCompanyAndTeamRoutes(
  req: ApiRequest,
  db: DbAdapter,
  config: RuntimeConfig,
): Promise<ApiResponse | null> {
  const path = req.path;

  if (req.method === "POST" && path === "/api/companies") {
    const { user } = await requireAuth(req, db, config.sessionSecret);
    const body = (req.body || {}) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    if (!name) {
      throw new HttpError(400, "Le nom de l'entreprise est requis.");
    }

    const companyId = makeId();
    const slug = await makeUniqueSlug(db, name);
    const now = nowIso();
    const modules: ModuleKey[] = ["crm", "sales", "stock", "projects"];

    await db.execute(
      `INSERT INTO companies (id, name, slug, workspace_type, enabled_modules, created_by, created_at)
       VALUES (?, ?, ?, 'company', ?, ?, ?)`,
      [companyId, name, slug, JSON.stringify(modules), user.id, now],
    );
    await db.execute(
      `INSERT INTO memberships (id, user_id, company_id, role, department, joined_at)
       VALUES (?, ?, ?, 'owner', 'Direction', ?)`,
      [makeId(), user.id, companyId, now],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "settings",
      action: "company.created",
      summary: `Entreprise « ${name} » créée`,
    });

    return {
      status: 201,
      body: {
        company: {
          id: companyId,
          name,
          slug,
          workspaceType: "company",
          role: "owner",
          enabledModules: modules,
          member_since: now,
        },
      },
    };
  }

  if (req.method === "PATCH" && path === "/api/companies/current") {
    const { user, companyId, role } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const company = await db.queryFirst<{
      id: string;
      name: string;
      slug: string;
      workspace_type: "company" | "personal";
      enabled_modules: string;
      created_at: string;
    }>(
      `SELECT id, name, slug, workspace_type, enabled_modules, created_at FROM companies WHERE id = ?`,
      [companyId],
    );
    if (!company) {
      throw new HttpError(404, "Espace introuvable.");
    }

    const nextName =
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : company.name;
    const nextSlug =
      typeof body.slug === "string" && body.slug.trim()
        ? await makeUniqueSlug(db, body.slug.trim(), companyId)
        : company.slug;

    let nextModules = parseEnabledModules(company.enabled_modules);
    if (Array.isArray(body.enabledModules)) {
      const filtered = body.enabledModules.filter((m): m is ModuleKey =>
        VALID_MODULES.includes(m as ModuleKey),
      );
      if (filtered.length > 0) nextModules = filtered;
    }

    await db.execute(
      `UPDATE companies SET name = ?, slug = ?, enabled_modules = ? WHERE id = ?`,
      [nextName, nextSlug, JSON.stringify(nextModules), companyId],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "settings",
      action: "company.updated",
      summary: `Paramètres de « ${nextName} » mis à jour`,
    });

    return {
      status: 200,
      body: {
        company: {
          id: companyId,
          name: nextName,
          slug: nextSlug,
          workspaceType: company.workspace_type,
          role,
          enabledModules: nextModules,
        },
      },
    };
  }

  if (req.method === "GET" && path === "/api/companies/current/summary") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);

    const [
      membersCountRow,
      clients,
      opportunities,
      projectsCountRow,
      tasks,
      stockItems,
      activities,
    ] = await Promise.all([
      db.queryFirst<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM memberships WHERE company_id = ?`,
        [companyId],
      ),
      db.queryAll<{
        id: string;
        company_id: string;
        name: string;
        email: string;
        phone: string;
        company_name: string;
        status: string;
        notes: string;
        created_at: string;
        updated_at: string;
      }>(`SELECT * FROM clients WHERE company_id = ? ORDER BY updated_at DESC`, [companyId]),
      db.queryAll<{
        id: string;
        company_id: string;
        client_id: string;
        title: string;
        amount: number;
        probability: number;
        stage: string;
        expected_close_date: string;
        notes: string;
        owner_user_id: string;
        created_at: string;
        updated_at: string;
      }>(`SELECT * FROM opportunities WHERE company_id = ? ORDER BY updated_at DESC`, [
        companyId,
      ]),
      db.queryFirst<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM projects WHERE company_id = ?`,
        [companyId],
      ),
      db.queryAll<{ status: string }>(
        `SELECT status FROM tasks WHERE company_id = ?`,
        [companyId],
      ),
      db.queryAll<{
        id: string;
        sku: string;
        name: string;
        quantity: number;
        min_quantity: number;
        unit_price: number;
        unit: string;
      }>(
        `SELECT id, sku, name, quantity, min_quantity, unit_price, unit FROM stock_items WHERE company_id = ?`,
        [companyId],
      ),
      db.queryAll<{
        id: string;
        company_id: string;
        actor_uid: string;
        actor_name: string;
        actor_email: string;
        category: string;
        action: string;
        summary: string;
        details: string;
        created_at: string;
      }>(
        `SELECT * FROM activity_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 8`,
        [companyId],
      ),
    ]);

    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const openOpps = opportunities.filter((o) => o.stage !== "won" && o.stage !== "lost");
    const wonOpps = opportunities.filter((o) => o.stage === "won");
    const lowStockItems = stockItems.filter((s) => s.quantity <= s.min_quantity);
    const outOfStockCount = stockItems.filter((s) => s.quantity <= 0).length;
    const stockValue = stockItems.reduce((sum, s) => sum + s.quantity * s.unit_price, 0);

    const stageOrder = [
      { key: "prospecting", label: "Prospection" },
      { key: "qualification", label: "Qualification" },
      { key: "proposal", label: "Proposition" },
      { key: "negotiation", label: "Négociation" },
      { key: "won", label: "Gagné" },
    ];
    const pipelineByStage = stageOrder.map((st) => {
      const matching = opportunities.filter((o) => o.stage === st.key);
      return {
        stage: st.key,
        label: st.label,
        count: matching.length,
        amount: matching.reduce((s, o) => s + Number(o.amount || 0), 0),
      };
    });

    const taskStages = [
      { key: "todo", label: "À faire" },
      { key: "in_progress", label: "En cours" },
      { key: "review", label: "En revue" },
      { key: "done", label: "Terminé" },
    ];
    const tasksByStatus = taskStages.map((st) => ({
      status: st.key,
      label: st.label,
      count: tasks.filter((t) => t.status === st.key).length,
    }));

    return {
      status: 200,
      body: {
        summary: {
          membersCount: membersCountRow?.cnt ?? 1,
          clientsCount: clients.length,
          activeClientsCount: clients.filter((c) => c.status === "active").length,
          opportunitiesCount: opportunities.length,
          openOpportunitiesCount: openOpps.length,
          pipelineValue: openOpps.reduce((s, o) => s + Number(o.amount || 0), 0),
          wonValue: wonOpps.reduce((s, o) => s + Number(o.amount || 0), 0),
          projectsCount: projectsCountRow?.cnt ?? 0,
          tasksCount: tasks.length,
          openTasksCount: tasks.filter((t) => t.status !== "done").length,
          stockItemsCount: stockItems.length,
          lowStockCount: lowStockItems.length,
          outOfStockCount,
          stockValue,
        },
        charts: {
          pipelineByStage,
          tasksByStatus,
          stockHealth: {
            healthy: stockItems.length - lowStockItems.length,
            low: lowStockItems.length - outOfStockCount,
            out: outOfStockCount,
          },
        },
        lowStockItems: lowStockItems.slice(0, 5).map((s) => ({
          id: s.id,
          sku: s.sku,
          name: s.name,
          quantity: s.quantity,
          minQuantity: s.min_quantity,
          unit: s.unit,
        })),
        recentClients: clients.slice(0, 5).map((c) => ({
          id: c.id,
          companyId: c.company_id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          companyName: c.company_name,
          status: c.status,
          notes: c.notes,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
        recentOpportunities: opportunities.slice(0, 5).map((o) => ({
          id: o.id,
          companyId: o.company_id,
          clientId: o.client_id,
          clientName: clientMap.get(o.client_id) || "Client",
          title: o.title,
          amount: o.amount,
          probability: o.probability,
          stage: o.stage,
          expectedCloseDate: o.expected_close_date,
          notes: o.notes,
          ownerUserId: o.owner_user_id,
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        })),
        recentActivities: activities.map((a) => ({
          id: a.id,
          companyId: a.company_id,
          actorUid: a.actor_uid,
          actorName: a.actor_name,
          actorEmail: a.actor_email,
          category: a.category,
          action: a.action,
          summary: a.summary,
          details: a.details,
          createdAt: a.created_at,
        })),
      },
    };
  }

  // Audit Logs endpoint
  if (req.method === "GET" && path === "/api/logs") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const category = (req.query.get("category") || "").trim();
    const search = (req.query.get("search") || "").trim().toLowerCase();
    const limitParam = Math.min(Math.max(Number(req.query.get("limit") || 150), 1), 300);

    const conditions = ["company_id = ?"];
    const params: unknown[] = [companyId];

    if (category && category !== "all") {
      conditions.push("category = ?");
      params.push(category);
    }
    if (search) {
      conditions.push(
        "(LOWER(summary) LIKE ? OR LOWER(actor_name) LIKE ? OR LOWER(actor_email) LIKE ? OR LOWER(action) LIKE ?)",
      );
      const pat = `%${search}%`;
      params.push(pat, pat, pat, pat);
    }
    params.push(limitParam);

    const rows = await db.queryAll<{
      id: string;
      company_id: string;
      actor_uid: string;
      actor_name: string;
      actor_email: string;
      category: string;
      action: string;
      summary: string;
      details: string;
      created_at: string;
    }>(
      `SELECT * FROM activity_logs WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`,
      params,
    );

    return {
      status: 200,
      body: {
        logs: rows.map((r) => ({
          id: r.id,
          companyId: r.company_id,
          actorUid: r.actor_uid,
          actorName: r.actor_name,
          actorEmail: r.actor_email,
          category: r.category,
          action: r.action,
          summary: r.summary,
          details: r.details,
          createdAt: r.created_at,
        })),
      },
    };
  }

  // Team routes
  if (req.method === "GET" && path === "/api/team") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const memberRows = await db.queryAll<{
      id: string;
      user_id: string;
      email: string;
      first_name: string;
      last_name: string;
      job_title: string;
      account_type: string;
      role: Role;
      department: string;
      joined_at: string;
    }>(
      `SELECT m.id, m.user_id, u.email, u.first_name, u.last_name, u.job_title, u.account_type, m.role, m.department, m.joined_at
       FROM memberships m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.company_id = ?
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at ASC`,
      [companyId],
    );

    const invRows = await db.queryAll<{
      id: string;
      company_id: string;
      email: string;
      first_name: string;
      last_name: string;
      role: Role;
      project_id: string | null;
      project_name: string | null;
      token: string;
      status: "pending" | "accepted" | "revoked";
      created_at: string;
      expires_at: string;
    }>(
      `SELECT id, company_id, email, first_name, last_name, role, project_id, project_name, token, status, created_at, expires_at
       FROM invitations
       WHERE company_id = ? AND status = 'pending'
       ORDER BY created_at DESC`,
      [companyId],
    );

    return {
      status: 200,
      body: {
        members: memberRows.map((m) => ({
          id: m.id,
          userId: m.user_id,
          email: m.email,
          firstName: m.first_name,
          lastName: m.last_name,
          jobTitle: m.job_title,
          accountType: m.account_type,
          role: m.role,
          department: m.department,
          joinedAt: m.joined_at,
        })),
        invitations: invRows.map((i) => ({
          id: i.id,
          companyId: i.company_id,
          email: i.email,
          firstName: i.first_name,
          lastName: i.last_name,
          role: i.role,
          projectId: i.project_id,
          projectName: i.project_name,
          token: i.token,
          status: i.status,
          createdAt: i.created_at,
          expiresAt: i.expires_at,
        })),
      },
    };
  }

  if (req.method === "POST" && path === "/api/team/invite") {
    const { user, companyId, companyName, role: callerRole } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const email = String(body.email || "").trim().toLowerCase();
    let firstName = String(body.firstName || "").trim();
    let lastName = String(body.lastName || "").trim();
    const targetRole: Role =
      body.role === "owner" || body.role === "admin" || body.role === "member"
        ? body.role
        : "member";
    const projectId = body.projectId ? String(body.projectId).trim() : null;
    const directAdd = Boolean(body.directAdd);

    if (!EMAIL_RE.test(email)) {
      throw new HttpError(400, "Adresse email invalide.");
    }
    if (targetRole === "owner" && callerRole !== "owner") {
      throw new HttpError(403, "Seul un propriétaire peut attribuer ce rôle.");
    }

    const existingUser = await db.queryFirst<{
      id: string;
      first_name: string;
      last_name: string;
    }>(`SELECT id, first_name, last_name FROM users WHERE LOWER(email) = LOWER(?)`, [
      email,
    ]);

    if (existingUser) {
      if (!firstName) firstName = existingUser.first_name;
      if (!lastName) lastName = existingUser.last_name;

      const alreadyMember = await db.queryFirst<{ id: string }>(
        `SELECT id FROM memberships WHERE user_id = ? AND company_id = ?`,
        [existingUser.id, companyId],
      );
      if (alreadyMember) {
        throw new HttpError(409, "Cet utilisateur est déjà membre de votre entreprise.");
      }

      if (directAdd) {
        const now = nowIso();
        await db.execute(
          `INSERT INTO memberships (id, user_id, company_id, role, department, joined_at)
           VALUES (?, ?, ?, ?, '', ?)`,
          [makeId(), existingUser.id, companyId, targetRole, now],
        );
        let projectName: string | null = null;
        if (projectId) {
          const proj = await db.queryFirst<{ id: string; name: string }>(
            `SELECT id, name FROM projects WHERE id = ? AND company_id = ?`,
            [projectId, companyId],
          );
          if (proj) {
            projectName = proj.name;
            await db.execute(
              `INSERT OR IGNORE INTO project_members (id, company_id, project_id, user_id, project_role, added_by, added_at)
               VALUES (?, ?, ?, ?, 'contributor', ?, ?)`,
              [makeId(), companyId, proj.id, existingUser.id, user.id, now],
            );
          }
        }
        const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
        const targetLabel = `${firstName} ${lastName}`.trim() || email;
        await writeActivityLog(db, {
          companyId,
          actorUid: user.id,
          actorName,
          actorEmail: user.email,
          category: "team",
          action: "team.member_added",
          summary: projectName
            ? `${targetLabel} ajouté directement à l'équipe et au projet « ${projectName} »`
            : `${targetLabel} ajouté directement à l'équipe (${targetRole})`,
        });
        return {
          status: 201,
          body: { addedDirectly: true },
        };
      }
    }

    let projectName: string | null = null;
    if (projectId) {
      const proj = await db.queryFirst<{ id: string; name: string }>(
        `SELECT id, name FROM projects WHERE id = ? AND company_id = ?`,
        [projectId, companyId],
      );
      if (proj) projectName = proj.name;
    }

    const dupInv = await db.queryFirst<{ id: string }>(
      `SELECT id FROM invitations WHERE company_id = ? AND LOWER(email) = LOWER(?) AND status = 'pending'`,
      [companyId, email],
    );
    if (dupInv) {
      throw new HttpError(409, "Une invitation est déjà en attente pour cette adresse.");
    }

    const now = nowIso();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const invId = makeId();
    const token = randomHex(20);
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;

    await db.execute(
      `INSERT INTO invitations (
        id, company_id, company_name, email, first_name, last_name, role,
        project_id, project_name, token, status, invited_by_user_id, invited_by_name, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        invId,
        companyId,
        companyName,
        email,
        firstName,
        lastName,
        targetRole,
        projectId,
        projectName,
        token,
        user.id,
        actorName,
        now,
        expiresAt,
      ],
    );

    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "team",
      action: "team.invited",
      summary: projectName
        ? `Invitation envoyée à ${email} pour rejoindre l'équipe et le projet « ${projectName} »`
        : `Invitation envoyée à ${email} (${targetRole})`,
    });

    return {
      status: 201,
      body: {
        invitation: {
          id: invId,
          companyId,
          email,
          firstName,
          lastName,
          role: targetRole,
          projectId,
          projectName,
          token,
          status: "pending",
          createdAt: now,
          expiresAt,
        },
      },
    };
  }

  const revokeMatch = path.match(/^\/api\/team\/invitations\/([^/]+)$/);
  if (req.method === "DELETE" && revokeMatch) {
    const invId = decodeURIComponent(revokeMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const inv = await db.queryFirst<{ id: string; email: string }>(
      `SELECT id, email FROM invitations WHERE id = ? AND company_id = ?`,
      [invId, companyId],
    );
    if (!inv) {
      throw new HttpError(404, "Invitation introuvable.");
    }
    await db.execute(`UPDATE invitations SET status = 'revoked' WHERE id = ?`, [invId]);
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "team",
      action: "team.invitation_revoked",
      summary: `Invitation révoquée pour ${inv.email}`,
    });
    return { status: 200, body: { message: "Invitation révoquée." } };
  }

  const roleMatch = path.match(/^\/api\/team\/members\/([^/]+)$/);
  if (req.method === "PATCH" && roleMatch) {
    const memberId = decodeURIComponent(roleMatch[1]);
    const { user, companyId, role: callerRole } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const nextRole: Role =
      body.role === "owner" || body.role === "admin" || body.role === "member"
        ? body.role
        : "member";

    const target = await db.queryFirst<{
      id: string;
      user_id: string;
      role: Role;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT m.id, m.user_id, m.role, u.email, u.first_name, u.last_name
       FROM memberships m INNER JOIN users u ON u.id = m.user_id
       WHERE m.id = ? AND m.company_id = ?`,
      [memberId, companyId],
    );
    if (!target) {
      throw new HttpError(404, "Membre introuvable.");
    }
    if (target.user_id === user.id) {
      throw new HttpError(400, "Vous ne pouvez pas modifier votre propre rôle.");
    }
    if (callerRole !== "owner" && (target.role === "owner" || nextRole === "owner")) {
      throw new HttpError(403, "Seul le propriétaire peut modifier le rôle Propriétaire.");
    }

    await db.execute(`UPDATE memberships SET role = ? WHERE id = ?`, [nextRole, memberId]);
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    const targetName = `${target.first_name} ${target.last_name}`.trim() || target.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "team",
      action: "team.role_updated",
      summary: `Rôle de ${targetName} modifié vers ${nextRole}`,
    });
    return { status: 200, body: { message: "Rôle mis à jour." } };
  }

  if (req.method === "DELETE" && roleMatch) {
    const memberId = decodeURIComponent(roleMatch[1]);
    const { user, companyId, role: callerRole } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const target = await db.queryFirst<{
      id: string;
      user_id: string;
      role: Role;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT m.id, m.user_id, m.role, u.email, u.first_name, u.last_name
       FROM memberships m INNER JOIN users u ON u.id = m.user_id
       WHERE m.id = ? AND m.company_id = ?`,
      [memberId, companyId],
    );
    if (!target) {
      throw new HttpError(404, "Membre introuvable.");
    }
    if (target.user_id === user.id) {
      throw new HttpError(400, "Vous ne pouvez pas vous retirer vous-même.");
    }
    if (target.role === "owner" && callerRole !== "owner") {
      throw new HttpError(403, "Seul un propriétaire peut retirer un autre propriétaire.");
    }

    await db.execute(`DELETE FROM memberships WHERE id = ?`, [memberId]);
    await db.execute(
      `DELETE FROM project_members WHERE company_id = ? AND user_id = ?`,
      [companyId, target.user_id],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    const targetName = `${target.first_name} ${target.last_name}`.trim() || target.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "team",
      action: "team.member_removed",
      summary: `${targetName} retiré de l'entreprise`,
    });
    return { status: 200, body: { message: "Collaborateur retiré." } };
  }

  return null;
}
