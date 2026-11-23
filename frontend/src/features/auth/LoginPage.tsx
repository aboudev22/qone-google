import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, Loader2, User } from "lucide-react";
import { QoneBrand } from "../../shared/components/QoneBrand";
import type { AccountType } from "../../shared/api/auth";
import { useAuth } from "./AuthContext";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || undefined;
  const { isAuthenticated, login } = useAuth();

  const [mode, setMode] = useState<AccountType>("company");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    "/app";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password, mode, inviteToken });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Email ou mot de passe incorrect.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col justify-between">
      <header className="border-b border-line px-6 py-4 flex items-center justify-between lg:hidden">
        <QoneBrand />
        <Link
          to={
            inviteToken
              ? `/register?invite=${encodeURIComponent(inviteToken)}`
              : "/register"
          }
          className="text-xs text-muted hover:text-fg transition-colors"
        >
          Créer un compte
        </Link>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_540px] max-w-[1440px] mx-auto w-full">
        <div className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-panel/30">
          <div>
            <QoneBrand />
            <div className="mt-20 max-w-md">
              <span className="text-[11px] text-faint tracking-wider">
                {mode === "company" ? "ESPACE ENTREPRISE" : "ESPACE PARTICULIER & EMPLOYÉ"}
              </span>
              <h1 className="mt-4 text-3xl font-medium tracking-tight leading-snug">
                {mode === "company"
                  ? "Pilotez vos équipes, projets et stocks depuis un seul espace."
                  : "Accédez à votre espace personnel et aux projets d'entreprise."}
              </h1>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                {mode === "company"
                  ? "Connectez-vous avec votre email professionnel pour retrouver vos employés, projets, stock, clients et journaux d'activité."
                  : "Connectez-vous avec votre email pour gérer vos tâches assignées, accepter les invitations d'entreprises et collaborer sur les projets."}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-faint">
            qone ERP — connexion sécurisée par email
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-6">
              <p className="text-[11px] text-faint tracking-wider">CONNEXION</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">
                Accéder à votre compte
              </h2>
              <p className="mt-2 text-xs text-muted">
                Pas encore de compte ?{" "}
                <Link
                  to={
                    inviteToken
                      ? `/register?invite=${encodeURIComponent(inviteToken)}`
                      : "/register"
                  }
                  className="text-fg underline decoration-line-strong hover:decoration-fg transition-colors"
                >
                  Créer un compte Entreprise ou Particulier
                </Link>
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 border border-line bg-panel p-1 gap-1">
              <button
                type="button"
                onClick={() => {
                  setMode("company");
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 text-xs transition-colors ${
                  mode === "company"
                    ? "bg-fg text-canvas font-medium"
                    : "text-muted hover:text-fg"
                }`}
              >
                <Building2 size={14} />
                <span>Entreprise</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("individual");
                  setError(null);
                }}
                className={`flex items-center justify-center gap-2 py-2.5 text-xs transition-colors ${
                  mode === "individual"
                    ? "bg-fg text-canvas font-medium"
                    : "text-muted hover:text-fg"
                }`}
              >
                <User size={14} />
                <span>Particulier</span>
              </button>
            </div>

            {inviteToken && (
              <div className="mb-6 border border-line-strong bg-panel p-4 text-xs text-muted">
                <p className="text-fg font-medium">Invitation détectée</p>
                <p className="mt-1">
                  Connectez-vous avec l'adresse invitée pour rejoindre automatiquement l'espace.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-6 border border-line-strong bg-panel p-4 text-xs text-fg flex items-start gap-3"
              >
                <span className="size-2 mt-1 rounded-full bg-accent shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Adresse email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    mode === "company" ? "contact@entreprise.com" : "prenom@email.com"
                  }
                  className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Mot de passe
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full flex items-center justify-center gap-2 bg-fg px-5 py-3 text-xs font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    {mode === "company"
                      ? "Connexion Entreprise"
                      : "Connexion Particulier"}
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="border-t border-line px-6 py-4 text-center text-[11px] text-faint">
        © 2026 qone — Tous droits réservés
      </footer>
    </div>
  );
};
