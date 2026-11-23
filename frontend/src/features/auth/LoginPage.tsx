import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Loader2, LogOut } from "lucide-react";
import { QoneBrand } from "../../shared/components/QoneBrand";
import { useAuth } from "./AuthContext";

const GoogleIcon: React.FC = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
    <path
      fill="currentColor"
      d="M21.35 11.1H12v3.7h5.35c-.25 1.35-1.05 2.5-2.25 3.25v2.7h3.65c2.15-1.95 3.4-4.85 3.4-8.3 0-.45-.05-.9-.1-1.35z"
    />
    <path
      fill="currentColor"
      d="M12 22c3.05 0 5.6-1 7.45-2.75l-3.65-2.7c-1 .7-2.3 1.1-3.8 1.1-2.95 0-5.45-2-6.35-4.65H1.9v2.8C3.75 19.5 7.6 22 12 22z"
    />
    <path
      fill="currentColor"
      d="M5.65 13c-.2-.65-.35-1.3-.35-2s.15-1.35.35-2V6.2H1.9C1.15 7.65.75 9.3.75 11s.4 3.35 1.15 4.8l3.75-2.8z"
    />
    <path
      fill="currentColor"
      d="M12 4.35c1.65 0 3.15.55 4.35 1.7l3.25-3.25C17.6.95 15.05 0 12 0 7.6 0 3.75 2.5 1.9 6.2l3.75 2.8C6.55 6.35 9.05 4.35 12 4.35z"
    />
  </svg>
);

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || undefined;
  const {
    user,
    isAuthenticated,
    needsOnboarding,
    signInWithGoogle,
    createCompanyOnboarding,
    acceptInvitationToken,
    logout,
  } = useAuth();

  const [companyName, setCompanyName] = useState("Studio Qone");
  const [firstNameInput, setFirstNameInput] = useState<string | null>(null);
  const [lastNameInput, setLastNameInput] = useState<string | null>(null);
  const [seedDemoData, setSeedDemoData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstName = firstNameInput ?? user?.firstName ?? "";
  const lastName = lastNameInput ?? user?.lastName ?? "";

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    "/app";

  useEffect(() => {
    if (isAuthenticated && !needsOnboarding) {
      if (inviteToken) {
        void acceptInvitationToken(inviteToken)
          .then(() => navigate("/app", { replace: true }))
          .catch(() => navigate(from, { replace: true }));
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [
    isAuthenticated,
    needsOnboarding,
    inviteToken,
    acceptInvitationToken,
    navigate,
    from,
  ]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await signInWithGoogle();
      if (inviteToken) {
        try {
          await acceptInvitationToken(inviteToken);
          navigate("/app", { replace: true });
          return;
        } catch (inviteErr: unknown) {
          const msg =
            inviteErr instanceof Error
              ? inviteErr.message
              : "Impossible de valider cette invitation avec ce compte Google.";
          setError(msg);
          return;
        }
      }
      if (res.companies.length > 0) {
        navigate(from, { replace: true });
      }
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/popup-closed-by-user") {
        setError("Connexion Google annulée.");
      } else {
        const message =
          err instanceof Error
            ? err.message
            : "Impossible de finaliser la connexion Google.";
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError("Veuillez saisir le nom de votre entreprise.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createCompanyOnboarding({
        companyName,
        firstName,
        lastName,
        seedDemoData,
      });
      navigate("/app", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de créer votre espace d'entreprise.";
      setError(message);
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
          Créer un espace
        </Link>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_540px] max-w-[1440px] mx-auto w-full">
        <div className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-panel/30">
          <div>
            <QoneBrand />
            <div className="mt-20 max-w-md">
              <span className="text-[11px] text-faint tracking-wider">
                {needsOnboarding ? "PREMIER ESPACE" : "CONNEXION À L'ESPACE"}
              </span>
              <h1 className="mt-4 text-3xl font-medium tracking-tight leading-snug">
                {needsOnboarding
                  ? "Finalisez la création de votre espace qone."
                  : "Retrouvez l'ensemble de vos opérations d'entreprise."}
              </h1>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                {needsOnboarding
                  ? "Votre compte Google est connecté. Nommez votre entreprise pour centraliser vos clients, opportunités et actions."
                  : "Connectez-vous avec Google pour retrouver vos clients, vos imports Excel, votre pipeline et votre historique d'actions."}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-faint">
            qone ERP — gestion modulaire des opérations
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-8">
              <p className="text-[11px] text-faint tracking-wider">
                {needsOnboarding ? "CONFIGURATION INITIALE" : "CONNEXION"}
              </p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">
                {needsOnboarding
                  ? "Nommer votre entreprise"
                  : "Accéder à votre compte"}
              </h2>
              <p className="mt-2 text-xs text-muted">
                {needsOnboarding ? (
                  <>
                    Connecté en tant que{" "}
                    <span className="text-fg">{user?.email}</span>.
                  </>
                ) : (
                  <>
                    Nouveau sur qone ?{" "}
                    <Link
                      to={
                        inviteToken
                          ? `/register?invite=${encodeURIComponent(inviteToken)}`
                          : "/register"
                      }
                      className="text-fg underline decoration-line-strong hover:decoration-fg transition-colors"
                    >
                      Créer un nouvel espace
                    </Link>
                  </>
                )}
              </p>
            </div>

            {inviteToken && (
              <div className="mb-6 border border-line-strong bg-panel p-4 text-xs text-muted">
                <p className="text-fg font-medium">Invitation détectée</p>
                <p className="mt-1">
                  Connectez-vous avec l'adresse Google invitée pour rejoindre automatiquement l'espace d'entreprise.
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

            {needsOnboarding ? (
              <form onSubmit={handleCreateSpace} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="onboard-first"
                      className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                    >
                      Prénom
                    </label>
                    <input
                      id="onboard-first"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstNameInput(e.target.value)}
                      className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg focus:border-fg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="onboard-last"
                      className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                    >
                      Nom
                    </label>
                    <input
                      id="onboard-last"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastNameInput(e.target.value)}
                      className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg focus:border-fg focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="onboard-company"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Nom de l'entreprise *
                  </label>
                  <input
                    id="onboard-company"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Studio Qone"
                    className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-muted pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedDemoData}
                    onChange={(e) => setSeedDemoData(e.target.checked)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    Pré-remplir avec 4 clients et 4 opportunités d'exemple modifiables
                  </span>
                </label>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative w-full flex items-center justify-center gap-2 bg-fg px-5 py-3 text-xs font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Création de l'espace...
                      </>
                    ) : (
                      <>
                        Ouvrir mon espace qone
                        <ArrowRight
                          size={14}
                          className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="w-full flex items-center justify-center gap-2 border border-line py-2.5 text-xs text-muted hover:text-fg hover:border-line-strong transition-colors"
                  >
                    <LogOut size={13} />
                    Changer de compte Google
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGoogleSignIn}
                  className="group relative w-full flex items-center justify-center gap-3 bg-fg px-5 py-3.5 text-xs font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continuer avec Google</span>
                      <ArrowRight
                        size={14}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-faint leading-relaxed">
                  Si vous avez déjà créé un espace sur qone, vous retrouverez immédiatement vos clients, opportunités et l'historique complet de vos actions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-line px-6 py-4 text-center text-[11px] text-faint">
        © 2026 qone — Tous droits réservés
      </footer>
    </div>
  );
};
