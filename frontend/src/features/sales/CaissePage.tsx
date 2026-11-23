import React, { useEffect, useRef, useState } from "react";
import {
  Receipt,
  Plus,
  Trash2,
  Printer,
  FileText,
  User,
  CheckCircle2,
  X,
  Building2,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import { clientsApi, stockApi, type Client, type StockItem } from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const formatXaf = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceRecord {
  id: string;
  number: string;
  date: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  companyName: string;
  cashierName: string;
  items: InvoiceItem[];
  totalAmount: number;
  paymentMethod: string;
}

export const CaissePage: React.FC = () => {
  const { user, currentCompany } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invoiceSeqRef = useRef(1042);

  // Cash register state
  const [cashierName, setCashierName] = useState(
    user ? `${user.firstName} ${user.lastName}`.trim() : "Gestionnaire Caisse"
  );
  const [selectedClientId, setSelectedClientId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: "1", name: "", quantity: 1, unitPrice: 0 },
  ]);

  // Invoice preview state
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRecord | null>(null);
  const [invoicesHistory, setInvoicesHistory] = useState<InvoiceRecord[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([clientsApi.list(), stockApi.list()])
      .then(([cRes, sRes]) => {
        if (!active) return;
        setClients(cRes.clients);
        setStockItems(sRes.items);
        if (cRes.clients.length > 0) {
          setSelectedClientId(cRes.clients[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Impossible de charger les données de caisse."
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const handleAddStockItemToCart = (stockItem: StockItem) => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `${stockItem.name} (${stockItem.sku})`,
        quantity: 1,
        unitPrice: stockItem.unitPrice || 0,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleItemChange = (
    id: string,
    field: keyof InvoiceItem,
    val: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setError("Veuillez sélectionner un client pour émettre la facture.");
      return;
    }
    if (items.length === 0 || items.some((i) => !i.name.trim())) {
      setError("Veuillez ajouter au moins un produit ou service valide.");
      return;
    }

    const client = clients.find((c) => c.id === selectedClientId);
    invoiceSeqRef.current += 1;
    const invoiceNum = `FAC-${new Date().getFullYear()}-${invoiceSeqRef.current}`;

    const newRecord: InvoiceRecord = {
      id: crypto.randomUUID(),
      number: invoiceNum,
      date: new Date().toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      clientName: client ? client.name : "Client Inconnu",
      clientEmail: client?.email || "contact@client.com",
      clientPhone: client?.phone || "+237 690 90 90 90",
      companyName: currentCompany?.name || "qone Enterprise",
      cashierName: cashierName.trim() || "Gestionnaire",
      items: [...items],
      totalAmount: subtotal,
      paymentMethod,
    };

    setActiveInvoice(newRecord);
    setInvoicesHistory((prev) => [newRecord, ...prev]);
    setError(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            06 / Module Caisse & Facturation
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Caisse & Émission de Factures
          </h1>
          <p className="mt-1 text-xs text-muted">
            Enregistrez les ventes de produits ou services, gérez la caisse et éditez des factures PDF certifiées.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-panel border border-line px-3.5 py-2 text-xs">
            <User size={14} className="text-accent" />
            <span className="text-muted">Gestionnaire :</span>
            <input
              type="text"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              className="bg-canvas border border-line px-2 py-1 text-xs text-fg focus:outline-none focus:border-fg"
              placeholder="Nom du caissier"
            />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="border border-line-strong bg-panel p-4 text-xs text-fg">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="border border-line bg-panel p-8 text-xs text-muted">
          Chargement du module de caisse...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left / Main form: POS Cart */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleGenerateInvoice} className="border border-line bg-panel p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-accent" />
                  <h2 className="text-sm font-medium text-fg">Nouvelle Vente & Facturation</h2>
                </div>
                <span className="text-xs text-muted font-mono">{currentCompany?.name}</span>
              </div>

              {/* Client selection */}
              <div>
                <label
                  htmlFor="pos-client"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Client associé *
                </label>
                {clients.length === 0 ? (
                  <div className="p-3 border border-line-strong bg-canvas text-xs text-muted">
                    Aucun client enregistré. Veuillez d'abord ajouter un client dans le module CRM.
                  </div>
                ) : (
                  <select
                    id="pos-client"
                    required
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.companyName ? `(${c.companyName})` : ""} — {c.phone || "+237 690 90 90 90"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quick Stock items shortcut */}
              {stockItems.length > 0 && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                    Ajouter rapidement depuis le stock
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-line bg-canvas">
                    {stockItems.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleAddStockItemToCart(s)}
                        className="px-2.5 py-1.5 border border-line bg-panel text-[11px] text-fg hover:border-fg transition-colors flex items-center gap-1.5"
                      >
                        <Plus size={11} className="text-accent" />
                        <span>{s.name} ({formatXaf(s.unitPrice)})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cart Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] uppercase tracking-wider text-muted">
                    Produits / Services facturés *
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs text-fg hover:text-accent transition-colors"
                  >
                    <Plus size={13} />
                    <span>Ajouter une ligne</span>
                  </button>
                </div>

                <div className="border border-line bg-canvas divide-y divide-line">
                  {items.map((item) => (
                    <div key={item.id} className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => handleItemChange(item.id, "name", e.target.value)}
                          placeholder="Nom du produit ou service"
                          className="w-full bg-panel border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(item.id, "quantity", Number(e.target.value) || 1)
                          }
                          placeholder="Qté"
                          className="w-full bg-panel border border-line px-3 py-2 text-xs text-fg tabular-nums focus:border-fg focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(item.id, "unitPrice", Number(e.target.value) || 0)
                          }
                          placeholder="Prix unit. (F CFA)"
                          className="w-full bg-panel border border-line px-3 py-2 text-xs text-fg tabular-nums focus:border-fg focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          disabled={items.length === 1}
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-muted hover:text-accent disabled:opacity-30"
                          aria-label="Supprimer la ligne"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method & Total */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label
                    htmlFor="pos-payment"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Mode de règlement
                  </label>
                  <select
                    id="pos-payment"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Mobile Money (MTN / Orange)">Mobile Money (MTN / Orange)</option>
                    <option value="Virement Bancaire">Virement Bancaire</option>
                    <option value="Carte Bancaire">Carte Bancaire</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="border border-line bg-panel p-3.5 flex items-center justify-between">
                    <span className="text-xs text-muted">Total à régler :</span>
                    <span className="text-lg font-medium text-fg tabular-nums">
                      {formatXaf(subtotal)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={clients.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-fg px-5 py-3 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors disabled:opacity-50"
              >
                <FileText size={14} />
                <span>Générer et afficher la facture</span>
              </button>
            </form>
          </div>

          {/* Right Column: Invoices History */}
          <div className="space-y-6">
            <div className="border border-line bg-panel p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-fg">
                  Factures récentes ({invoicesHistory.length})
                </h3>
                <Receipt size={15} className="text-muted" />
              </div>

              {invoicesHistory.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">
                  Aucune facture générée pour l'instant.
                </p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto">
                  {invoicesHistory.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => setActiveInvoice(inv)}
                      className="border border-line bg-canvas p-3.5 cursor-pointer hover:border-line-strong transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-fg">{inv.number}</span>
                        <span className="text-fg tabular-nums font-medium">{formatXaf(inv.totalAmount)}</span>
                      </div>
                      <div className="text-[11px] text-muted flex items-center justify-between">
                        <span>{inv.clientName}</span>
                        <span>{inv.paymentMethod}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal / Drawer */}
      {activeInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-panel border border-line-strong p-8 space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b border-line pb-4 print:hidden">
              <div className="flex items-center gap-2 text-accent">
                <CheckCircle2 size={18} />
                <span className="text-xs font-mono uppercase tracking-wider">Facture validée & certifiée</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-fg px-3.5 py-2 text-xs font-medium text-canvas hover:bg-[#dedede]"
                >
                  <Printer size={13} />
                  <span>Imprimer / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveInvoice(null)}
                  className="p-1.5 text-muted hover:text-fg"
                  aria-label="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Printable Invoice Document */}
            <div id="printable-invoice" className="bg-canvas border border-line p-8 space-y-8 text-fg">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-accent" />
                    <span className="text-lg font-medium tracking-tight">{activeInvoice.companyName}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">Module Caisse & Facturation ERP</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-medium tracking-tight">{activeInvoice.number}</h2>
                  <p className="mt-1 text-xs text-muted flex items-center gap-1 justify-end">
                    <Calendar size={12} /> {activeInvoice.date}
                  </p>
                </div>
              </div>

              {/* Client & Cashier info */}
              <div className="grid grid-cols-2 gap-6 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted">Facturé à :</span>
                  <p className="text-sm font-medium text-fg">{activeInvoice.clientName}</p>
                  <p className="text-muted">{activeInvoice.clientEmail}</p>
                  <p className="text-muted">{activeInvoice.clientPhone}</p>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-[11px] uppercase tracking-wider text-muted">Gestionnaire de caisse :</span>
                  <p className="text-sm font-medium text-fg">{activeInvoice.cashierName}</p>
                  <p className="text-muted">Mode : {activeInvoice.paymentMethod}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-line overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line bg-panel text-[11px] uppercase tracking-wider text-muted">
                      <th className="py-3 px-4 font-medium">Désignation produit / service</th>
                      <th className="py-3 px-4 font-medium text-right">Quantité</th>
                      <th className="py-3 px-4 font-medium text-right">Prix Unitaire</th>
                      <th className="py-3 px-4 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activeInvoice.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 text-fg">{it.name}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-muted">{it.quantity}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-muted">{formatXaf(it.unitPrice)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-fg font-medium">
                          {formatXaf(it.quantity * it.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary & Stamp */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-line">
                <div className="border border-accent/60 bg-panel px-4 py-2 text-xs font-mono text-accent uppercase tracking-wider">
                  STATUT : PAYÉ & VALIDÉ
                </div>
                <div className="text-right space-y-1">
                  <span className="text-xs text-muted">Montant Total TTC :</span>
                  <div className="text-2xl font-medium text-fg tabular-nums">
                    {formatXaf(activeInvoice.totalAmount)}
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-faint pt-4 border-t border-line">
                {activeInvoice.companyName} — Facture émise via qone ERP le {activeInvoice.date}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
