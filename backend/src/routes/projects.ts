import { EMAIL_RE, HttpError, requireCompanyMember } from "../core/context.js";
import { randomHex } from "../core/crypto.js";
import { makeId, nowIso, writeActivityLog } from "../core/db.js";
import type {
  ApiRequest,
  ApiResponse,
  DbAdapter,
  ProjectRole,
  ProjectStatus,
  RuntimeConfig,
  TaskPriority,
  TaskStatus,
} from "../core/types.js";

const VALID_PROJECT_STATUSES: ProjectStatus[] = ["active", "paused", "completed"];
const VALID_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "review", "done"];
const VALID_TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  review: "En revue",
  done: "Terminé",
};

export async function handleProjectRoutes(
  req: ApiRequest,
  db: DbAdapter,
  config: RuntimeConfig,
): Promise<ApiResponse | null> {
  const path = req.path;

  if (req.method === "GET" && path === "/api/projects") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const [projects, members, tasks] = await Promise.all([
      db.queryAll<{
        id: string;
        company_id: string;
        name: string;
        description: string;
        status: ProjectStatus;
        created_by: string;
        created_at: string;
        updated_at: string;
      }>(`SELECT * FROM projects WHERE company_id = ? ORDER BY updated_at DESC`, [
        companyId,
      ]),
      db.queryAll<{
        project_id: string;
        user_id: string;
        project_role: ProjectRole;
        added_at: string;
        email: string;
        first_name: string;
        last_name: string;
      }>(
        `SELECT pm.project_id, pm.user_id, pm.project_role, pm.added_at, u.email, u.first_name, u.last_name
         FROM project_members pm
         INNER JOIN users u ON u.id = pm.user_id
         WHERE pm.company_id = ?
         ORDER BY pm.added_at ASC`,
        [companyId],
      ),
      db.queryAll<{ project_id: string; status: TaskStatus }>(
        `SELECT project_id, status FROM tasks WHERE company_id = ?`,
        [companyId],
      ),
    ]);

    return {
      status: 200,
      body: {
        projects: projects.map((p) => {
          const pMembers = members
            .filter((m) => m.project_id === p.id)
            .map((m) => ({
              userId: m.user_id,
              email: m.email,
              firstName: m.first_name,
              lastName: m.last_name,
              projectRole: m.project_role,
              addedAt: m.added_at,
            }));
          const pTasks = tasks.filter((t) => t.project_id === p.id);
          return {
            id: p.id,
            companyId: p.company_id,
            name: p.name,
            description: p.description,
            status: p.status,
            createdBy: p.created_by,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            members: pMembers,
            taskStats: {
              total: pTasks.length,
              todo: pTasks.filter((t) => t.status === "todo").length,
              inProgress: pTasks.filter((t) => t.status === "in_progress").length,
              review: pTasks.filter((t) => t.status === "review").length,
              done: pTasks.filter((t) => t.status === "done").length,
            },
          };
        }),
      },
    };
  }

  if (req.method === "POST" && path === "/api/projects") {
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const status: ProjectStatus = VALID_PROJECT_STATUSES.includes(
      body.status as ProjectStatus,
    )
      ? (body.status as ProjectStatus)
      : "active";

    if (!name) {
      throw new HttpError(400, "Le nom du projet est requis.");
    }

    const id = makeId();
    const now = nowIso();
    await db.execute(
      `INSERT INTO projects (id, company_id, name, description, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyId, name, description, status, user.id, now, now],
    );
    await db.execute(
      `INSERT INTO project_members (id, company_id, project_id, user_id, project_role, added_by, added_at)
       VALUES (?, ?, ?, ?, 'lead', ?, ?)`,
      [makeId(), companyId, id, user.id, user.id, now],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action: "project.created",
      summary: `Projet « ${name} » créé`,
    });

    return {
      status: 201,
      body: {
        project: {
          id,
          companyId,
          name,
          description,
          status,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        },
      },
    };
  }

  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (req.method === "PATCH" && projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{
      id: string;
      name: string;
      description: string;
      status: ProjectStatus;
    }>(`SELECT id, name, description, status FROM projects WHERE id = ? AND company_id = ?`, [
      projectId,
      companyId,
    ]);
    if (!existing) {
      throw new HttpError(404, "Projet introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : existing.description;
    const status = VALID_PROJECT_STATUSES.includes(body.status as ProjectStatus)
      ? (body.status as ProjectStatus)
      : existing.status;

    const now = nowIso();
    await db.execute(
      `UPDATE projects SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?`,
      [name, description, status, now, projectId],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action: "project.updated",
      summary: `Projet « ${name} » mis à jour`,
    });

    return { status: 200, body: { message: "Projet mis à jour." } };
  }

  if (req.method === "DELETE" && projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const existing = await db.queryFirst<{ id: string; name: string }>(
      `SELECT id, name FROM projects WHERE id = ? AND company_id = ?`,
      [projectId, companyId],
    );
    if (!existing) {
      throw new HttpError(404, "Projet introuvable.");
    }

    await db.batch([
      { sql: `DELETE FROM tasks WHERE project_id = ? AND company_id = ?`, params: [projectId, companyId] },
      { sql: `DELETE FROM project_members WHERE project_id = ? AND company_id = ?`, params: [projectId, companyId] },
      { sql: `DELETE FROM projects WHERE id = ? AND company_id = ?`, params: [projectId, companyId] },
    ]);

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action: "project.deleted",
      summary: `Projet « ${existing.name} » supprimé`,
    });

    return { status: 200, body: { message: "Projet supprimé." } };
  }

  const addProjMemberMatch = path.match(/^\/api\/projects\/([^/]+)\/members$/);
  if (req.method === "POST" && addProjMemberMatch) {
    const projectId = decodeURIComponent(addProjMemberMatch[1]);
    const { user, companyId, companyName, role } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const project = await db.queryFirst<{ id: string; name: string }>(
      `SELECT id, name FROM projects WHERE id = ? AND company_id = ?`,
      [projectId, companyId],
    );
    if (!project) {
      throw new HttpError(404, "Projet introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const targetUserId = body.userId ? String(body.userId).trim() : "";
    const emailInput = body.email ? String(body.email).trim().toLowerCase() : "";
    const projectRole: ProjectRole =
      body.projectRole === "lead" ? "lead" : "contributor";
    const directAdd = Boolean(body.directAdd);

    let targetUser: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    } | null = null;

    if (targetUserId) {
      targetUser = await db.queryFirst(
        `SELECT id, email, first_name, last_name FROM users WHERE id = ?`,
        [targetUserId],
      );
    } else if (emailInput) {
      if (!EMAIL_RE.test(emailInput)) {
        throw new HttpError(400, "Adresse email invalide.");
      }
      targetUser = await db.queryFirst(
        `SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = LOWER(?)`,
        [emailInput],
      );
    } else {
      throw new HttpError(400, "Veuillez sélectionner un utilisateur ou saisir un email.");
    }

    const now = nowIso();
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;

    if (targetUser) {
      const isCompanyMember = await db.queryFirst<{ id: string }>(
        `SELECT id FROM memberships WHERE user_id = ? AND company_id = ?`,
        [targetUser.id, companyId],
      );

      if (isCompanyMember) {
        await db.execute(
          `INSERT OR IGNORE INTO project_members (id, company_id, project_id, user_id, project_role, added_by, added_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [makeId(), companyId, projectId, targetUser.id, projectRole, user.id, now],
        );
        const targetName =
          `${targetUser.first_name} ${targetUser.last_name}`.trim() || targetUser.email;
        await writeActivityLog(db, {
          companyId,
          actorUid: user.id,
          actorName,
          actorEmail: user.email,
          category: "projects",
          action: "project.member_added",
          summary: `${targetName} ajouté au projet « ${project.name} »`,
        });
        return {
          status: 201,
          body: { status: "added", message: `${targetName} ajouté au projet.` },
        };
      }

      if (role !== "owner" && role !== "admin") {
        throw new HttpError(
          403,
          "Seul un administrateur peut inviter un utilisateur externe à l'entreprise.",
        );
      }

      if (directAdd) {
        await db.execute(
          `INSERT INTO memberships (id, user_id, company_id, role, department, joined_at)
           VALUES (?, ?, ?, 'member', '', ?)`,
          [makeId(), targetUser.id, companyId, now],
        );
        await db.execute(
          `INSERT OR IGNORE INTO project_members (id, company_id, project_id, user_id, project_role, added_by, added_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [makeId(), companyId, projectId, targetUser.id, projectRole, user.id, now],
        );
        const targetName =
          `${targetUser.first_name} ${targetUser.last_name}`.trim() || targetUser.email;
        await writeActivityLog(db, {
          companyId,
          actorUid: user.id,
          actorName,
          actorEmail: user.email,
          category: "projects",
          action: "project.member_added",
          summary: `${targetName} recruté dans l'équipe et ajouté au projet « ${project.name} »`,
        });
        return {
          status: 201,
          body: { status: "added", message: `${targetName} ajouté au projet.` },
        };
      }

      // Send pending invitation linked to project
      const dupInv = await db.queryFirst<{ id: string }>(
        `SELECT id FROM invitations WHERE company_id = ? AND LOWER(email) = LOWER(?) AND status = 'pending'`,
        [companyId, targetUser.email],
      );
      if (dupInv) {
        await db.execute(
          `UPDATE invitations SET project_id = ?, project_name = ? WHERE id = ?`,
          [project.id, project.name, dupInv.id],
        );
        return {
          status: 200,
          body: {
            status: "invited",
            message: `Invitation mise à jour pour ${targetUser.email} sur « ${project.name} ».`,
          },
        };
      }

      const token = randomHex(20);
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await db.execute(
        `INSERT INTO invitations (
          id, company_id, company_name, email, first_name, last_name, role,
          project_id, project_name, token, status, invited_by_user_id, invited_by_name, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'member', ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [
          makeId(),
          companyId,
          companyName,
          targetUser.email,
          targetUser.first_name,
          targetUser.last_name,
          project.id,
          project.name,
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
        category: "projects",
        action: "project.member_invited",
        summary: `Invitation envoyée à ${targetUser.email} pour le projet « ${project.name} »`,
      });
      return {
        status: 201,
        body: {
          status: "invited",
          token,
          message: `Invitation envoyée à ${targetUser.email}.`,
        },
      };
    }

    // Email not yet registered on platform
    if (role !== "owner" && role !== "admin") {
      throw new HttpError(
        403,
        "Seul un administrateur peut inviter une personne externe par email.",
      );
    }

    const token = randomHex(20);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await db.execute(
      `INSERT INTO invitations (
        id, company_id, company_name, email, first_name, last_name, role,
        project_id, project_name, token, status, invited_by_user_id, invited_by_name, created_at, expires_at
      ) VALUES (?, ?, ?, ?, '', '', 'member', ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        makeId(),
        companyId,
        companyName,
        emailInput,
        project.id,
        project.name,
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
      category: "projects",
      action: "project.member_invited",
      summary: `Invitation envoyée à ${emailInput} pour rejoindre le projet « ${project.name} »`,
    });
    return {
      status: 201,
      body: {
        status: "invited",
        token,
        message: `Invitation créée pour ${emailInput}.`,
      },
    };
  }

  const removeProjMemberMatch = path.match(/^\/api\/projects\/([^/]+)\/members\/([^/]+)$/);
  if (req.method === "DELETE" && removeProjMemberMatch) {
    const projectId = decodeURIComponent(removeProjMemberMatch[1]);
    const memberUserId = decodeURIComponent(removeProjMemberMatch[2]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
      ["owner", "admin"],
    );
    const project = await db.queryFirst<{ name: string }>(
      `SELECT name FROM projects WHERE id = ? AND company_id = ?`,
      [projectId, companyId],
    );
    if (!project) {
      throw new HttpError(404, "Projet introuvable.");
    }
    await db.execute(
      `DELETE FROM project_members WHERE company_id = ? AND project_id = ? AND user_id = ?`,
      [companyId, projectId, memberUserId],
    );
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action: "project.member_removed",
      summary: `Un collaborateur a été retiré du projet « ${project.name} »`,
    });
    return { status: 200, body: { message: "Membre retiré du projet." } };
  }

  // Tasks endpoints
  if (req.method === "GET" && path === "/api/tasks") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const projectId = (req.query.get("projectId") || "").trim();
    const assigneeUserId = (req.query.get("assigneeUserId") || "").trim();
    const statusFilter = (req.query.get("status") || "").trim();

    const conditions = ["t.company_id = ?"];
    const params: unknown[] = [companyId];
    if (projectId && projectId !== "all") {
      conditions.push("t.project_id = ?");
      params.push(projectId);
    }
    if (assigneeUserId && assigneeUserId !== "all") {
      conditions.push("t.assignee_user_id = ?");
      params.push(assigneeUserId);
    }
    if (statusFilter && statusFilter !== "all") {
      conditions.push("t.status = ?");
      params.push(statusFilter);
    }

    const rows = await db.queryAll<{
      id: string;
      company_id: string;
      project_id: string;
      project_name: string | null;
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      assignee_user_id: string | null;
      assignee_first_name: string | null;
      assignee_last_name: string | null;
      assignee_email: string | null;
      due_date: string;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT t.*, p.name AS project_name,
              u.first_name AS assignee_first_name, u.last_name AS assignee_last_name, u.email AS assignee_email
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY t.updated_at DESC`,
      params,
    );

    return {
      status: 200,
      body: {
        tasks: rows.map((r) => ({
          id: r.id,
          companyId: r.company_id,
          projectId: r.project_id,
          projectName: r.project_name || "Projet",
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          assigneeUserId: r.assignee_user_id,
          assigneeName: r.assignee_user_id
            ? `${r.assignee_first_name || ""} ${r.assignee_last_name || ""}`.trim() ||
              r.assignee_email ||
              "Assigné"
            : null,
          assigneeEmail: r.assignee_email,
          dueDate: r.due_date,
          createdBy: r.created_by,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      },
    };
  }

  if (req.method === "POST" && path === "/api/tasks") {
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const projectId = String(body.projectId || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const status: TaskStatus = VALID_TASK_STATUSES.includes(body.status as TaskStatus)
      ? (body.status as TaskStatus)
      : "todo";
    const priority: TaskPriority = VALID_TASK_PRIORITIES.includes(
      body.priority as TaskPriority,
    )
      ? (body.priority as TaskPriority)
      : "medium";
    const assigneeUserId = body.assigneeUserId
      ? String(body.assigneeUserId).trim()
      : null;
    const dueDate = String(body.dueDate || "").trim();

    if (!projectId || !title) {
      throw new HttpError(400, "Le projet et le titre de la tâche sont obligatoires.");
    }

    const project = await db.queryFirst<{ id: string; name: string }>(
      `SELECT id, name FROM projects WHERE id = ? AND company_id = ?`,
      [projectId, companyId],
    );
    if (!project) {
      throw new HttpError(404, "Projet introuvable.");
    }

    let assigneeLabel = "";
    if (assigneeUserId) {
      const member = await db.queryFirst<{
        first_name: string;
        last_name: string;
        email: string;
      }>(
        `SELECT u.first_name, u.last_name, u.email
         FROM memberships m INNER JOIN users u ON u.id = m.user_id
         WHERE m.company_id = ? AND m.user_id = ?`,
        [companyId, assigneeUserId],
      );
      if (!member) {
        throw new HttpError(400, "L'employé assigné n'est pas membre de cet espace.");
      }
      assigneeLabel =
        `${member.first_name} ${member.last_name}`.trim() || member.email;
      await db.execute(
        `INSERT OR IGNORE INTO project_members (id, company_id, project_id, user_id, project_role, added_by, added_at)
         VALUES (?, ?, ?, ?, 'contributor', ?, ?)`,
        [makeId(), companyId, projectId, assigneeUserId, user.id, nowIso()],
      );
    }

    const id = makeId();
    const now = nowIso();
    await db.execute(
      `INSERT INTO tasks (id, company_id, project_id, title, description, status, priority, assignee_user_id, due_date, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        projectId,
        title,
        description,
        status,
        priority,
        assigneeUserId,
        dueDate,
        user.id,
        now,
        now,
      ],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action: "task.created",
      summary: assigneeLabel
        ? `Tâche « ${title} » créée sur « ${project.name} » et assignée à ${assigneeLabel}`
        : `Tâche « ${title} » créée sur « ${project.name} »`,
    });

    return { status: 201, body: { id } };
  }

  const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (req.method === "PATCH" && taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{
      id: string;
      project_id: string;
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      assignee_user_id: string | null;
      due_date: string;
    }>(`SELECT * FROM tasks WHERE id = ? AND company_id = ?`, [taskId, companyId]);
    if (!existing) {
      throw new HttpError(404, "Tâche introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : existing.title;
    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : existing.description;
    const status = VALID_TASK_STATUSES.includes(body.status as TaskStatus)
      ? (body.status as TaskStatus)
      : existing.status;
    const priority = VALID_TASK_PRIORITIES.includes(body.priority as TaskPriority)
      ? (body.priority as TaskPriority)
      : existing.priority;
    const assigneeUserId =
      body.assigneeUserId === null
        ? null
        : typeof body.assigneeUserId === "string"
        ? body.assigneeUserId.trim() || null
        : existing.assignee_user_id;
    const dueDate =
      typeof body.dueDate === "string" ? body.dueDate.trim() : existing.due_date;

    let assigneeName = "";
    if (assigneeUserId) {
      const member = await db.queryFirst<{
        first_name: string;
        last_name: string;
        email: string;
      }>(
        `SELECT u.first_name, u.last_name, u.email
         FROM memberships m INNER JOIN users u ON u.id = m.user_id
         WHERE m.company_id = ? AND m.user_id = ?`,
        [companyId, assigneeUserId],
      );
      if (!member) {
        throw new HttpError(400, "L'employé assigné n'est pas membre de cet espace.");
      }
      assigneeName = `${member.first_name} ${member.last_name}`.trim() || member.email;
    }

    await db.execute(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, assignee_user_id = ?, due_date = ?, updated_at = ?
       WHERE id = ?`,
      [title, description, status, priority, assigneeUserId, dueDate, nowIso(), taskId],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    let action = "task.updated";
    let summary = `Tâche « ${title} » mise à jour`;
    if (status !== existing.status) {
      action = "task.status_changed";
      summary = `Tâche « ${title} » passée à « ${TASK_STATUS_LABELS[status]} »`;
    } else if (assigneeUserId !== existing.assignee_user_id && assigneeName) {
      action = "task.assigned";
      summary = `Tâche « ${title} » assignée à ${assigneeName}`;
    }

    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action,
      summary,
    });

    return { status: 200, body: { message: "Tâche mise à jour." } };
  }

  if (req.method === "DELETE" && taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{ id: string; title: string }>(
      `SELECT id, title FROM tasks WHERE id = ? AND company_id = ?`,
      [taskId, companyId],
    );
    if (!existing) {
      throw new HttpError(404, "Tâche introuvable.");
    }
    await db.execute(`DELETE FROM tasks WHERE id = ? AND company_id = ?`, [
      taskId,
      companyId,
    ]);
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "projects",
      action: "task.deleted",
      summary: `Tâche « ${existing.title} » supprimée`,
    });
    return { status: 200, body: { message: "Tâche supprimée." } };
  }

  return null;
}
