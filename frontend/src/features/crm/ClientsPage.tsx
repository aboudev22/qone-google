import React, { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  clientsApi,
  type Client,
  type ClientStatus,
} from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";
import { ClientFormModal } from "./ClientFormModal";
import { ExcelImportModal } from "./ExcelImportModal";

const STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Actif",
  prospect: "Prospect",
  inactive: "Inactif",
};

export const ClientsPage: React.FC = () => {
  const { currentCompany } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ClientStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [formModalClient, setFormModalClient] = useState<Client | null | undefined>(
    undefined,
  );
  const [showImportModal, setShowImportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await clientsApi.list({
        search: search.trim() || undefined,
        status: statusFilter,
      });
      setClients(res.clients);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de charger les clients.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchClients();
    }, 150);
    return () => clearTimeout(handle);
  }, [fetchClients]);

  const toggleSelectAll = () => {
    if (selectedIds.size === clients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (client: Client) => {
    try {
      await clientsApi.remove(client.id);
      await fetchClients();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de supprimer ce client.";
      setError(message);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const blob = await clientsApi.exportCsv({
        ids: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        search: search.trim() || undefined,
        status: statusFilter,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qone-clients-${currentCompany?.slug || "export"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Erreur lors de l'export CSV.";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            02 / Module CRM
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">Clients</h1>
          <p className="mt-1 text-xs text-muted">
            Gérez votre base de clients et contacts pour {currentCompany?.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 border border-line px-3.5 py-2 text-xs text-muted hover:text-fg hover:border-line-strong transition-colors whitespace-nowrap"
          >
            <Upload size={13} />
            <span>Importer Excel</span>
          </button>
          <button
            type="button"
            disabled={isExporting || clients.length === 0}
            onClick={handleExportCsv}
            className="flex items-center gap-2 border border-line px-3.5 py-2 text-xs text-muted hover:text-fg hover:border-line-strong transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            <Download size={13} />
            <span>
              {selectedIds.size > 0
                ? `Exporter CSV (${selectedIds.size})`
                : "Exporter CSV"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFormModalClient(null)}
            className="flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors whitespace-nowrap"
          >
            <Plus size={13} />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email ou société..."
            aria-label="Rechercher des clients"
            className="w-full bg-panel border border-line pl-9 pr-3.5 py-2 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 border border-line bg-panel p-1">
          {(
            [
              { key: "all", label: "Tous" },
              { key: "active", label: "Actifs" },
              { key: "prospect", label: "Prospects" },
              { key: "inactive", label: "Inactifs" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-xs transition-colors whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-panel-raised text-fg font-medium"
                  : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-line-strong bg-panel p-4 text-xs text-fg"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="border border-line bg-panel divide-y divide-line">
          {[1, 2, 3].map((row) => (
            <div key={row} className="px-5 py-4 flex items-center justify-between">
              <div className="h-3 w-48 bg-panel-raised animate-pulse" />
              <div className="h-3 w-24 bg-panel-raised animate-pulse" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-line bg-panel p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8">
          <div className="size-12 border border-line bg-panel-raised flex items-center justify-center text-muted mb-4">
            <Users size={22} />
          </div>
          <h3 className="text-sm font-medium text-fg">
            {search || statusFilter !== "all"
              ? "Aucun client ne correspond à ces filtres"
              : "Aucun client enregistré"}
          </h3>
          <p className="mt-2 text-xs text-muted leading-relaxed max-w-sm">
            {search || statusFilter !== "all"
              ? "Modifiez votre recherche ou réinitialisez les filtres pour afficher l'ensemble de vos clients."
              : "Votre répertoire est actuellement vide. Ajoutez un premier client manuellement ou importez un fichier Excel (.xlsx)."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={() => setFormModalClient(null)}
              className="flex items-center gap-2 bg-fg px-4 py-2.5 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors"
            >
              <Plus size={14} />
              Ajouter un client
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 border border-line px-4 py-2.5 text-xs text-muted hover:text-fg hover:border-line-strong transition-colors"
            >
              <FileSpreadsheet size={14} />
              Importer un fichier Excel
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-line bg-panel overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-panel-raised text-[11px] uppercase tracking-wider text-faint">
                <th className="py-3 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    aria-label="Tout sélectionner"
                    checked={
                      clients.length > 0 && selectedIds.size === clients.length
                    }
                    onChange={toggleSelectAll}
                    className="accent-accent"
                  />
                </th>
                <th className="py-3 px-3 font-medium">Client</th>
                <th className="py-3 px-3 font-medium">Entreprise</th>
                <th className="py-3 px-3 font-medium">Contact</th>
                <th className="py-3 px-3 font-medium">Statut</th>
                <th className="py-3 pl-3 pr-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="hover:bg-panel-raised/60 transition-colors"
                >
                  <td className="py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${client.name}`}
                      checked={selectedIds.has(client.id)}
                      onChange={() => toggleSelectOne(client.id)}
                      className="accent-accent"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-medium text-fg">{client.name}</p>
                    {client.notes && (
                      <p className="text-[11px] text-faint truncate max-w-[240px]">
                        {client.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-muted">
                    {client.companyName || "—"}
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-fg">{client.email || "—"}</p>
                    {client.phone && (
                      <p className="text-[11px] text-faint tabular-nums">
                        {client.phone}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-muted">
                    {STATUS_LABELS[client.status]}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFormModalClient(client)}
                        title="Modifier"
                        aria-label={`Modifier ${client.name}`}
                        className="p-1.5 text-muted hover:text-fg border border-transparent hover:border-line"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(client)}
                        title="Supprimer"
                        aria-label={`Supprimer ${client.name}`}
                        className="p-1.5 text-muted hover:text-accent border border-transparent hover:border-line"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formModalClient !== undefined && (
        <ClientFormModal
          client={formModalClient}
          onClose={() => setFormModalClient(undefined)}
          onSaved={() => {
            setFormModalClient(undefined);
            void fetchClients();
          }}
        />
      )}

      {showImportModal && (
        <ExcelImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            void fetchClients();
          }}
        />
      )}
    </div>
  );
};
