import { HttpError, requireCompanyMember } from "../core/context.js";
import { makeId, nowIso, writeActivityLog } from "../core/db.js";
import type {
  ApiRequest,
  ApiResponse,
  ClientStatus,
  DbAdapter,
  OpportunityStage,
  RuntimeConfig,
  SqlStatement,
} from "../core/types.js";

const VALID_CLIENT_STATUSES: ClientStatus[] = ["active", "prospect", "inactive"];
const VALID_OPP_STAGES: OpportunityStage[] = [
  "prospecting",
  "qualification",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export async function handleCrmAndSalesRoutes(
  req: ApiRequest,
  db: DbAdapter,
  config: RuntimeConfig,
): Promise<ApiResponse | null> {
  const path = req.path;

  // Clients
  if (req.method === "GET" && path === "/api/clients") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const search = (req.query.get("search") || "").trim().toLowerCase();
    const status = (req.query.get("status") || "").trim();

    const rows = await db.queryAll<{
      id: string;
      company_id: string;
      name: string;
      email: string;
      phone: string;
      company_name: string;
      status: ClientStatus;
      notes: string;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM clients WHERE company_id = ? ORDER BY updated_at DESC`, [
      companyId,
    ]);

    const filtered = rows.filter((c) => {
      if (status && status !== "all" && c.status !== status) return false;
      if (search) {
        const hay = `${c.name} ${c.email} ${c.phone} ${c.company_name}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return {
      status: 200,
      body: {
        clients: filtered.map((c) => ({
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
      },
    };
  }

  if (req.method === "POST" && path === "/api/clients") {
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    if (!name) {
      throw new HttpError(400, "Le nom du client est obligatoire.");
    }
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const companyName = String(body.companyName || "").trim();
    const status: ClientStatus = VALID_CLIENT_STATUSES.includes(
      body.status as ClientStatus,
    )
      ? (body.status as ClientStatus)
      : "active";
    const notes = String(body.notes || "").trim();
    const id = makeId();
    const now = nowIso();

    await db.execute(
      `INSERT INTO clients (id, company_id, name, email, phone, company_name, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, companyId, name, email, phone, companyName, status, notes, now, now],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "crm",
      action: "client.created",
      summary: `Client « ${name} » créé`,
    });

    return {
      status: 201,
      body: {
        client: {
          id,
          companyId,
          name,
          email,
          phone,
          companyName,
          status,
          notes,
          createdAt: now,
          updatedAt: now,
        },
      },
    };
  }

  if (req.method === "POST" && path === "/api/clients/import") {
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const body = (req.body || {}) as {
      ops?: Array<
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
      >;
    };
    const ops = Array.isArray(body.ops) ? body.ops : [];
    const now = nowIso();
    const statements: SqlStatement[] = [];
    let imported = 0;
    let updated = 0;

    for (const op of ops.slice(0, 500)) {
      if (op.type === "create") {
        statements.push({
          sql: `INSERT INTO clients (id, company_id, name, email, phone, company_name, status, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            makeId(),
            companyId,
            String(op.data.name || "").trim() || "Client",
            String(op.data.email || "").trim().toLowerCase(),
            String(op.data.phone || "").trim(),
            String(op.data.companyName || "").trim(),
            VALID_CLIENT_STATUSES.includes(op.data.status) ? op.data.status : "active",
            String(op.data.notes || "").trim(),
            now,
            now,
          ],
        });
        imported++;
      } else if (op.type === "update" && op.clientId) {
        statements.push({
          sql: `UPDATE clients
                SET name = ?, email = ?, phone = ?, company_name = ?, status = ?, notes = ?, updated_at = ?
                WHERE id = ? AND company_id = ?`,
          params: [
            String(op.data.name || "").trim() || "Client",
            String(op.data.email || "").trim().toLowerCase(),
            String(op.data.phone || "").trim(),
            String(op.data.companyName || "").trim(),
            VALID_CLIENT_STATUSES.includes(op.data.status) ? op.data.status : "active",
            String(op.data.notes || "").trim(),
            now,
            op.clientId,
            companyId,
          ],
        });
        updated++;
      }
    }

    if (statements.length > 0) {
      await db.batch(statements);
      const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
      await writeActivityLog(db, {
        companyId,
        actorUid: user.id,
        actorName,
        actorEmail: user.email,
        category: "crm",
        action: "client.imported",
        summary: `Import Excel : ${imported} client(s) créé(s), ${updated} mis à jour`,
      });
    }

    return { status: 200, body: { imported, updated } };
  }

  const clientMatch = path.match(/^\/api\/clients\/([^/]+)$/);
  if (req.method === "PATCH" && clientMatch) {
    const clientId = decodeURIComponent(clientMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{
      id: string;
      name: string;
      email: string;
      phone: string;
      company_name: string;
      status: ClientStatus;
      notes: string;
    }>(`SELECT * FROM clients WHERE id = ? AND company_id = ?`, [clientId, companyId]);
    if (!existing) {
      throw new HttpError(404, "Client introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : existing.email;
    const phone = typeof body.phone === "string" ? body.phone.trim() : existing.phone;
    const companyName =
      typeof body.companyName === "string"
        ? body.companyName.trim()
        : existing.company_name;
    const status = VALID_CLIENT_STATUSES.includes(body.status as ClientStatus)
      ? (body.status as ClientStatus)
      : existing.status;
    const notes = typeof body.notes === "string" ? body.notes.trim() : existing.notes;
    const now = nowIso();

    await db.execute(
      `UPDATE clients SET name = ?, email = ?, phone = ?, company_name = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [name, email, phone, companyName, status, notes, now, clientId],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "crm",
      action: "client.updated",
      summary: `Fiche client « ${name} » mise à jour`,
    });

    return {
      status: 200,
      body: {
        client: {
          id: clientId,
          companyId,
          name,
          email,
          phone,
          companyName,
          status,
          notes,
          updatedAt: now,
        },
      },
    };
  }

  if (req.method === "DELETE" && clientMatch) {
    const clientId = decodeURIComponent(clientMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{ id: string; name: string }>(
      `SELECT id, name FROM clients WHERE id = ? AND company_id = ?`,
      [clientId, companyId],
    );
    if (!existing) {
      throw new HttpError(404, "Client introuvable.");
    }
    await db.execute(`DELETE FROM clients WHERE id = ? AND company_id = ?`, [
      clientId,
      companyId,
    ]);
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "crm",
      action: "client.deleted",
      summary: `Client « ${existing.name} » supprimé`,
    });
    return { status: 200, body: { message: "Client supprimé." } };
  }

  // Opportunities
  if (req.method === "GET" && path === "/api/opportunities") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const rows = await db.queryAll<{
      id: string;
      company_id: string;
      client_id: string;
      client_name: string | null;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expected_close_date: string;
      notes: string;
      owner_user_id: string;
      owner_first_name: string | null;
      owner_last_name: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT o.*, c.name AS client_name, u.first_name AS owner_first_name, u.last_name AS owner_last_name
       FROM opportunities o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN users u ON u.id = o.owner_user_id
       WHERE o.company_id = ?
       ORDER BY o.updated_at DESC`,
      [companyId],
    );

    return {
      status: 200,
      body: {
        opportunities: rows.map((o) => ({
          id: o.id,
          companyId: o.company_id,
          clientId: o.client_id,
          clientName: o.client_name || "Client",
          title: o.title,
          amount: Number(o.amount || 0),
          probability: Number(o.probability || 0),
          stage: o.stage,
          expectedCloseDate: o.expected_close_date,
          notes: o.notes,
          ownerUserId: o.owner_user_id,
          ownerName: `${o.owner_first_name || ""} ${o.owner_last_name || ""}`.trim(),
          createdAt: o.created_at,
          updatedAt: o.updated_at,
        })),
      },
    };
  }

  if (req.method === "POST" && path === "/api/opportunities") {
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const clientId = String(body.clientId || "").trim();
    const title = String(body.title || "").trim();
    if (!clientId || !title) {
      throw new HttpError(400, "Veuillez renseigner un titre et un client.");
    }
    const client = await db.queryFirst<{ id: string; name: string }>(
      `SELECT id, name FROM clients WHERE id = ? AND company_id = ?`,
      [clientId, companyId],
    );
    if (!client) {
      throw new HttpError(404, "Client associé introuvable.");
    }

    const amount = Math.max(0, Number(body.amount || 0));
    const probability = Math.min(100, Math.max(0, Math.round(Number(body.probability ?? 50))));
    const stage: OpportunityStage = VALID_OPP_STAGES.includes(
      body.stage as OpportunityStage,
    )
      ? (body.stage as OpportunityStage)
      : "prospecting";
    const expectedCloseDate = String(body.expectedCloseDate || "").trim();
    const notes = String(body.notes || "").trim();
    const id = makeId();
    const now = nowIso();

    await db.execute(
      `INSERT INTO opportunities (id, company_id, client_id, title, amount, probability, stage, expected_close_date, notes, owner_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        clientId,
        title,
        amount,
        probability,
        stage,
        expectedCloseDate,
        notes,
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
      category: "sales",
      action: "opportunity.created",
      summary: `Opportunité « ${title} » (${amount} F CFA) créée pour ${client.name}`,
    });

    return {
      status: 201,
      body: {
        opportunity: {
          id,
          companyId,
          clientId,
          clientName: client.name,
          title,
          amount,
          probability,
          stage,
          expectedCloseDate,
          notes,
          ownerUserId: user.id,
          createdAt: now,
          updatedAt: now,
        },
      },
    };
  }

  const oppMatch = path.match(/^\/api\/opportunities\/([^/]+)$/);
  if (req.method === "PATCH" && oppMatch) {
    const oppId = decodeURIComponent(oppMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{
      id: string;
      client_id: string;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expected_close_date: string;
      notes: string;
    }>(`SELECT * FROM opportunities WHERE id = ? AND company_id = ?`, [
      oppId,
      companyId,
    ]);
    if (!existing) {
      throw new HttpError(404, "Opportunité introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const clientId =
      typeof body.clientId === "string" && body.clientId.trim()
        ? body.clientId.trim()
        : existing.client_id;
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : existing.title;
    const amount =
      body.amount !== undefined ? Math.max(0, Number(body.amount)) : existing.amount;
    const probability =
      body.probability !== undefined
        ? Math.min(100, Math.max(0, Math.round(Number(body.probability))))
        : existing.probability;
    const stage = VALID_OPP_STAGES.includes(body.stage as OpportunityStage)
      ? (body.stage as OpportunityStage)
      : existing.stage;
    const expectedCloseDate =
      typeof body.expectedCloseDate === "string"
        ? body.expectedCloseDate.trim()
        : existing.expected_close_date;
    const notes = typeof body.notes === "string" ? body.notes.trim() : existing.notes;
    const now = nowIso();

    await db.execute(
      `UPDATE opportunities
       SET client_id = ?, title = ?, amount = ?, probability = ?, stage = ?, expected_close_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [clientId, title, amount, probability, stage, expectedCloseDate, notes, now, oppId],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "sales",
      action: "opportunity.updated",
      summary: `Opportunité « ${title} » mise à jour (${stage})`,
    });

    return { status: 200, body: { message: "Opportunité mise à jour." } };
  }

  if (req.method === "DELETE" && oppMatch) {
    const oppId = decodeURIComponent(oppMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{ id: string; title: string }>(
      `SELECT id, title FROM opportunities WHERE id = ? AND company_id = ?`,
      [oppId, companyId],
    );
    if (!existing) {
      throw new HttpError(404, "Opportunité introuvable.");
    }
    await db.execute(`DELETE FROM opportunities WHERE id = ? AND company_id = ?`, [
      oppId,
      companyId,
    ]);
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "sales",
      action: "opportunity.deleted",
      summary: `Opportunité « ${existing.title} » supprimée`,
    });
    return { status: 200, body: { message: "Opportunité supprimée." } };
  }

  return null;
}
