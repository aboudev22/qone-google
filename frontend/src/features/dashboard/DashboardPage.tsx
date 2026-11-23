import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  FolderKanban,
  Mail,
  Package,
  Users,
  X,
} from "lucide-react";
import { companiesApi, type CompanySummaryResponse } from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const formatXaf = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;

const STAGE_COLORS: Record<string, string> = {
  prospecting: "bg-blue-500",
  qualification: "bg-indigo-500",
  proposal: "bg-amber-500",
  negotiation: "bg-cyan-500",
  won: "bg-emerald-500",
  lost: "bg-rose-500",
};

const TASK_COLORS: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-amber-500",
  review: "bg-violet-500",
  done: "bg-emerald-500",
};

export const DashboardPage: React.FC = () => {
  const {
    user,
    currentCompany,
    pendingInvitations,
    acceptInvitation,
    declineInvitation,
  } = useAuth();
  const [data, setData] = useState<CompanySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invBusyId, setInvBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCompany) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await companiesApi.getSummary();
        if (active) setData(res);
      } catch (err: unknown) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les indicateurs.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [currentCompany]);

  const handleAcceptInvite = async (id: string) => {
    setInvBusyId(id);
    try {
      await acceptInvitation(id);
    } finally {
      setInvBusyId(null);
    }
  };

  const handleDeclineInvite = async (id: string) => {
    setInvBusyId(id);
    try {
      await declineInvitation(id);
    } finally {
      setInvBusyId(null);
    }
  };

  const summary = data?.summary;
  const charts = data?.charts;
  const maxPipelineAmount = Math.max(
    1,
    ...(charts?.pipelineByStage.map((p) => p.amount) || [1]),
  );
  const maxTaskCount = Math.max(
    1,
    ...(charts?.tasksByStatus.map((t) => t.count) || [1]),
  );
  const stockTotalCount = Math.max(1, summary?.stockItemsCount || 0);

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-10">
      <div className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-faint tracking-wider">
              <span className="size-1.5 rounded-full bg-accent" />
              <span>
                {currentCompany?.workspaceType === "personal"
                  ? "Espace particulier"
                  : "Entreprise active"}{" "}
                · {currentCompany?.name}
              </span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-medium tracking-tight">
              Bonjour, {user?.firstName}.
            </h1>
            <p className="mt-1 text-xs text-muted">
              Vue d'ensemble de vos projets, stocks, équipe et activité commerciale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/projects"
              className="px-3.5 py-2 border border-line bg-panel text-xs text-fg hover:border-fg transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <FolderKanban size={13} />
              <span>Projets</span>
            </Link>
            <Link
              to="/app/stock"
              className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <span>Gérer le stock</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <div className="border border-accent/60 bg-panel p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-fg">
            <Mail size={14} className="text-accent" />
            <span>
              Invitations reçues ({pendingInvitations.length})
            </span>
          </div>
          <div className="divide-y divide-line">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="py-3 first:pt-1 last:pb-0 flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div>
                  <p className="text-fg font-medium">
                    {inv.companyName}
                    {inv.projectName ? ` — Projet : ${inv.projectName}` : ""}
                  </p>
                  <p className="text-[11px] text-muted">
                    Invité par {inv.invitedByName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={invBusyId === inv.id}
                    onClick={() => void handleAcceptInvite(inv.id)}
                    className="flex items-center gap-1.5 bg-fg px-3 py-1.5 text-xs font-medium text-canvas hover:bg-[#dedede] disabled:opacity-50"
                  >
                    <Check size={12} />
                    <span>Accepter</span>
                  </button>
                  <button
                    type="button"
                    disabled={invBusyId === inv.id}
                    onClick={() => void handleDeclineInvite(inv.id)}
                    className="flex items-center gap-1.5 border border-line px-3 py-1.5 text-xs text-muted hover:text-fg"
                  >
                    <X size={12} />
                    <span>Refuser</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="border border-line-strong bg-panel p-4 text-xs text-fg">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div>
        <p className="text-[11px] text-faint uppercase tracking-wider mb-4">
          Indicateurs clés
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Équipe & Projets</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : summary?.membersCount ?? 1}
              </span>
              <span className="text-[11px] text-muted tabular-nums">
                {isLoading ? "" : `${summary?.projectsCount ?? 0} projet(s)`}
              </span>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Tâches en cours</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : summary?.openTasksCount ?? 0}
              </span>
              <span className="text-[11px] text-muted tabular-nums">
                {isLoading ? "" : `sur ${summary?.tasksCount ?? 0} total`}
              </span>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Valeur du stock</span>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : formatXaf(summary?.stockValue ?? 0)}
              </span>
              <span className="text-[11px] text-muted tabular-nums">
                {isLoading
                  ? ""
                  : `${summary?.lowStockCount ?? 0} alerte(s)`}
              </span>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Pipeline & Ventes</span>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading
                  ? "—"
                  : formatXaf(
                      (summary?.pipelineValue ?? 0) + (summary?.wonValue ?? 0),
                    )}
              </span>
              <span className="size-1.5 rounded-full bg-accent shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Colorful Charts */}
      {charts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Pipeline commercial par étape */}
          <div className="border border-line bg-panel p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <p className="text-xs font-medium text-fg">
                  Pipeline commercial par étape
                </p>
                <p className="text-[11px] text-faint mt-0.5">
                  Répartition des montants (F CFA)
                </p>
              </div>
              <Link
                to="/app/sales"
                className="text-[11px] text-muted hover:text-fg"
              >
                Ventes →
              </Link>
            </div>

            <div className="space-y-3.5">
              {charts.pipelineByStage.every((r) => r.amount === 0 && r.count === 0) ? (
                <div className="py-8 text-center text-xs text-muted space-y-2">
                  <p>Aucune opportunité commerciale enregistrée.</p>
                  <Link
                    to="/app/sales"
                    className="text-fg underline decoration-line hover:decoration-fg inline-block text-[11px]"
                  >
                    Créer une première opportunité →
                  </Link>
                </div>
              ) : (
                charts.pipelineByStage.map((row) => {
                  const widthPct = Math.round((row.amount / maxPipelineAmount) * 100);
                  const barColor = STAGE_COLORS[row.stage] || "bg-indigo-500";
                  return (
                    <div key={row.stage} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-muted">
                          <span className={`size-2 rounded-full ${barColor}`} />
                          <span>{row.label}</span>
                          <span className="text-[11px] text-faint tabular-nums">
                            ({row.count})
                          </span>
                        </span>
                        <span className="text-fg tabular-nums font-medium">
                          {formatXaf(row.amount)}
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-canvas border border-line overflow-hidden rounded-sm">
                        <div
                          className={`h-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${row.amount > 0 ? Math.max(6, widthPct) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chart 2: Tâches & Santé du Stock */}
          <div className="border border-line bg-panel p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <p className="text-xs font-medium text-fg">
                    Avancement des tâches d'équipe
                  </p>
                  <p className="text-[11px] text-faint mt-0.5">
                    Répartition actuelle par statut
                  </p>
                </div>
                <Link
                  to="/app/projects"
                  className="text-[11px] text-muted hover:text-fg"
                >
                  Projets →
                </Link>
              </div>

              {charts.tasksByStatus.every((t) => t.count === 0) ? (
                <div className="py-6 text-center text-xs text-muted space-y-2">
                  <p>Aucune tâche créée dans vos projets.</p>
                  <Link
                    to="/app/projects"
                    className="text-fg underline decoration-line hover:decoration-fg inline-block text-[11px]"
                  >
                    Créer un projet et ajouter des tâches →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 items-end h-28 pt-2">
                  {charts.tasksByStatus.map((item) => {
                    const pct = Math.round((item.count / maxTaskCount) * 100);
                    const taskBarColor = TASK_COLORS[item.status] || "bg-indigo-500";
                    return (
                      <div
                        key={item.status}
                        className="flex flex-col items-center justify-end h-full gap-1.5"
                      >
                        <span className="text-[11px] text-fg tabular-nums font-medium">
                          {item.count}
                        </span>
                        <div className="w-full flex-1 bg-canvas border border-line flex items-end rounded-sm overflow-hidden">
                          <div
                            className={`w-full transition-all duration-500 ${taskBarColor}`}
                            style={{
                              height: `${item.count > 0 ? Math.max(14, pct) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-faint truncate max-w-full">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-line pt-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg font-medium">État du stock</span>
                <span className="text-[11px] text-faint tabular-nums">
                  {summary?.stockItemsCount ?? 0} référence(s)
                </span>
              </div>
              {summary?.stockItemsCount === 0 ? (
                <div className="py-2 text-center text-xs text-muted">
                  Aucun article en stock.{" "}
                  <Link to="/app/stock" className="text-fg underline decoration-line hover:decoration-fg">
                    Ajouter des articles →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="h-3 w-full bg-canvas border border-line flex overflow-hidden rounded-sm">
                    <div
                      className="bg-emerald-500 h-full transition-all"
                      style={{
                        width: `${
                          (charts.stockHealth.healthy / stockTotalCount) * 100
                        }%`,
                      }}
                      title="Stock sain"
                    />
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{
                        width: `${
                          (charts.stockHealth.low / stockTotalCount) * 100
                        }%`,
                      }}
                      title="Stock bas"
                    />
                    <div
                      className="bg-rose-500 h-full transition-all"
                      style={{
                        width: `${
                          (charts.stockHealth.out / stockTotalCount) * 100
                        }%`,
                      }}
                      title="Rupture"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-faint tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Sain : {charts.stockHealth.healthy}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" />
                      Bas : {charts.stockHealth.low}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-500" />
                      Rupture : {charts.stockHealth.out}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <div className="flex items-center justify-between border-t border-line pt-6 mb-4">
          <p className="text-[11px] text-faint uppercase tracking-wider">
            Accès rapide aux modules
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-line bg-panel p-6 flex flex-col justify-between hover:border-line-strong transition-colors">
            <div>
              <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-muted">
                <Users size={17} />
              </div>
              <h3 className="mt-4 text-sm font-medium text-fg">
                Rechercher & inviter des employés
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Trouvez les employés inscrits par email ou nom et intégrez-les à l'entreprise.
              </p>
            </div>
            <Link
              to="/app/team"
              className="mt-6 inline-flex items-center gap-2 text-xs text-fg hover:underline underline-offset-4"
            >
              Gérer l'équipe
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="border border-line bg-panel p-6 flex flex-col justify-between hover:border-line-strong transition-colors">
            <div>
              <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-muted">
                <Package size={17} />
              </div>
              <h3 className="mt-4 text-sm font-medium text-fg">
                Piloter le stock & inventaire
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Enregistrez vos entrées, sorties et seuils d'alerte de marchandises.
              </p>
            </div>
            <Link
              to="/app/stock"
              className="mt-6 inline-flex items-center gap-2 text-xs text-fg hover:underline underline-offset-4"
            >
              Ouvrir le stock
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="border border-line bg-panel p-6 flex flex-col justify-between hover:border-line-strong transition-colors">
            <div>
              <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-muted">
                <Briefcase size={17} />
              </div>
              <h3 className="mt-4 text-sm font-medium text-fg">
                Clients & Opportunités
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Centralisez vos fiches clients, classeurs Excel et deals commerciaux.
              </p>
            </div>
            <Link
              to="/app/sales"
              className="mt-6 inline-flex items-center gap-2 text-xs text-fg hover:underline underline-offset-4"
            >
              Ouvrir le pipeline ventes
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts + Recent Activities */}
      {data &&
        (data.lowStockItems.length > 0 ||
          data.recentClients.length > 0 ||
          data.recentOpportunities.length > 0 ||
          data.recentActivities.length > 0) && (
          <div className="space-y-6 border-t border-line pt-6">
            {data.lowStockItems.length > 0 && (
              <div className="border border-line bg-panel">
                <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-accent" />
                    <span className="text-xs font-medium text-fg">
                      Alertes réapprovisionnement
                    </span>
                  </div>
                  <Link
                    to="/app/stock"
                    className="text-[11px] text-muted hover:text-fg"
                  >
                    Voir le stock
                  </Link>
                </div>
                <div className="divide-y divide-line">
                  {data.lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="px-5 py-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="text-fg font-medium">{item.name}</span>{" "}
                        <span className="text-[11px] text-faint">({item.sku})</span>
                      </div>
                      <span className="text-accent tabular-nums">
                        {item.quantity} / min {item.minQuantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-line bg-panel">
                <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
                  <span className="text-xs font-medium text-fg">
                    Clients récents
                  </span>
                  <Link
                    to="/app/clients"
                    className="text-[11px] text-muted hover:text-fg"
                  >
                    Tout voir
                  </Link>
                </div>
                {data.recentClients.length === 0 ? (
                  <div className="p-6 text-xs text-faint">
                    Aucun client pour le moment.
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {data.recentClients.map((client) => (
                      <div
                        key={client.id}
                        className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-fg font-medium truncate">
                            {client.name}
                          </p>
                          <p className="text-[11px] text-faint truncate">
                            {client.companyName ||
                              client.email ||
                              "Sans entreprise"}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted shrink-0">
                          {client.status === "active"
                            ? "Actif"
                            : client.status === "prospect"
                            ? "Prospect"
                            : "Inactif"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-line bg-panel">
                <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
                  <span className="text-xs font-medium text-fg">
                    Opportunités récentes
                  </span>
                  <Link
                    to="/app/sales"
                    className="text-[11px] text-muted hover:text-fg"
                  >
                    Ouvrir le pipeline
                  </Link>
                </div>
                {data.recentOpportunities.length === 0 ? (
                  <div className="p-6 text-xs text-faint flex items-center gap-2">
                    <Building2 size={14} />
                    <span>Aucune opportunité enregistrée.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-line">
                    {data.recentOpportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-fg font-medium truncate">
                            {opp.title}
                          </p>
                          <p className="text-[11px] text-faint truncate">
                            {opp.clientName}
                          </p>
                        </div>
                        <span className="text-xs text-fg tabular-nums shrink-0">
                          {formatXaf(opp.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.recentActivities.length > 0 && (
              <div className="border border-line bg-panel">
                <div className="px-5 py-3.5 border-b border-line flex items-center justify-between">
                  <span className="text-xs font-medium text-fg">
                    Dernières entrées du journal (Logs)
                  </span>
                  <Link
                    to="/app/logs"
                    className="text-[11px] text-muted hover:text-fg"
                  >
                    Tout l'historique →
                  </Link>
                </div>
                <div className="divide-y divide-line">
                  {data.recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="size-1.5 rounded-full bg-accent shrink-0" />
                        <span className="text-fg truncate">{act.summary}</span>
                      </div>
                      <span className="text-[11px] text-faint tabular-nums shrink-0">
                        {act.actorName} ·{" "}
                        {new Date(act.createdAt).toLocaleString("fr-FR", {
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
          </div>
        )}
    </div>
  );
};
