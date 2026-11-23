import { ArrowUpRight } from "lucide-react";

const qoneSteps = [
  {
    number: "01",
    title: "Créez l'espace de votre entreprise",
    description:
      "Inscrivez-vous et configurez l'espace de travail de votre entreprise sur qone.",
  },
  {
    number: "02",
    title: "Invitez votre équipe",
    description:
      "Ajoutez les personnes avec qui vous travaillez et attribuez à chacune les permissions adaptées.",
  },
  {
    number: "03",
    title: "Choisissez vos modules",
    description:
      "Activez les outils utiles à votre activité, comme le CRM ou la gestion des ventes.",
  },
  {
    number: "04",
    title: "Commencez à travailler",
    description:
      "Importez vos clients depuis Excel ou ajoutez-les directement, puis gérez votre activité dans qone.",
  },
];

export const GettingStarted = () => {
  return (
    <section
      id="demarrer"
      aria-labelledby="start-title"
      className="scroll-mt-24 border-t border-line pt-6"
    >
      <div className="grid gap-10 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12">
        <p className="text-[11px] text-faint">04 / Démarrage</p>

        <div>
          <h2
            id="start-title"
            className="text-2xl leading-tight font-medium tracking-[-0.03em] text-fg sm:text-3xl"
          >
            Par où commencer ?
          </h2>

          <ol className="mt-8 border-t border-line">
            {qoneSteps.map((step) => (
              <li
                key={step.number}
                className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line py-5"
              >
                <span
                  aria-hidden="true"
                  className="pt-0.5 text-[11px] text-faint"
                >
                  {step.number}
                </span>

                <div>
                  <h3 className="text-sm font-medium text-fg">{step.title}</h3>
                  <p className="mt-2 max-w-[58ch] text-[12.5px] leading-5 text-muted">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <a
            href="/register"
            className="group mt-8 inline-flex items-center gap-2 text-sm text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-fg"
          >
            Créer mon espace
            <ArrowUpRight
              aria-hidden="true"
              size={14}
              className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>
    </section>
  );
};
