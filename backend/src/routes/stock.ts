import { HttpError, requireCompanyMember } from "../core/context.js";
import { makeId, nowIso, writeActivityLog } from "../core/db.js";
import type {
  ApiRequest,
  ApiResponse,
  DbAdapter,
  RuntimeConfig,
  StockMovementType,
} from "../core/types.js";

export async function handleStockRoutes(
  req: ApiRequest,
  db: DbAdapter,
  config: RuntimeConfig,
): Promise<ApiResponse | null> {
  const path = req.path;

  if (req.method === "GET" && path === "/api/stock/items") {
    const { companyId } = await requireCompanyMember(req, db, config.sessionSecret);
    const search = (req.query.get("search") || "").trim().toLowerCase();
    const category = (req.query.get("category") || "").trim();
    const lowStockOnly = req.query.get("lowStock") === "true";

    const allItems = await db.queryAll<{
      id: string;
      company_id: string;
      sku: string;
      name: string;
      category: string;
      unit: string;
      quantity: number;
      min_quantity: number;
      unit_price: number;
      supplier: string;
      location: string;
      notes: string;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM stock_items WHERE company_id = ? ORDER BY updated_at DESC`, [
      companyId,
    ]);

    const movements = await db.queryAll<{
      id: string;
      company_id: string;
      item_id: string;
      item_name: string;
      type: StockMovementType;
      quantity_delta: number;
      previous_quantity: number;
      new_quantity: number;
      reason: string;
      actor_user_id: string;
      actor_name: string;
      created_at: string;
    }>(
      `SELECT * FROM stock_movements WHERE company_id = ? ORDER BY created_at DESC LIMIT 40`,
      [companyId],
    );

    const categories = Array.from(new Set(allItems.map((i) => i.category).filter(Boolean))).sort();
    const totalUnits = allItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const totalValue = allItems.reduce(
      (s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0),
      0,
    );
    const lowStockCount = allItems.filter((i) => i.quantity <= i.min_quantity).length;
    const outOfStockCount = allItems.filter((i) => i.quantity <= 0).length;

    const filtered = allItems.filter((item) => {
      if (category && category !== "all" && item.category !== category) return false;
      if (lowStockOnly && item.quantity > item.min_quantity) return false;
      if (search) {
        const hay = `${item.sku} ${item.name} ${item.category} ${item.supplier} ${item.location}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return {
      status: 200,
      body: {
        items: filtered.map((i) => ({
          id: i.id,
          companyId: i.company_id,
          sku: i.sku,
          name: i.name,
          category: i.category,
          unit: i.unit,
          quantity: i.quantity,
          minQuantity: i.min_quantity,
          unitPrice: i.unit_price,
          supplier: i.supplier,
          location: i.location,
          notes: i.notes,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        })),
        movements: movements.map((m) => ({
          id: m.id,
          companyId: m.company_id,
          itemId: m.item_id,
          itemName: m.item_name,
          type: m.type,
          quantityDelta: m.quantity_delta,
          previousQuantity: m.previous_quantity,
          newQuantity: m.new_quantity,
          reason: m.reason,
          actorUserId: m.actor_user_id,
          actorName: m.actor_name,
          createdAt: m.created_at,
        })),
        categories,
        summary: {
          totalItems: allItems.length,
          totalUnits,
          totalValue,
          lowStockCount,
          outOfStockCount,
        },
      },
    };
  }

  if (req.method === "POST" && path === "/api/stock/items") {
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const body = (req.body || {}) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const sku =
      String(body.sku || "").trim() ||
      `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const category = String(body.category || "Général").trim() || "Général";
    const unit = String(body.unit || "pcs").trim() || "pcs";
    const quantity = Math.max(0, Math.round(Number(body.quantity || 0)));
    const minQuantity = Math.max(0, Math.round(Number(body.minQuantity ?? 5)));
    const unitPrice = Math.max(0, Number(body.unitPrice || 0));
    const supplier = String(body.supplier || "").trim();
    const location = String(body.location || "").trim();
    const notes = String(body.notes || "").trim();

    if (!name) {
      throw new HttpError(400, "Le nom du produit est obligatoire.");
    }

    const id = makeId();
    const now = nowIso();
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;

    await db.execute(
      `INSERT INTO stock_items (id, company_id, sku, name, category, unit, quantity, min_quantity, unit_price, supplier, location, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        companyId,
        sku,
        name,
        category,
        unit,
        quantity,
        minQuantity,
        unitPrice,
        supplier,
        location,
        notes,
        now,
        now,
      ],
    );

    if (quantity > 0) {
      await db.execute(
        `INSERT INTO stock_movements (id, company_id, item_id, item_name, type, quantity_delta, previous_quantity, new_quantity, reason, actor_user_id, actor_name, created_at)
         VALUES (?, ?, ?, ?, 'in', ?, 0, ?, 'Stock initial', ?, ?, ?)`,
        [makeId(), companyId, id, name, quantity, quantity, user.id, actorName, now],
      );
    }

    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "stock",
      action: "stock.item_created",
      summary: `Article « ${name} » (${sku}) ajouté au stock — ${quantity} ${unit}`,
    });

    return { status: 201, body: { id } };
  }

  const itemMatch = path.match(/^\/api\/stock\/items\/([^/]+)$/);
  if (req.method === "PATCH" && itemMatch) {
    const itemId = decodeURIComponent(itemMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{
      id: string;
      sku: string;
      name: string;
      category: string;
      unit: string;
      min_quantity: number;
      unit_price: number;
      supplier: string;
      location: string;
      notes: string;
    }>(`SELECT * FROM stock_items WHERE id = ? AND company_id = ?`, [itemId, companyId]);
    if (!existing) {
      throw new HttpError(404, "Article introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : existing.name;
    const sku =
      typeof body.sku === "string" && body.sku.trim() ? body.sku.trim() : existing.sku;
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : existing.category;
    const unit =
      typeof body.unit === "string" && body.unit.trim() ? body.unit.trim() : existing.unit;
    const minQuantity =
      body.minQuantity !== undefined
        ? Math.max(0, Math.round(Number(body.minQuantity)))
        : existing.min_quantity;
    const unitPrice =
      body.unitPrice !== undefined
        ? Math.max(0, Number(body.unitPrice))
        : existing.unit_price;
    const supplier =
      typeof body.supplier === "string" ? body.supplier.trim() : existing.supplier;
    const location =
      typeof body.location === "string" ? body.location.trim() : existing.location;
    const notes = typeof body.notes === "string" ? body.notes.trim() : existing.notes;

    await db.execute(
      `UPDATE stock_items
       SET sku = ?, name = ?, category = ?, unit = ?, min_quantity = ?, unit_price = ?, supplier = ?, location = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        sku,
        name,
        category,
        unit,
        minQuantity,
        unitPrice,
        supplier,
        location,
        notes,
        nowIso(),
        itemId,
      ],
    );

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "stock",
      action: "stock.item_updated",
      summary: `Fiche stock « ${name} » (${sku}) mise à jour`,
    });

    return { status: 200, body: { message: "Article mis à jour." } };
  }

  if (req.method === "DELETE" && itemMatch) {
    const itemId = decodeURIComponent(itemMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const existing = await db.queryFirst<{ id: string; name: string; sku: string }>(
      `SELECT id, name, sku FROM stock_items WHERE id = ? AND company_id = ?`,
      [itemId, companyId],
    );
    if (!existing) {
      throw new HttpError(404, "Article introuvable.");
    }

    await db.execute(`DELETE FROM stock_items WHERE id = ? AND company_id = ?`, [
      itemId,
      companyId,
    ]);

    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "stock",
      action: "stock.item_deleted",
      summary: `Article « ${existing.name} » (${existing.sku}) retiré du catalogue stock`,
    });

    return { status: 200, body: { message: "Article supprimé." } };
  }

  const moveMatch = path.match(/^\/api\/stock\/items\/([^/]+)\/movements$/);
  if (req.method === "POST" && moveMatch) {
    const itemId = decodeURIComponent(moveMatch[1]);
    const { user, companyId } = await requireCompanyMember(
      req,
      db,
      config.sessionSecret,
    );
    const item = await db.queryFirst<{
      id: string;
      name: string;
      unit: string;
      quantity: number;
    }>(`SELECT id, name, unit, quantity FROM stock_items WHERE id = ? AND company_id = ?`, [
      itemId,
      companyId,
    ]);
    if (!item) {
      throw new HttpError(404, "Article introuvable.");
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const type: StockMovementType =
      body.type === "in" || body.type === "out" || body.type === "adjustment"
        ? body.type
        : "in";
    const qtyInput = Math.round(Number(body.quantity || 0));
    const reason = String(body.reason || "").trim();

    if (type !== "adjustment" && qtyInput <= 0) {
      throw new HttpError(400, "La quantité du mouvement doit être supérieure à 0.");
    }
    if (type === "adjustment" && qtyInput < 0) {
      throw new HttpError(400, "La quantité ajustée ne peut pas être négative.");
    }

    const previousQty = item.quantity;
    let newQty = previousQty;
    let delta = 0;

    if (type === "in") {
      delta = qtyInput;
      newQty = previousQty + qtyInput;
    } else if (type === "out") {
      if (qtyInput > previousQty) {
        throw new HttpError(
          400,
          `Stock insuffisant (${previousQty} ${item.unit} disponible(s)).`,
        );
      }
      delta = -qtyInput;
      newQty = previousQty - qtyInput;
    } else {
      newQty = qtyInput;
      delta = newQty - previousQty;
    }

    const now = nowIso();
    const actorName = `${user.first_name} ${user.last_name}`.trim() || user.email;

    await db.batch([
      {
        sql: `UPDATE stock_items SET quantity = ?, updated_at = ? WHERE id = ? AND company_id = ?`,
        params: [newQty, now, itemId, companyId],
      },
      {
        sql: `INSERT INTO stock_movements (
          id, company_id, item_id, item_name, type, quantity_delta, previous_quantity, new_quantity, reason, actor_user_id, actor_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          makeId(),
          companyId,
          itemId,
          item.name,
          type,
          delta,
          previousQty,
          newQty,
          reason || (type === "in" ? "Entrée de stock" : type === "out" ? "Sortie de stock" : "Ajustement inventaire"),
          user.id,
          actorName,
          now,
        ],
      },
    ]);

    const action =
      type === "in"
        ? "stock.movement_in"
        : type === "out"
        ? "stock.movement_out"
        : "stock.adjustment";
    const summaryPrefix =
      type === "in"
        ? `Entrée stock +${qtyInput} ${item.unit}`
        : type === "out"
        ? `Sortie stock -${qtyInput} ${item.unit}`
        : `Ajustement stock (${previousQty} → ${newQty} ${item.unit})`;

    await writeActivityLog(db, {
      companyId,
      actorUid: user.id,
      actorName,
      actorEmail: user.email,
      category: "stock",
      action,
      summary: `${summaryPrefix} sur « ${item.name} »${reason ? ` — ${reason}` : ""}`,
    });

    return {
      status: 201,
      body: {
        previousQuantity: previousQty,
        newQuantity: newQty,
        delta,
      },
    };
  }

  return null;
}
