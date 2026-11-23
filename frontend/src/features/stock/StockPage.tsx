import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  stockApi,
  type StockItem,
  type StockMovement,
  type StockMovementType,
} from "../../shared/api/erp";

const formatXaf = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;

export const StockPage: React.FC = () => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    totalUnits: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Général");
  const [unit, setUnit] = useState("pcs");
  const [quantity, setQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("5");
  const [unitPrice, setUnitPrice] = useState("0");
  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);

  // Movement Modal
  const [moveItem, setMoveItem] = useState<StockItem | null>(null);
  const [moveType, setMoveType] = useState<StockMovementType>("in");
  const [moveQty, setMoveQty] = useState("1");
  const [moveReason, setMoveReason] = useState("");
  const [isSavingMove, setIsSavingMove] = useState(false);

  const loadStock = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await stockApi.list({
        search: search.trim() || undefined,
        category: categoryFilter,
        lowStock: lowStockOnly,
      });
      setItems(res.items);
      setMovements(res.movements);
      setCategories(res.categories);
      setSummary(res.summary);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger le stock.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryFilter, lowStockOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadStock();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadStock]);

  const openCreateModal = () => {
    setEditingItem(null);
    setSku("");
    setName("");
    setCategory("Général");
    setUnit("pcs");
    setQuantity("0");
    setMinQuantity("0");
    setUnitPrice("0");
    setSupplier("");
    setLocation("");
    setNotes("");
    setItemModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setSku(item.sku);
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setQuantity(String(item.quantity));
    setMinQuantity(String(item.minQuantity));
    setUnitPrice(String(item.unitPrice));
    setSupplier(item.supplier);
    setLocation(item.location);
    setNotes(item.notes);
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSavingItem(true);
    setError(null);
    try {
      if (editingItem) {
        await stockApi.update(editingItem.id, {
          sku: sku.trim(),
          name: name.trim(),
          category: category.trim() || "Général",
          unit: unit.trim() || "pcs",
          minQuantity: Number(minQuantity) || 0,
          unitPrice: Number(unitPrice) || 0,
          supplier: supplier.trim(),
          location: location.trim(),
          notes: notes.trim(),
        });
      } else {
        await stockApi.create({
          sku: sku.trim() || undefined,
          name: name.trim(),
          category: category.trim() || "Général",
          unit: unit.trim() || "pcs",
          quantity: Number(quantity) || 0,
          minQuantity: Number(minQuantity) || 0,
          unitPrice: Number(unitPrice) || 0,
          supplier: supplier.trim(),
          location: location.trim(),
          notes: notes.trim(),
        });
      }
      setItemModalOpen(false);
      await loadStock();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible d'enregistrer l'article.",
      );
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: StockItem) => {
    setError(null);
    try {
      await stockApi.remove(item.id);
      await loadStock();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de supprimer cet article.",
      );
    }
  };

  const openMovementModal = (item: StockItem, type: StockMovementType) => {
    setMoveItem(item);
    setMoveType(type);
    setMoveQty(type === "adjustment" ? String(item.quantity) : "1");
    setMoveReason("");
  };

  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem) return;
    setIsSavingMove(true);
    setError(null);
    try {
      await stockApi.addMovement(moveItem.id, {
        type: moveType,
        quantity: Number(moveQty) || 0,
        reason: moveReason.trim(),
      });
      setMoveItem(null);
      await loadStock();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer le mouvement de stock.",
      );
    } finally {
      setIsSavingMove(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            03 / Module Stock & Inventaire
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Gestion des Stocks
          </h1>
          <p className="mt-1 text-xs text-muted">
            Suivez vos références, seuils d'alerte, entrées, sorties et valorisation en temps réel.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors whitespace-nowrap"
        >
          <Plus size={13} />
          <span>Nouvel article</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-line-strong bg-panel p-4 text-xs text-fg"
        >
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-line bg-panel p-5">
          <span className="text-[11px] text-faint uppercase">Références</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-medium text-fg tabular-nums">
              {summary.totalItems}
            </span>
            <span className="text-[11px] text-muted tabular-nums">
              {summary.totalUnits} unités
            </span>
          </div>
        </div>

        <div className="border border-line bg-panel p-5">
          <span className="text-[11px] text-faint uppercase">Valeur totale</span>
          <div className="mt-2 text-2xl font-medium text-fg tabular-nums">
            {formatXaf(summary.totalValue)}
          </div>
        </div>

        <div className="border border-line bg-panel p-5">
          <span className="text-[11px] text-faint uppercase">Alertes stock bas</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-medium text-fg tabular-nums">
              {summary.lowStockCount}
            </span>
            {summary.lowStockCount > 0 && (
              <span className="size-2 rounded-full bg-accent" />
            )}
          </div>
        </div>

        <div className="border border-line bg-panel p-5">
          <span className="text-[11px] text-faint uppercase">Ruptures</span>
          <div className="mt-2 text-2xl font-medium text-fg tabular-nums">
            {summary.outOfStockCount}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par SKU, nom, fournisseur, emplacement..."
            className="w-full bg-panel border border-line pl-9 pr-3.5 py-2 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none"
          />
        </div>

        <select
          aria-label="Filtrer par catégorie"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-panel border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
        >
          <option value="all">Toutes les catégories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setLowStockOnly((prev) => !prev)}
          className={`flex items-center gap-2 border px-3.5 py-2 text-xs transition-colors ${
            lowStockOnly
              ? "border-accent bg-panel-raised text-fg"
              : "border-line bg-panel text-muted hover:text-fg"
          }`}
        >
          <AlertTriangle size={13} className={lowStockOnly ? "text-accent" : ""} />
          <span>Stock bas uniquement</span>
        </button>
      </div>

      {/* Stock Table */}
      <div className="border border-line bg-panel overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-panel-raised text-[11px] text-faint uppercase tracking-wider">
              <th className="py-3.5 px-4 font-medium">Article / SKU</th>
              <th className="py-3.5 px-4 font-medium">Catégorie</th>
              <th className="py-3.5 px-4 font-medium text-right">Quantité</th>
              <th className="py-3.5 px-4 font-medium text-right">Seuil min</th>
              <th className="py-3.5 px-4 font-medium text-right">Prix unit.</th>
              <th className="py-3.5 px-4 font-medium">Emplacement</th>
              <th className="py-3.5 px-4 font-medium text-right">Mouvements & Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  Chargement du catalogue stock...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-faint">
                  <Package size={20} className="mx-auto mb-2 text-muted" />
                  Aucun article trouvé.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isLow = item.quantity <= item.minQuantity;
                const isOut = item.quantity <= 0;
                return (
                  <tr key={item.id} className="hover:bg-panel-raised/50">
                    <td className="py-3.5 px-4">
                      <p className="text-fg font-medium">{item.name}</p>
                      <p className="text-[11px] text-faint tabular-nums">
                        {item.sku}
                        {item.supplier ? ` · ${item.supplier}` : ""}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-muted">{item.category}</td>
                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <span
                        className={`inline-flex items-center gap-1.5 font-medium ${
                          isOut || isLow ? "text-accent" : "text-fg"
                        }`}
                      >
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-faint tabular-nums">
                      {item.minQuantity} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right text-fg tabular-nums">
                      {formatXaf(item.unitPrice)}
                    </td>
                    <td className="py-3.5 px-4 text-muted">
                      {item.location || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openMovementModal(item, "in")}
                          title="Entrée de stock"
                          className="px-2 py-1 border border-line bg-canvas text-[11px] text-fg hover:border-fg flex items-center gap-1"
                        >
                          <ArrowUp size={11} />
                          <span>Entrée</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openMovementModal(item, "out")}
                          title="Sortie de stock"
                          className="px-2 py-1 border border-line bg-canvas text-[11px] text-muted hover:text-fg hover:border-fg flex items-center gap-1"
                        >
                          <ArrowDown size={11} />
                          <span>Sortie</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openMovementModal(item, "adjustment")}
                          title="Ajuster le stock"
                          className="p-1.5 text-muted hover:text-fg border border-transparent hover:border-line"
                        >
                          <SlidersHorizontal size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Modifier l'article"
                          className="p-1.5 text-muted hover:text-fg border border-transparent hover:border-line"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteItem(item)}
                          title="Supprimer l'article"
                          className="p-1.5 text-muted hover:text-accent border border-transparent hover:border-line"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Stock Movements */}
      {movements.length > 0 && (
        <div className="border border-line bg-panel">
          <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
            <span className="text-xs font-medium text-fg">
              Derniers mouvements de stock
            </span>
            <span className="text-[11px] text-faint">
              Traçabilité des entrées & sorties
            </span>
          </div>
          <div className="divide-y divide-line">
            {movements.slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="text-fg font-medium">{m.itemName}</span>{" "}
                  <span
                    className={`tabular-nums font-medium ${
                      m.quantityDelta >= 0 ? "text-fg" : "text-accent"
                    }`}
                  >
                    ({m.quantityDelta >= 0 ? `+${m.quantityDelta}` : m.quantityDelta})
                  </span>
                  <span className="text-faint">
                    {" "}
                    · {m.previousQuantity} → {m.newQuantity} · {m.reason}
                  </span>
                </div>
                <span className="text-[11px] text-faint tabular-nums">
                  {m.actorName} ·{" "}
                  {new Date(m.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Stock Item */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-line-strong bg-panel p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">
                {editingItem ? "Modifier l'article" : "Ajouter un article au stock"}
              </h2>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1 text-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Nom de l'article *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carton format M"
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Référence / SKU
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Auto si vide"
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Catégorie
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Unité
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs, kg, lot..."
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Prix unitaire (F CFA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!editingItem && (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                      Quantité initiale
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Seuil d'alerte bas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Fournisseur
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Emplacement
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Allée A-01"
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSavingItem ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Stock Movement */}
      {moveItem && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-line-strong bg-panel p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">
                {moveType === "in"
                  ? "Entrée de stock"
                  : moveType === "out"
                  ? "Sortie de stock"
                  : "Ajuster la quantité"}
              </h2>
              <button
                type="button"
                onClick={() => setMoveItem(null)}
                className="p-1 text-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-muted">
              Article : <span className="text-fg font-medium">{moveItem.name}</span>{" "}
              (actuel : {moveItem.quantity} {moveItem.unit})
            </div>
            <form onSubmit={handleSubmitMovement} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                  {moveType === "adjustment"
                    ? `Nouvelle quantité réelle (${moveItem.unit})`
                    : `Quantité (${moveItem.unit})`}
                </label>
                <input
                  type="number"
                  min={moveType === "adjustment" ? 0 : 1}
                  required
                  value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)}
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                  Motif / Commentaire
                </label>
                <input
                  type="text"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  placeholder="Réception fournisseur, vente client, inventaire..."
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setMoveItem(null)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingMove}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSavingMove ? "Validation..." : "Valider le mouvement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
