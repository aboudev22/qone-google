import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  X,
} from "lucide-react";
import { QoneBrand } from "../../shared/components/QoneBrand";
import { companiesApi } from "../../shared/api/erp";
import { ERP_MODULES } from "../../shared/lib/modules";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABELS = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Collaborateur",
} as const;

export const AppLayout: React.FC = () => {
  const {
    user,
    companies,
    currentCompany,
    setCurrentCompany,
    refreshUser,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  const visibleModules = useMemo(() => {
    const enabled = currentCompany?.enabledModules;
    if (!enabled) return ERP_MODULES;
    return ERP_MODULES.filter(
      (mod) => !mod.optionalKey || enabled.includes(mod.optionalKey),
    );
  }, [currentCompany?.enabledModules]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setCreateError(null);
    setIsSubmittingCompany(true);
    try {
      const res = await companiesApi.create(newCompanyName.trim());
      setCurrentCompany(res.company);
      await refreshUser();
      setNewCompanyName("");
      setCreatingCompany(false);
      setSwitcherOpen(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de créer l'entreprise.";
      setCreateError(message);
    } finally {
      setIsSubmittingCompany(false);
    }
  };

  const companySelector = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setSwitcherOpen((prev) => !prev)}
        className="w-full p-3 border border-line bg-panel hover:border-line-strong transition-colors flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="size-8 border border-line bg-panel-raised flex items-center justify-center shrink-0">
            <Building2 size={15} className="text-muted" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-fg truncate">
              {currentCompany?.name || "Espace principal"}
            </p>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-faint">
              <span className="size-1 rounded-full bg-accent" />
              {currentCompany?.role
                ? ROLE_LABELS[currentCompany.role]
                : "Membre"}
            </span>
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted shrink-0 transition-transform ${
            switcherOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {switcherOpen && (
        <div className="mt-1 border border-line-strong bg-panel-raised p-1.5 space-y-1 z-50">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCurrentCompany(c);
                setSwitcherOpen(false);
                setMobileMenuOpen(false);
              }}
              className="w-full px-2.5 py-2 text-left text-xs flex items-center justify-between hover:bg-panel transition-colors"
            >
              <span className="truncate text-fg">{c.name}</span>
              {c.id === currentCompany?.id && (
                <Check size={13} className="text-accent shrink-0" />
              )}
            </button>
          ))}
          <div className="border-t border-line pt-1">
            <button
              type="button"
              onClick={() => {
                setCreatingCompany(true);
                setSwitcherOpen(false);
              }}
              className="w-full px-2.5 py-2 text-left text-xs text-muted hover:text-fg hover:bg-panel flex items-center gap-2 transition-colors"
            >
              <Plus size={13} />
              <span>Nouvelle entreprise</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col lg:flex-row">
      <header className="lg:hidden border-b border-line px-5 py-3.5 flex items-center justify-between bg-canvas/95 backdrop-blur sticky top-0 z-50">
        <QoneBrand />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 border border-line text-muted hover:text-fg focus:outline-none"
          aria-label="Ouvrir le menu"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-[61px] bg-canvas z-40 p-6 flex flex-col justify-between border-b border-line overflow-y-auto">
          <div className="space-y-6">
            {companySelector}

            <nav className="space-y-1">
              {visibleModules.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3.5 py-3 text-xs border transition-colors ${
                        isActive
                          ? "border-line-strong bg-panel text-fg font-medium"
                          : "border-transparent text-muted hover:text-fg hover:border-line"
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] text-faint tabular-nums">
                      {item.index}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-line pt-4 space-y-3">
            <div className="text-xs">
              <p className="text-fg font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-faint truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 border border-line py-2.5 text-xs text-muted hover:text-fg hover:border-line-strong transition-colors"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        </div>
      )}

      <aside className="hidden lg:flex w-64 border-r border-line bg-panel/30 flex-col justify-between shrink-0 h-screen sticky top-0">
        <div className="overflow-y-auto">
          <div className="p-6 border-b border-line">
            <QoneBrand />
          </div>

          <div className="p-4">{companySelector}</div>

          <nav className="px-3 space-y-1 mt-2">
            <p className="px-3 text-[10px] text-faint tracking-wider uppercase mb-2">
              Modules
            </p>
            {visibleModules.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `group flex items-center justify-between px-3 py-2.5 text-xs border transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-line-strong bg-panel text-fg font-medium"
                        : "border-transparent text-muted hover:text-fg hover:border-line"
                    }`
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={15} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-faint tabular-nums transition-colors group-hover:text-muted">
                    {item.index}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-line p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-medium text-fg truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-faint truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Déconnexion"
              aria-label="Déconnexion"
              className="p-2 text-muted hover:text-fg hover:bg-panel border border-transparent hover:border-line transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main
        key={currentCompany?.id || "none"}
        className="flex-1 min-w-0 overflow-y-auto"
      >
        <Outlet />
      </main>

      {creatingCompany && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-line-strong bg-panel p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">
                Créer un nouvel espace d'entreprise
              </h2>
              <button
                type="button"
                onClick={() => setCreatingCompany(false)}
                className="p-1 text-muted hover:text-fg"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="border border-line-strong bg-panel-raised p-3 text-xs text-fg">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label
                  htmlFor="new-company-name"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Nom de l'entreprise
                </label>
                <input
                  id="new-company-name"
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Studio Nord"
                  className="w-full bg-canvas border border-line px-3.5 py-2.5 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreatingCompany(false)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCompany}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSubmittingCompany ? "Création..." : "Créer l'espace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
