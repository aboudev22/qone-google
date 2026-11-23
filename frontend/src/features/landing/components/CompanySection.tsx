import { Building2, User, ArrowUpRight } from "lucide-react";

export const CompanySection = () => {
  return (
    <section
      id="entreprise"
      aria-labelledby="company-mode-title"
      className="scroll-mt-24 border-t border-line pt-6"
    >
      <div className="grid gap-10 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12">
        <p className="text-[11px] text-faint">03 / Entreprise</p>

        <div>
          <h2
            id="company-mode-title"
            className="text-2xl leading-tight font-medium tracking-[-0.03em] text-fg sm:text-3xl"
          >
            Deux modes d'inscription adaptés à vos besoins.
          </h2>

          <p className="mt-4 max-w-[62ch] text-sm leading-6 text-muted">
            qone s'adapte à la structure de votre organisation. Que vous dirigiez une entreprise ou que vous rejoigniez une équipe en tant que collaborateur, l'accès est simple et sécurisé par email.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="border border-line bg-panel p-6 space-y-4">
              <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-accent">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-fg">Mode Entreprise</h3>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Idéal pour les fondateurs, gérants et administrateurs. Créez l'espace officiel de votre société, activez les modules (Projets, Stock, CRM, Ventes), invitez vos employés et pilotez l'activité.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/register"
                  className="inline-flex items-center gap-1.5 text-xs text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
                >
                  Créer un compte entreprise
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </div>

            <div className="border border-line bg-panel p-6 space-y-4">
              <div className="size-9 border border-line bg-panel-raised flex items-center justify-center text-fg">
                <User size={18} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-fg">Mode Particulier & Employé</h3>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Idéal pour les collaborateurs et intervenants indépendants. Créez votre compte personnel avec votre email, gérez vos tâches assignées et acceptez les invitations d'entreprises sur vos projets.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/register"
                  className="inline-flex items-center gap-1.5 text-xs text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
                >
                  Créer un compte particulier
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
