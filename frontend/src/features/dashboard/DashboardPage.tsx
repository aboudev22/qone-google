import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import { companiesApi, type CompanySummaryResponse } from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const formatEuro = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);

export const DashboardPage: React.FC = () => {
  const { user, currentCompany } = useAuth();
  const [data, setData] = useState<CompanySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Impossible de charger les indicateurs.";
        setError(msg);
      } finally {
        if (active) setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [currentCompany]);

  const summary = data?.summary;
  const completedSteps =
    (summary && summary.membersCount > 1 ? 1 : 0) +
    (summary && summary.clientsCount > 0 ? 1 : 0) +
    (summary && summary.opportunitiesCount > 0 ? 1 : 0);

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-10">
      <div className="border-b border-line pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-faint tracking-wider">
              <span className="size-1.5 rounded-full bg-accent" />
              <span>Espace actif · {currentCompany?.name}</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-medium tracking-tight">
              Bonjour, {user?.firstName}.
            </h1>
            <p className="mt-1 text-xs text-muted">
              Vue d'ensemble de vos opérations, de votre équipe et de votre activité commerciale.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/app/clients"
              className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <span>Gérer les clients</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-line-strong bg-panel p-4 text-xs text-fg">
          {error}
        </div>
      )}

      <div>
        <p className="text-[11px] text-faint uppercase tracking-wider mb-4">
          Indicateurs clés
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Collaborateurs</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : summary?.membersCount ?? 1}
              </span>
              <span className="text-[11px] text-muted">
                {currentCompany?.role === "owner"
                  ? "Propriétaire"
                  : currentCompany?.role === "admin"
                  ? "Admin"
                  : "Membre"}
              </span>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Clients</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : summary?.clientsCount ?? 0}
              </span>
              <span className="text-[11px] text-muted tabular-nums">
                {isLoading ? "" : `${summary?.activeClientsCount ?? 0} actifs`}
              </span>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Pipeline en cours</span>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : formatEuro(summary?.pipelineValue ?? 0)}
              </span>
              <span className="text-[11px] text-muted tabular-nums">
                {isLoading ? "" : `${summary?.openOpportunitiesCount ?? 0} deals`}
              </span>
            </div>
          </div>

          <div className="border border-line bg-panel p-5">
            <span className="text-[11px] text-faint uppercase">Ventes gagnées</span>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-medium text-fg tabular-nums">
                {isLoading ? "—" : formatEuro(summary?.wonValue ?? 0)}
              </span>
              <span className="size-1.5 rounded-full bg-accent shrink-0" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between border-t border-line pt-6 mb-4">
          <p className="text-[11px] text-faint uppercase tracking-wider">
            Mise en place de l'espace
          </p>
          <span className="text-[11px] text-faint tabular-nums">
            {completedSteps} sur 3 complétées
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-line bg-panel p-6 flex flex-col justify-between hover:border-line-strong transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-muted">
                  <Users size={17} />
                </div>
                {summary && summary.membersCount > 1 && (
                  <span className="size-5 border border-line-strong flex items-center justify-center text-accent">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-sm font-medium text-fg">
                Inviter votre équipe
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Ajoutez vos collègues et attribuez les rôles d'administrateur ou de collaborateur.
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
              <div className="flex items-center justify-between">
                <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-muted">
                  <FileSpreadsheet size={17} />
                </div>
                {summary && summary.clientsCount > 0 && (
                  <span className="size-5 border border-line-strong flex items-center justify-center text-accent">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-sm font-medium text-fg">
                Importer ou créer vos clients
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Chargez un classeur Excel (.xlsx) avec aperçu et mapping ou saisissez vos fiches clients.
              </p>
            </div>
            <Link
              to="/app/clients"
              className="mt-6 inline-flex items-center gap-2 text-xs text-fg hover:underline underline-offset-4"
            >
              Ouvrir le module CRM
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="border border-line bg-panel p-6 flex flex-col justify-between hover:border-line-strong transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-muted">
                  <Briefcase size={17} />
                </div>
                {summary && summary.opportunitiesCount > 0 && (
                  <span className="size-5 border border-line-strong flex items-center justify-center text-accent">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-sm font-medium text-fg">
                Suivre vos opportunités
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Pilotez votre pipeline de ventes étape par étape et suivez le chiffre d'affaires prévisionnel.
              </p>
            </div>
            <Link
              to="/app/sales"
              className="mt-6 inline-flex items-center gap-2 text-xs text-fg hover:underline underline-offset-4"
            >
              Accéder aux ventes
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {data &&
        (data.recentClients.length > 0 ||
          data.recentOpportunities.length > 0 ||
          data.recentActivities.length > 0) && (
          <div className="space-y-6 border-t border-line pt-6">
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
                          {formatEuro(opp.amount)}
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
                    Historique des actions récentes
                  </span>
                  <span className="text-[11px] text-faint">
                    Dernières actions de l'équipe
                  </span>
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
