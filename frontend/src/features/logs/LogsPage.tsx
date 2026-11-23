import React, { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, ScrollText, Search } from "lucide-react";
import {
  logsApi,
  type ActivityLog,
  type LogCategory,
} from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const CATEGORY_LABELS: Record<"all" | LogCategory, string> = {
  all: "Toutes les activités",
  projects: "Projets & Tâches",
  stock: "Stock & Inventaire",
  team: "Équipe & Accès",
  crm: "Clients & CRM",
  sales: "Opportunités & Ventes",
  settings: "Paramètres",
};

export const LogsPage: React.FC = () => {
  const { currentCompany } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [category, setCategory] = useState<"all" | LogCategory>("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await logsApi.list({
        category,
        search: search.trim() || undefined,
        limit: 200,
      });
      setLogs(res.logs);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible de charger les journaux.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLogs();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  const handleExportCsv = () => {
    const header = ["Date", "Acteur", "Email", "Module", "Action", "Résumé"];
    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const rows = logs.map((l) => [
      new Date(l.createdAt).toLocaleString("fr-FR"),
      l.actorName,
      l.actorEmail || "",
      CATEGORY_LABELS[l.category] || l.category,
      l.action,
      l.summary,
    ]);
    const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qone-logs-${currentCompany?.slug || "export"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            07 / Traçabilité & Audit
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Journal d'activité (Logs)
          </h1>
          <p className="mt-1 text-xs text-muted">
            Historique complet de toutes les actions effectuées dans {currentCompany?.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="flex items-center gap-2 border border-line bg-panel px-3.5 py-2 text-xs text-muted hover:text-fg hover:border-line-strong"
          >
            <RefreshCw size={13} />
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede] disabled:opacity-50"
          >
            <Download size={13} />
            <span>Exporter CSV</span>
          </button>
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
            placeholder="Filtrer par collaborateur, email, action ou description..."
            className="w-full bg-panel border border-line pl-9 pr-3.5 py-2 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none"
          />
        </div>

        <select
          aria-label="Filtrer par module"
          value={category}
          onChange={(e) => setCategory(e.target.value as "all" | LogCategory)}
          className="bg-panel border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
        >
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="border border-line bg-panel overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-panel-raised text-[11px] text-faint uppercase tracking-wider">
              <th className="py-3.5 px-4 font-medium">Horodatage</th>
              <th className="py-3.5 px-4 font-medium">Module</th>
              <th className="py-3.5 px-4 font-medium">Auteur</th>
              <th className="py-3.5 px-4 font-medium">Action effectuée</th>
              <th className="py-3.5 px-4 font-medium text-right">Code</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-muted">
                  Chargement des logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-faint">
                  <ScrollText size={20} className="mx-auto mb-2 text-muted" />
                  Aucune activité enregistrée pour ces filtres.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-panel-raised/50">
                  <td className="py-3.5 px-4 text-[11px] text-faint tabular-nums whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="border border-line bg-canvas px-2 py-0.5 text-[10px] text-muted">
                      {CATEGORY_LABELS[log.category] || log.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="text-fg font-medium">{log.actorName}</p>
                    {log.actorEmail && (
                      <p className="text-[11px] text-faint">{log.actorEmail}</p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-fg">{log.summary}</td>
                  <td className="py-3.5 px-4 text-right text-[11px] text-faint tabular-nums whitespace-nowrap">
                    {log.action}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
