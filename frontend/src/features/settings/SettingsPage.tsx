import React, { useState } from "react";
import { Building2, Check, Layers } from "lucide-react";
import type { ModuleKey } from "../../shared/api/auth";
import { companiesApi } from "../../shared/api/erp";
import { OPTIONAL_MODULES } from "../../shared/lib/modules";
import { useAuth } from "../auth/AuthContext";

export const SettingsPage: React.FC = () => {
  const { currentCompany, refreshUser } = useAuth();
  const [name, setName] = useState(currentCompany?.name ?? "");
  const [slug, setSlug] = useState(currentCompany?.slug ?? "");
  const [enabledModules, setEnabledModules] = useState<ModuleKey[]>(
    currentCompany?.enabledModules ?? ["crm", "sales"],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit =
    currentCompany?.role === "owner" || currentCompany?.role === "admin";

  const toggleModule = (key: ModuleKey) => {
    if (!canEdit) return;
    setEnabledModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      const res = await companiesApi.updateCurrent({
        name,
        slug,
        enabledModules,
      });
      setName(res.company.name);
      setSlug(res.company.slug);
      await refreshUser();
      setMessage("Paramètres de l'entreprise enregistrés.");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de mettre à jour les paramètres.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="border-b border-line pb-6">
        <div className="text-[11px] text-faint uppercase tracking-wider">
          05 / Configuration
        </div>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          Paramètres de l'entreprise
        </h1>
        <p className="mt-1 text-xs text-muted">
          Configurez le profil de {currentCompany?.name} et les modules activés.
        </p>
      </div>

      <form onSubmit={handleSave} className="max-w-2xl space-y-6">
        {error && (
          <div
            role="alert"
            className="border border-line-strong bg-panel p-4 text-xs text-fg"
          >
            {error}
          </div>
        )}
        {message && (
          <div className="border border-line-strong bg-panel p-4 text-xs text-fg flex items-center gap-2">
            <Check size={14} className="text-accent" />
            <span>{message}</span>
          </div>
        )}

        <div className="border border-line bg-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Building2 size={16} className="text-muted" />
            <h2 className="text-xs font-medium uppercase tracking-wider text-fg">
              Profil de l'entreprise
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="company-name"
                className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
              >
                Nom officiel
              </label>
              <input
                id="company-name"
                type="text"
                readOnly={!canEdit}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none read-only:text-muted"
              />
            </div>

            <div>
              <label
                htmlFor="company-slug"
                className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
              >
                Identifiant / Slug
              </label>
              <input
                id="company-slug"
                type="text"
                readOnly={!canEdit}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none read-only:text-muted"
              />
            </div>
          </div>
        </div>

        <div className="border border-line bg-panel p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Layers size={16} className="text-muted" />
            <h2 className="text-xs font-medium uppercase tracking-wider text-fg">
              Modules activés
            </h2>
          </div>

          <div className="divide-y divide-line">
            {OPTIONAL_MODULES.map((mod) => {
              const active = enabledModules.includes(mod.key);
              return (
                <div
                  key={mod.key}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-medium text-fg">{mod.label}</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {mod.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleModule(mod.key)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 text-xs border transition-colors whitespace-nowrap disabled:opacity-50 ${
                      active
                        ? "border-fg bg-fg text-canvas font-medium"
                        : "border-line bg-canvas text-muted hover:text-fg"
                    }`}
                  >
                    {active ? "Activé" : "Désactivé"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-faint">
            Seuls les administrateurs et propriétaires peuvent modifier ces paramètres.
          </p>
        )}
      </form>
    </div>
  );
};
