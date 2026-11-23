import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, Check, Loader2, Sparkles, User, Users, Briefcase } from "lucide-react";
import { QoneBrand } from "../../shared/components/QoneBrand";
import {
  authApi,
  type AccountType,
  type InvitationPreview,
  type Role,
} from "../../shared/api/auth";
import { useAuth } from "./AuthContext";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Collaborateur",
};

const SECTORS = [
  "Technologie & Logiciel",
  "E-commerce & Retail",
  "Conseil & Services",
  "BTP & Industrie",
  "Santé & Pharmacie",
  "Autre",
];

const SIZES = [
  "1 - 5 employés",
  "6 - 20 employés",
  "21 - 50 employés",
  "50+ employés",
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || "";
  const { isAuthenticated, register } = useAuth();

  const [invitationPreview, setInvitationPreview] =
    useState<InvitationPreview | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [accountType, setAccountType] = useState<AccountType>("company");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Onboarding wizard states
  const [step, setStep] = useState<"form" | "customizing" | "animating">("form");
  const [sector, setSector] = useState(SECTORS[0]);
  const [teamSize, setTeamSize] = useState(SIZES[0]);
  const [animProgress, setAnimProgress] = useState(0);
  const [animMessage, setAnimMessage] = useState("Initialisation de l'espace...");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !inviteToken && step === "form") {
      navigate("/app", { replace: true });
    }
  }, [isAuthenticated, inviteToken, navigate, step]);

  useEffect(() => {
    if (!inviteToken) return;
    let active = true;
    void authApi
      .getInvitation(inviteToken)
      .then((res) => {
        if (!active) return;
        setInvitationPreview(res.invitation);
        setAccountType("individual");
        setEmail(res.invitation.email);
        if (res.invitation.firstName) setFirstName(res.invitation.firstName);
        if (res.invitation.lastName) setLastName(res.invitation.lastName);
        setInviteError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setInviteError(
          err instanceof Error
            ? err.message
            : "Invitation invalide ou expirée.",
        );
      });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !firstName.trim() ||
      (!inviteToken && accountType === "company" && !companyName.trim()) ||
      !email.trim() ||
      password.length < 8
    ) {
      setError(
        "Veuillez remplir les champs obligatoires avec un mot de passe d'au moins 8 caractères.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        accountType: inviteToken ? "individual" : accountType,
        companyName:
          !inviteToken && accountType === "company" ? companyName.trim() : undefined,
        jobTitle: jobTitle.trim() || undefined,
        inviteToken: inviteToken || undefined,
      });

      // If invite token, skip customization and go straight to app
      if (inviteToken || accountType === "individual") {
        navigate("/app", { replace: true });
      } else {
        // Show customization onboarding questions for company
        setStep("customizing");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de créer le compte.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartCustomization = () => {
    setStep("animating");
    setAnimProgress(20);
    setAnimMessage(`Configuration du secteur ${sector}...`);

    setTimeout(() => {
      setAnimProgress(60);
      setAnimMessage(`Préparation des modules pour ${teamSize}...`);
    }, 900);

    setTimeout(() => {
      setAnimProgress(90);
      setAnimMessage("Synchronisation de l'espace personnalisé...");
    }, 1800);

    setTimeout(() => {
      setAnimProgress(100);
      setAnimMessage("Votre espace est prêt !");
    }, 2600);

    setTimeout(() => {
      navigate("/app", { replace: true });
    }, 3200);
  };

  if (step === "customizing") {
    return (
      <div className="min-h-screen bg-canvas text-fg flex flex-col justify-between">
        <header className="border-b border-line px-6 py-4 flex items-center justify-between">
          <QoneBrand />
          <span className="text-xs text-muted">Personnalisation (1/2)</span>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg bg-panel border border-line p-8 space-y-6">
            <div className="flex items-center gap-3 text-accent">
              <Sparkles size={20} />
              <span className="text-xs font-mono uppercase tracking-wider">Configuration de l'espace</span>
            </div>

            <div>
              <h2 className="text-2xl font-medium tracking-tight">Personnalisons votre expérience qone</h2>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Ces 2 brèves informations nous permettent d'adapter les tableaux de bord et les indicateurs pour <span className="text-fg font-medium">{companyName || "votre entreprise"}</span>.
              </p>
            </div>

            <div className="space-y-5 pt-2">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                  <Briefcase size={13} /> Secteur d'activité principal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SECTORS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSector(s)}
                      className={`px-3.5 py-3 text-xs text-left border transition-colors ${
                        sector === s
                          ? "border-fg bg-fg text-canvas font-medium"
                          : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                  <Users size={13} /> Nombre d'employés dans l'équipe
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setTeamSize(sz)}
                      className={`px-3.5 py-3 text-xs text-left border transition-colors ${
                        teamSize === sz
                          ? "border-fg bg-fg text-canvas font-medium"
                          : "border-line bg-canvas text-muted hover:text-fg hover:border-line-strong"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartCustomization}
              className="w-full flex items-center justify-center gap-2 bg-fg px-5 py-3.5 text-xs font-medium text-canvas transition-colors duration-300 hover:bg-[#dedede] mt-6"
            >
              <span>Générer mon espace personnalisé</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <footer className="border-t border-line px-6 py-4 text-center text-[11px] text-faint">
          © 2026 qone — Personnalisation intelligente
        </footer>
      </div>
    );
  }

  if (step === "animating") {
    return (
      <div className="min-h-screen bg-canvas text-fg flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md bg-panel border border-line p-10 text-center space-y-8">
          {/* Animated SVG Loader */}
          <div className="size-24 mx-auto flex items-center justify-center">
            <svg
              className="size-24"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 200 200"
            >
              <g fill="#d4d4d8" stroke="#d4d4d8" strokeWidth="15">
                <rect width="30" height="30" x="125" y="45">
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    calcMode="spline"
                    dur="0.4s"
                    values="0 0;0 80;0 80;0 80;-80 80;"
                    keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1"
                    repeatCount="indefinite"
                  />
                </rect>
                <rect width="30" height="30" x="45" y="45">
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    calcMode="spline"
                    dur="0.4s"
                    values="0 0;0 0;80 0;80 0;80 0;"
                    keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1"
                    repeatCount="indefinite"
                  />
                </rect>
                <rect width="30" height="30" x="45" y="125">
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    calcMode="spline"
                    dur="0.4s"
                    values="0 0;0 0 ;0 0;0 -80;0 -80;"
                    keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1"
                    repeatCount="indefinite"
                  />
                </rect>
              </g>
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-medium tracking-tight">Création de votre application sur-mesure</h2>
            <p className="text-xs text-muted font-mono">{animMessage}</p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-canvas border border-line h-2 overflow-hidden">
            <div
              className="bg-fg h-full transition-all duration-500 ease-out"
              style={{ width: `${animProgress}%` }}
            />
          </div>

          <div className="text-[11px] text-faint">
            Secteur : <span className="text-muted">{sector}</span> • Équipe : <span className="text-muted">{teamSize}</span>
          </div>
        </div>
      </div>
    );
  }

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
                {inviteToken
                  ? "INVITATION D'ÉQUIPE"
                  : accountType === "company"
                  ? "COMPTE ENTREPRISE"
                  : "COMPTE PARTICULIER & EMPLOYÉ"}
              </span>
              <h1 className="mt-4 text-3xl font-medium tracking-tight leading-snug">
                {invitationPreview
                  ? `Rejoignez l'espace ${invitationPreview.companyName} sur qone.`
                  : accountType === "company"
                  ? "Créez l'environnement opérationnel de votre entreprise."
                  : "Créez votre compte employé ou particulier."}
              </h1>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                {accountType === "company"
                  ? "Invitez vos employés par adresse email, créez des projets, assignez des tâches, gérez vos stocks et tracez chaque action."
                  : "Inscrivez-vous en quelques secondes avec votre email. Une entreprise pourra vous retrouver par votre nom ou email et vous inviter sur ses projets."}
              </p>

              <div className="mt-12 space-y-3">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="size-4 border border-line-strong flex items-center justify-center text-fg bg-panel">
                    <Check size={11} />
                  </span>
                  Projets, collaborateurs & assignation des tâches
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="size-4 border border-line-strong flex items-center justify-center text-fg bg-panel">
                    <Check size={11} />
                  </span>
                  Gestion de stock avec mouvements & alertes
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="size-4 border border-line-strong flex items-center justify-center text-fg bg-panel">
                    <Check size={11} />
                  </span>
                  Journal d'audit complet de toutes les actions
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-faint">
            qone ERP — persistance SQLite / Cloudflare D1
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-md mx-auto">
            <div className="mb-6">
              <p className="text-[11px] text-faint tracking-wider">INSCRIPTION</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">
                {invitationPreview
                  ? `Rejoindre ${invitationPreview.companyName}`
                  : "Créer un compte"}
              </h2>
              <p className="mt-2 text-xs text-muted">
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
              </p>
            </div>

            {!inviteToken && (
              <div className="mb-6 grid grid-cols-2 border border-line bg-panel p-1 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType("company");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 text-xs transition-colors ${
                    accountType === "company"
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
                    setAccountType("individual");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 text-xs transition-colors ${
                    accountType === "individual"
                      ? "bg-fg text-canvas font-medium"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  <User size={14} />
                  <span>Particulier / Employé</span>
                </button>
              </div>
            )}

            {invitationPreview && (
              <div className="mb-6 border border-line-strong bg-panel p-4 text-xs text-muted space-y-1">
                <p className="text-fg font-medium">
                  Invitation pour {invitationPreview.companyName}
                </p>
                {invitationPreview.projectName && (
                  <p>
                    Projet inclus :{" "}
                    <span className="text-fg">{invitationPreview.projectName}</span>
                  </p>
                )}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="reg-firstName"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Prénom *
                  </label>
                  <input
                    id="reg-firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reg-lastName"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Nom
                  </label>
                  <input
                    id="reg-lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dubois"
                    className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {!inviteToken && accountType === "company" && (
                <div>
                  <label
                    htmlFor="reg-companyName"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Nom de l'entreprise *
                  </label>
                  <input
                    id="reg-companyName"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Studio Qone"
                    className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                  />
                </div>
              )}

              {!inviteToken && accountType === "individual" && (
                <div>
                  <label
                    htmlFor="reg-jobTitle"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Poste / Spécialité (optionnel)
                  </label>
                  <input
                    id="reg-jobTitle"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Développeur, Gestionnaire stock, Commercial..."
                    className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Adresse email *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@entreprise.com"
                  className="w-full bg-panel border border-line px-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Mot de passe (8 caractères minimum) *
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
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
                    Création du compte...
                  </>
                ) : (
                  <>
                    {inviteToken
                      ? "Créer mon compte et rejoindre"
                      : accountType === "company"
                      ? "Créer mon espace entreprise"
                      : "Créer mon compte particulier"}
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

