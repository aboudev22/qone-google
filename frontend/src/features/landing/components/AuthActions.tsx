import { ArrowUpRight } from "lucide-react";
import { ShimBtn } from "./ShimBtn";

export const AuthActions = ({ compact = false }: { compact?: boolean }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <a
          href="/login"
          className="text-xs text-muted transition-colors hover:text-fg"
        >
          Connexion
        </a>
        <ShimBtn label="S'inscrire" href="/register" size="sm" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[24ch] text-xs leading-5 text-faint">
        Créez l'espace de votre entreprise, puis invitez votre équipe.
      </p>
      <ShimBtn label="S'inscrire" href="/register" className="w-full" />
      <a
        href="/login"
        className="group inline-flex items-center justify-between border border-line px-5 py-3 text-sm text-muted transition-colors duration-300 hover:border-line-strong hover:text-fg"
      >
        Connexion
        <ArrowUpRight
          aria-hidden="true"
          size={15}
          className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        />
      </a>
    </div>
  );
};
