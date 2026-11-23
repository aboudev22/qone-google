import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  clientsApi,
  opportunitiesApi,
  type Client,
  type Opportunity,
  type OpportunityStage,
} from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const STAGES: Array<{ key: OpportunityStage; label: string }> = [
  { key: "prospecting", label: "Prospection" },
  { key: "qualification", label: "Qualification" },
  { key: "proposal", label: "Proposition" },
  { key: "negotiation", label: "Négociation" },
  { key: "won", label: "Gagné" },
  { key: "lost", label: "Perdu" },
];

const formatXaf = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;

export const SalesPage: React.FC = () => {
  const { currentCompany } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("0");
  const [probability, setProbability] = useState("40");
  const [stage, setStage] = useState<OpportunityStage>("prospecting");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [oppsRes, clientsRes] = await Promise.all([
        opportunitiesApi.list(),
        clientsApi.list(),
      ]);
      setOpportunities(oppsRes.opportunities);
      setClients(clientsRes.clients);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de charger le pipeline commercial.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);

  const metrics = useMemo(() => {
    const open = opportunities.filter(
      (o) => o.stage !== "won" && o.stage !== "lost",
    );
    const won = opportunities.filter((o) => o.stage === "won");
    const openTotal = open.reduce((sum, o) => sum + o.amount, 0);
    const weightedTotal = open.reduce(
      (sum, o) => sum + (o.amount * o.probability) / 100,
      0,
    );
    const wonTotal = won.reduce((sum, o) => sum + o.amount, 0);
    return {
      openCount: open.length,
      openTotal,
      weightedTotal,
      wonTotal,
    };
  }, [opportunities]);

  const openCreateModal = () => {
    setEditingOpp(null);
    setTitle("");
    setClientId(clients[0]?.id ?? "");
    setAmount("0");
    setProbability("50");
    setStage("prospecting");
    setExpectedCloseDate("");
    setNotes("");
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (opp: Opportunity) => {
    setEditingOpp(opp);
    setTitle(opp.title);
    setClientId(opp.clientId);
    setAmount(String(opp.amount));
    setProbability(String(opp.probability));
    setStage(opp.stage);
    setExpectedCloseDate(opp.expectedCloseDate);
    setNotes(opp.notes);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId) {
      setFormError("Veuillez renseigner un titre et sélectionner un client.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        clientId,
        title: title.trim(),
        amount: Number(amount) || 0,
        probability: Number(probability) || 0,
        stage,
        expectedCloseDate,
        notes,
      };
      if (editingOpp) {
        await opportunitiesApi.update(editingOpp.id, payload);
      } else {
        await opportunitiesApi.create(payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible d'enregistrer l'opportunité.";
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStageChange = async (opp: Opportunity, nextStage: OpportunityStage) => {
    try {
      const nextProb =
        nextStage === "won" ? 100 : nextStage === "lost" ? 0 : opp.probability;
      await opportunitiesApi.update(opp.id, {
        stage: nextStage,
        probability: nextProb,
      });
      await loadData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de déplacer l'opportunité.";
      setError(msg);
    }
  };

  const handleDelete = async (opp: Opportunity) => {
    try {
      await opportunitiesApi.remove(opp.id);
      await loadData();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de supprimer l'opportunité.";
      setError(msg);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            03 / Module Ventes
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Opportunités commerciales
          </h1>
          <p className="mt-1 text-xs text-muted">
            Suivez votre pipeline commercial pour {currentCompany?.name}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center border border-line bg-panel p-1">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`p-1.5 text-xs transition-colors ${
                viewMode === "board"
                  ? "bg-panel-raised text-fg"
                  : "text-muted hover:text-fg"
              }`}
              title="Vue pipeline"
              aria-label="Vue pipeline"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 text-xs transition-colors ${
                viewMode === "list"
                  ? "bg-panel-raised text-fg"
                  : "text-muted hover:text-fg"
              }`}
              title="Vue liste"
              aria-label="Vue liste"
            >
              <List size={14} />
            </button>
          </div>

          <button
            type="button"
            disabled={clients.length === 0}
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            <Plus size={13} />
            <span>Nouvelle opportunité</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-line bg-panel p-4">
          <span className="text-[11px] text-faint uppercase">Pipeline actif</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-medium text-fg tabular-nums">
              {formatXaf(metrics.openTotal)}
            </span>
            <span className="text-[11px] text-muted tabular-nums">
              {metrics.openCount} en cours
            </span>
          </div>
        </div>

        <div className="border border-line bg-panel p-4">
          <span className="text-[11px] text-faint uppercase">
            Prévision pondérée
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-medium text-fg tabular-nums">
              {formatXaf(metrics.weightedTotal)}
            </span>
            <span className="text-[11px] text-muted">Selon probabilité</span>
          </div>
        </div>

        <div className="border border-line bg-panel p-4">
          <span className="text-[11px] text-faint uppercase">
            Affaires gagnées
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-medium text-fg tabular-nums">
              {formatXaf(metrics.wonTotal)}
            </span>
            <span className="size-1.5 rounded-full bg-accent" />
          </div>
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
        <div className="border border-line bg-panel p-8 text-xs text-muted">
          Chargement des opportunités...
        </div>
      ) : clients.length === 0 ? (
        <div className="border border-line bg-panel p-12 text-center max-w-lg mx-auto">
          <div className="size-12 border border-line bg-panel-raised flex items-center justify-center text-muted mx-auto mb-4">
            <Briefcase size={22} />
          </div>
          <h3 className="text-sm font-medium text-fg">
            Ajoutez d'abord un client
          </h3>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Chaque opportunité commerciale est rattachée à un client de votre CRM. Créez ou importez un premier client pour démarrer votre pipeline.
          </p>
          <Link
            to="/app/clients"
            className="mt-6 inline-flex items-center gap-2 bg-fg px-4 py-2.5 text-xs font-medium text-canvas hover:bg-[#dedede]"
          >
            Aller aux clients
          </Link>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="border border-line bg-panel p-12 text-center max-w-lg mx-auto">
          <div className="size-12 border border-line bg-panel-raised flex items-center justify-center text-muted mx-auto mb-4">
            <Briefcase size={22} />
          </div>
          <h3 className="text-sm font-medium text-fg">
            Aucune opportunité enregistrée
          </h3>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Créez votre première opportunité commerciale pour suivre vos propositions, négociations et affaires conclues.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-6 inline-flex items-center gap-2 bg-fg px-4 py-2.5 text-xs font-medium text-canvas hover:bg-[#dedede]"
          >
            <Plus size={14} />
            Créer une opportunité
          </button>
        </div>
      ) : viewMode === "board" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {STAGES.map((col) => {
            const items = opportunities.filter((o) => o.stage === col.key);
            const colTotal = items.reduce((s, o) => s + o.amount, 0);
            return (
              <div
                key={col.key}
                className="border border-line bg-panel flex flex-col min-h-[220px]"
              >
                <div className="px-4 py-3 border-b border-line bg-panel-raised flex items-center justify-between text-xs">
                  <span className="font-medium text-fg">{col.label}</span>
                  <span className="text-[11px] text-faint tabular-nums">
                    {items.length} · {formatXaf(colTotal)}
                  </span>
                </div>

                <div className="p-3 space-y-3 flex-1">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-faint py-4 text-center">
                      Aucune affaire
                    </p>
                  ) : (
                    items.map((opp) => (
                      <div
                        key={opp.id}
                        className="border border-line bg-canvas p-3.5 space-y-2.5 hover:border-line-strong transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-fg truncate">
                              {opp.title}
                            </p>
                            <p className="text-[11px] text-muted truncate">
                              {opp.clientName}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(opp)}
                              className="p-1 text-muted hover:text-fg"
                              aria-label={`Modifier ${opp.title}`}
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(opp)}
                              className="p-1 text-muted hover:text-accent"
                              aria-label={`Supprimer ${opp.title}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-line">
                          <span className="text-fg font-medium tabular-nums">
                            {formatXaf(opp.amount)}
                          </span>
                          <span className="text-[11px] text-faint tabular-nums">
                            {opp.probability}%
                          </span>
                        </div>

                        <select
                          aria-label={`Étape pour ${opp.title}`}
                          value={opp.stage}
                          onChange={(e) =>
                            void handleStageChange(
                              opp,
                              e.target.value as OpportunityStage,
                            )
                          }
                          className="w-full bg-panel border border-line px-2 py-1.5 text-[11px] text-muted focus:border-fg focus:outline-none"
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-line bg-panel overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-panel-raised text-[11px] uppercase tracking-wider text-faint">
                <th className="py-3 px-4 font-medium">Opportunité</th>
                <th className="py-3 px-4 font-medium">Client</th>
                <th className="py-3 px-4 font-medium">Étape</th>
                <th className="py-3 px-4 font-medium text-right">Montant</th>
                <th className="py-3 px-4 font-medium text-right">Prob.</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {opportunities.map((opp) => (
                <tr key={opp.id} className="hover:bg-panel-raised/60">
                  <td className="py-3 px-4 font-medium text-fg">{opp.title}</td>
                  <td className="py-3 px-4 text-muted">{opp.clientName}</td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Étape pour ${opp.title}`}
                      value={opp.stage}
                      onChange={(e) =>
                        void handleStageChange(
                          opp,
                          e.target.value as OpportunityStage,
                        )
                      }
                      className="bg-canvas border border-line px-2 py-1 text-xs text-fg focus:border-fg focus:outline-none"
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-fg">
                    {formatXaf(opp.amount)}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-muted">
                    {opp.probability}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(opp)}
                        className="p-1.5 text-muted hover:text-fg"
                        aria-label={`Modifier ${opp.title}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(opp)}
                        className="p-1.5 text-muted hover:text-accent"
                        aria-label={`Supprimer ${opp.title}`}
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg border border-line-strong bg-panel p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">
                {editingOpp ? "Modifier l'opportunité" : "Nouvelle opportunité"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-muted hover:text-fg"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="border border-line-strong bg-panel-raised p-3 text-xs text-fg">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="opp-title"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Titre de l'affaire *
                </label>
                <input
                  id="opp-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contrat annuel CRM"
                  className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="opp-client"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Client associé *
                </label>
                <select
                  id="opp-client"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.companyName ? ` — ${c.companyName}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="opp-amount"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Montant (F CFA)
                  </label>
                  <input
                    id="opp-amount"
                    type="number"
                    min="0"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg tabular-nums focus:border-fg focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="opp-prob"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Probabilité (%)
                  </label>
                  <input
                    id="opp-prob"
                    type="number"
                    min="0"
                    max="100"
                    value={probability}
                    onChange={(e) => setProbability(e.target.value)}
                    className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg tabular-nums focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="opp-stage"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Étape
                  </label>
                  <select
                    id="opp-stage"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as OpportunityStage)}
                    className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="opp-date"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Clôture prévue
                  </label>
                  <input
                    id="opp-date"
                    type="date"
                    value={expectedCloseDate}
                    onChange={(e) => setExpectedCloseDate(e.target.value)}
                    className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg tabular-nums focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="opp-notes"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Notes
                </label>
                <textarea
                  id="opp-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Enregistrement..."
                    : editingOpp
                    ? "Mettre à jour"
                    : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
