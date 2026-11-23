const qonePillars = [
  {
    title: "Modulaire",
    description:
      "Activez les outils dont votre entreprise a besoin et ajoutez-en d'autres au fil du temps.",
  },
  {
    title: "Pensé pour l'équipe",
    description:
      "Réunissez vos collègues dans un même espace et attribuez des rôles adaptés à chacun.",
  },
  {
    title: "Centré sur vos clients",
    description:
      "Gardez vos clients, contacts et opportunités commerciales au même endroit.",
  },
  {
    title: "Simple pour vos données",
    description:
      "Importez vos clients depuis un fichier Excel et exportez vos données en CSV.",
  },
  {
    title: "Conçu pour évoluer",
    description:
      "Commencez avec l'essentiel, puis faites évoluer votre espace selon votre activité.",
  },
];

export const Description = () => {
  return (
    <section
      id="produit"
      aria-labelledby="product-title"
      className="scroll-mt-24 border-t border-line pt-6"
    >
      <div className="grid gap-10 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12">
        <p className="text-[11px] text-faint">01 / Produit</p>

        <div>
          <h2
            id="product-title"
            className="max-w-[22ch] text-2xl leading-tight font-medium tracking-[-0.03em] text-fg sm:text-3xl"
          >
            La gestion de votre entreprise, à votre façon.
          </h2>

          <p className="mt-5 max-w-[62ch] text-sm leading-6 text-muted">
            qone est une plateforme de gestion modulaire qui rassemble votre
            équipe, vos clients et vos activités dans un seul espace. Commencez
            avec les outils essentiels, puis ajoutez les fonctionnalités qui
            accompagnent votre entreprise.
          </p>

          <div className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {qonePillars.map((item) => (
              <article key={item.title} className="border-t border-line pt-4">
                <h3 className="text-sm font-medium text-fg">{item.title}</h3>
                <p className="mt-2 text-[12.5px] leading-5 text-muted">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
