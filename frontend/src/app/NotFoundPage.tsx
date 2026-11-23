import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { QoneBrand } from "../shared/components/QoneBrand";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col justify-between p-6 sm:p-12">
      <header>
        <QoneBrand />
      </header>

      <main className="max-w-md mx-auto text-center py-16">
        <p className="text-[11px] text-faint tracking-wider uppercase">[404] ERREUR</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          Page introuvable
        </h1>
        <p className="mt-3 text-xs text-muted leading-relaxed">
          La ressource que vous recherchez n'existe pas ou a été déplacée.
        </p>

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-fg px-5 py-2.5 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors"
          >
            <ArrowLeft size={14} />
            Retour à l'accueil
          </Link>
        </div>
      </main>

      <footer className="text-center text-[11px] text-faint border-t border-line pt-4">
        © 2026 qone ERP
      </footer>
    </div>
  );
};
