import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { QoneBrand } from "../shared/components/QoneBrand";

export const ErrorFallbackView: React.FC<{ onReset?: () => void }> = ({
  onReset,
}) => {
  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col justify-between p-6 sm:p-10">
      <QoneBrand />

      <div className="max-w-md w-full mx-auto border border-line-strong bg-panel p-8 space-y-5">
        <div className="flex items-center gap-3">
          <span className="size-9 border border-line bg-panel-raised flex items-center justify-center text-accent shrink-0">
            <AlertCircle size={18} />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">
              Incident d'affichage
            </p>
            <h1 className="text-base font-medium text-fg">
              Une erreur est survenue
            </h1>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          L'interface a rencontré un comportement inattendu. Aucune donnée n'a été perdue ; vous pouvez recharger l'écran pour continuer.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (onReset) onReset();
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 bg-fg text-canvas px-4 py-2 text-xs font-medium hover:bg-[#dedede]"
          >
            <RefreshCw size={13} />
            <span>Recharger la page</span>
          </button>
          <a
            href="/app"
            className="inline-flex items-center gap-2 border border-line px-4 py-2 text-xs text-muted hover:text-fg hover:border-line-strong"
          >
            Retour au tableau de bord
          </a>
        </div>
      </div>

      <p className="text-[11px] text-faint text-center">© 2026 qone</p>
    </div>
  );
};

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallbackView
          onReset={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}
