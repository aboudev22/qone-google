import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Loader2, LogOut } from "lucide-react";
import { QoneBrand } from "../../shared/components/QoneBrand";
import type { Role } from "../../shared/api/auth";
import { useAuth } from "./AuthContext";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Collaborateur",
};

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

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || "";
  const {
    user,
    isAuthenticated,
    needsOnboarding,
    signInWithGoogle,
    createCompanyOnboarding,
    acceptInvitationToken,
    previewInvitation,
    logout,
  } = useAuth();

  const [invitationPreview, setInvitationPreview] = useState<{
    companyName: string;
    role: Role;
    email: string;
  } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [firstNameInput, setFirstNameInput] = useState<string | null>(null);
  const [lastNameInput, setLastNameInput] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Studio Qone");
  const [seedDemoData, setSeedDemoData] = useState(true);

  const firstName = firstNameInput ?? user?.firstName ?? "";
  const lastName = lastNameInput ?? user?.lastName ?? "";

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !inviteToken) return;
    let active = true;
    void previewInvitation(inviteToken)
      .then((inv) => {
        if (!active) return;
        setInvitationPreview({
          companyName: inv.companyName,
          role: inv.role,
          email: inv.email,
        });
        setInviteError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setInviteError(
          err instanceof Error
            ? err.message
            : "Invitation introuvable ou associée à un autre email.",
        );
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, inviteToken, previewInvitation]);

  useEffect(() => {
    if (isAuthenticated && !needsOnboarding && !inviteToken) {
      navigate("/app", { replace: true });
    }
  }, [isAuthenticated, needsOnboarding, inviteToken, navigate]);

  const handleGoogleConnect = async () => {
    setError(null);
    setInviteError(null);
    setIsSubmitting(true);
    try {
      const res = await signInWithGoogle();
      if (inviteToken) {
        await acceptInvitationToken(inviteToken);
        navigate("/app", { replace: true });
        return;
      }
      if (res.companies.length > 0) {
        navigate("/app", { replace: true });
      }
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code === "auth/popup-closed-by-user") {
        setError("Inscription Google annulée.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de continuer avec Google.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await acceptInvitationToken(inviteToken);
      navigate("/app", { replace: true });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'accepter cette invitation.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !companyName.trim()) {
      setError("Veuillez renseigner votre prénom et le nom de l'entreprise.");
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
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la création de l'espace.",
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
              ? `/login?invite=${encodeURIComponent(inviteToken)}`
              : "/login"
          }
          className="text-xs text-muted hover:text-fg transition-colors"
        >
          Connexion
        </Link>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_540px] max-w-[1440px] mx-auto w-full">
        <div className="hidden lg:flex flex-col justify-between p-12 border-r border-line bg-panel/30">
          <div>
            <QoneBrand />
            <div className="mt-20 max-w-md">
              <span className="text-[11px] text-faint tracking-wider">
                {inviteToken ? "INVITATION D'ÉQUIPE" : "ESPACE DE TRAVAIL UNIQUE"}
              </span>
              <h1 className="mt-4 text-3xl font-medium tracking-tight leading-snug">
                {invitationPreview
                  ? `Rejoignez l'espace ${invitationPreview.companyName} sur qone.`
                  : "Créez l'environnement opérationnel de votre entreprise."}
              </h1>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                Centralisez vos collaborateurs, vos contacts et vos flux dans un ERP modulaire persistant et fiable.
              </p>

              <div className="mt-12 space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="size-4 border border-line-strong flex items-center justify-center text-fg bg-panel">
                    <Check size={11} />
                  </span>
                  Isolation multi-entreprises native
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="size-4 border border-line-strong flex items-center justify-center text-fg bg-panel">
                    <Check size={11} />
                  </span>
                  Rôles d'équipe et permissions fines
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="size-4 border border-line-strong flex items-center justify-center text-fg bg-panel">
                    <Check size={11} />
                  </span>
                  Import de classeurs Excel & export CSV
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-faint">
            qone ERP — architecture modulaire
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-8">
              <p className="text-[11px] text-faint tracking-wider">INSCRIPTION</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">
                {invitationPreview
                  ? `Rejoindre ${invitationPreview.companyName}`
                  : isAuthenticated
                  ? "Configurer votre entreprise"
                  : "Créer un compte et votre espace"}
              </h2>
              <p className="mt-2 text-xs text-muted">
                {isAuthenticated ? (
                  <>
                    Connecté en tant que{" "}
                    <span className="text-fg">{user?.email}</span>.
                  </>
                ) : (
                  <>
                    Déjà inscrit ?{" "}
                    <Link
                      to={
                        inviteToken
                          ? `/login?invite=${encodeURIComponent(inviteToken)}`
                          : "/login"
                      }
                      className="text-fg underline decoration-line-strong hover:decoration-fg transition-colors"
                    >
                      Connectez-vous à votre espace
                    </Link>
                  </>
                )}
              </p>
            </div>

            {invitationPreview && (
              <div className="mb-6 border border-line-strong bg-panel p-4 text-xs text-muted space-y-1">
                <p className="text-fg font-medium">
                  Invitation pour {invitationPreview.companyName}
                </p>
                <p>
                  Rôle attribué :{" "}
                  <span className="text-fg">
                    {ROLE_LABELS[invitationPreview.role]}
                  </span>
                </p>
              </div>
            )}

            {(error || inviteError) && (
              <div
                role="alert"
                className="mb-6 border border-line-strong bg-panel p-4 text-xs text-fg flex items-start gap-3"
              >
                <span className="size-2 mt-1 rounded-full bg-accent shrink-0" />
                <span>{error || inviteError}</span>
              </div>
            )}

            {!isAuthenticated ? (
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleGoogleConnect}
                  className="group relative w-full flex items-center justify-center gap-3 bg-fg px-5 py-3.5 text-xs font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Connexion avec Google...
                    </>
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>
                        {inviteToken
                          ? "Accepter avec Google"
                          : "Créer mon espace avec Google"}
                      </span>
                      <ArrowRight
                        size={14}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </>
                  )}
                </button>
                <p className="text-[10px] text-faint text-center pt-1">
                  {inviteToken
                    ? "Connectez-vous avec l'adresse Google invitée pour rejoindre cet espace."
                    : "Vous nommerez votre entreprise juste après la connexion Google."}
                </p>
              </div>
            ) : invitationPreview ? (
              <div className="space-y-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleAcceptInvite}
                  className="group relative w-full flex items-center justify-center gap-2 bg-fg px-5 py-3 text-xs font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Validation...
                    </>
                  ) : (
                    <>
                      Rejoindre {invitationPreview.companyName}
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
                  className="w-full flex items-center justify-center gap-2 border border-line py-2.5 text-xs text-muted hover:text-fg"
                >
                  <LogOut size={13} />
                  Changer de compte Google
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                    >
                      Prénom *
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstNameInput(e.target.value)}
                      placeholder="Alex"
                      className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                    >
                      Nom
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastNameInput(e.target.value)}
                      placeholder="Dubois"
                      className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Nom de l'entreprise *
                  </label>
                  <input
                    id="companyName"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Studio"
                    className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
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
                    Pré-remplir avec 4 clients et 4 opportunités d'exemple pour tester immédiatement
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
                        Création de votre espace...
                      </>
                    ) : (
                      <>
                        Créer mon entreprise sur qone
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
                    className="w-full flex items-center justify-center gap-2 border border-line py-2.5 text-xs text-muted hover:text-fg"
                  >
                    <LogOut size={13} />
                    Changer de compte Google
                  </button>
                </div>
              </form>
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
