import { ArrowUpRight } from "lucide-react";

const ITEMS = [
  { index: "01", label: "Produit", href: "#produit" },
  { index: "02", label: "Modules", href: "#modules" },
  { index: "03", label: "Démarrage", href: "#demarrer" },
];

export const Navbar = () => {
  return (
    <nav aria-label="Navigation principale">
      <ul className="flex flex-col gap-1">
        {ITEMS.map((item) => (
          <li key={item.index}>
            <a
              href={item.href}
              className="group flex items-center gap-2 py-1.5 text-[13px] text-muted transition-colors duration-300 hover:text-fg"
            >
              <span
                aria-hidden="true"
                className="text-[10px] text-faint transition-colors duration-300 group-hover:text-muted"
              >
                [{item.index}]
              </span>
              <span>{item.label}</span>
              <ArrowUpRight
                aria-hidden="true"
                size={12}
                className="opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
