import { ArrowDown } from "lucide-react";
import { FeatCard } from "./FeatCard";
import {
  AccessIllustration,
  ImportIllustration,
  PipelineIllustration,
  WorkspaceIllustration,
} from "./FeatureIllustration";
import { ShimBtn } from "./ShimBtn";

const features = [
  {
    index: "01",
    title: "Votre entreprise, votre espace",
    description:
      "Créez votre espace de travail et réunissez vos collègues au même endroit.",
    illustration: <WorkspaceIllustration />,
  },
  {
    index: "02",
    title: "Des accès maîtrisés",
    description:
      "Invitez votre équipe et attribuez à chacun les rôles et permissions adaptés.",
    illustration: <AccessIllustration />,
  },
  {
    index: "03",
    title: "Clients et ventes réunis",
    description:
      "Suivez vos clients, contacts et opportunités commerciales depuis un seul outil.",
    illustration: <PipelineIllustration />,
  },
  {
    index: "04",
    title: "Import Excel, export CSV",
    description:
      "Importez vos clients depuis Excel et exportez vos données en CSV en quelques étapes.",
    illustration: <ImportIllustration />,
  },
];

export const HeroSection = () => {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative pb-4 pt-14 sm:pt-20 lg:pt-24"
    >
      <div
        aria-hidden="true"
        className="hero-grid pointer-events-none absolute inset-x-0 -top-28 h-[30rem]"
      />

      <div className="relative">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] tracking-[0.02em] text-faint">
          <span className="inline-flex items-center gap-2">
            <span className="status-dot size-1.5 rounded-full bg-accent" />
            ERP modulaire
          </span>
          <span aria-hidden="true" className="h-3 w-px bg-line" />
          <span>Conçu pour les petites équipes</span>
        </p>

        <h1
          id="hero-title"
          className="mt-7 font-display text-[2rem] leading-[0.96] tracking-[-0.02em] text-fg sm:text-[2.75rem] lg:text-[3.5rem]"
        >
          Gérez mieux
          <span className="block">votre entreprise.</span>
        </h1>

        <p className="mt-7 max-w-[54ch] text-sm leading-6 text-muted sm:text-[15px] sm:leading-7">
          qone réunit vos clients, votre équipe et vos opérations dans un espace
          unique. Commencez avec l'essentiel, puis ajoutez les modules dont
          votre entreprise a besoin.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <ShimBtn label="Créer mon espace" href="/register" />
          <a
            href="#modules"
            className="group inline-flex items-center gap-2 text-sm text-muted transition-colors duration-300 hover:text-fg"
          >
            Voir les modules
            <ArrowDown
              aria-hidden="true"
              size={14}
              className="transition-transform duration-300 group-hover:translate-y-0.5"
            />
          </a>
        </div>
      </div>

      <div id="modules" className="mt-16 scroll-mt-24 sm:mt-20">
        <div className="flex items-center justify-between border-t border-line pt-4">
          <h2 className="text-[11px] tracking-[0.02em] text-faint">
            Ce que qone réunit
          </h2>
          <p className="text-[11px] text-faint">04 modules</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <FeatCard key={feature.index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};
