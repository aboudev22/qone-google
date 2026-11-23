import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from "lucide-react";
import {
  clientsApi,
  type ClientFieldKey,
  type ColumnMapping,
  type DuplicatePolicy,
  type ImportCommitResponse,
  type ImportPreviewResponse,
  type ImportValidationResponse,
} from "../../shared/api/erp";

interface ExcelImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

const TARGET_FIELDS: Array<{
  key: ClientFieldKey;
  label: string;
  required?: boolean;
}> = [
  { key: "name", label: "Nom du client", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "companyName", label: "Entreprise / Société" },
  { key: "status", label: "Statut (Actif / Prospect / Inactif)" },
  { key: "notes", label: "Notes" },
];

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  onClose,
  onImported,
}) => {
  const [step, setStep] = useState<"upload" | "map" | "validate" | "done">(
    "upload",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [duplicatePolicy, setDuplicatePolicy] =
    useState<DuplicatePolicy>("skip");
  const [validation, setValidation] =
    useState<ImportValidationResponse | null>(null);
  const [report, setReport] = useState<ImportCommitResponse["report"] | null>(
    null,
  );

  const handleDownloadTemplate = async () => {
    setError(null);
    setIsDownloadingTemplate(true);
    try {
      const blob = await clientsApi.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qone-modele-clients.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de télécharger le modèle Excel.";
      setError(message);
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError(
        "Format non pris en charge. Veuillez sélectionner un fichier Excel (.xlsx).",
      );
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await clientsApi.previewImport(file);
      if (
        !res ||
        typeof res !== "object" ||
        !res.importId ||
        !Array.isArray(res.headers) ||
        !Array.isArray(res.previewRows)
      ) {
        throw new Error(
          "Impossible de lire la structure de ce classeur Excel. Vérifiez qu'il contient des en-têtes sur la ligne 1 et au moins une ligne de données.",
        );
      }
      setPreview(res);
      setMapping(res.suggestedMapping || {});
      setStep("map");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de lire ce classeur Excel.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!preview) return;
    if (!mapping.name) {
      setError(
        "Veuillez associer une colonne au champ obligatoire « Nom du client ».",
      );
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const res = await clientsApi.validateImport({
        importId: preview.importId,
        mapping,
        duplicatePolicy,
      });
      if (!res || !res.summary) {
        throw new Error("Réponse de validation invalide.");
      }
      setValidation(res);
      setStep("validate");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Erreur lors de la validation.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await clientsApi.commitImport({
        importId: preview.importId,
        mapping,
        duplicatePolicy,
      });
      if (!res || !res.report) {
        throw new Error("Réponse d'import invalide.");
      }
      setReport(res.report);
      setStep("done");
      onImported();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Erreur lors de l'import des données.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const previewHeaders = preview?.headers ?? [];
  const previewRows = preview?.previewRows ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl border border-line-strong bg-panel p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">
              Import Excel (.xlsx)
            </p>
            <h2 className="text-sm font-medium text-fg mt-0.5">
              {step === "upload" && "1. Charger votre classeur Excel"}
              {step === "map" && "2. Associer les colonnes et règles"}
              {step === "validate" && "3. Vérifier la validation des lignes"}
              {step === "done" && "4. Bilan de l'import"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-fg"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="border border-line-strong bg-panel-raised p-3 text-xs text-fg flex items-start gap-2"
          >
            <AlertCircle size={14} className="text-accent shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-5">
            <label className="flex flex-col items-center justify-center border border-dashed border-line-strong bg-canvas/60 p-8 text-center cursor-pointer hover:border-fg transition-colors">
              <FileSpreadsheet size={28} className="text-muted mb-3" />
              <span className="text-xs font-medium text-fg">
                {isLoading
                  ? "Analyse du classeur en cours..."
                  : "Sélectionner un fichier Excel (.xlsx)"}
              </span>
              <span className="mt-1.5 text-[11px] text-faint">
                Format .xlsx uniquement · Max 5 Mo · 5 000 lignes max
              </span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={isLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void handleFileChange(file);
                }}
                className="sr-only"
              />
              <span className="mt-4 inline-flex items-center gap-2 border border-line px-3.5 py-2 text-xs text-fg bg-panel">
                <Upload size={13} />
                Parcourir les fichiers
              </span>
            </label>

            <div className="border border-line bg-canvas p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-medium text-fg">
                    À quoi doit ressembler votre fichier Excel
                  </h3>
                  <p className="text-[11px] text-muted mt-0.5">
                    La ligne 1 doit contenir les noms de colonnes sur la première feuille du classeur.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isDownloadingTemplate}
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 border border-line-strong px-3 py-1.5 text-[11px] text-fg hover:bg-panel-raised transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <Download size={12} />
                  <span>
                    {isDownloadingTemplate
                      ? "Téléchargement..."
                      : "Télécharger un modèle .xlsx"}
                  </span>
                </button>
              </div>

              <div className="border border-line overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-panel-raised border-b border-line text-fg">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">
                        Nom <span className="text-accent">*</span>
                      </th>
                      <th className="px-2.5 py-1.5 font-medium">Email</th>
                      <th className="px-2.5 py-1.5 font-medium">Téléphone</th>
                      <th className="px-2.5 py-1.5 font-medium">Entreprise</th>
                      <th className="px-2.5 py-1.5 font-medium">Statut</th>
                      <th className="px-2.5 py-1.5 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line text-muted">
                    <tr>
                      <td className="px-2.5 py-1.5 text-fg">Claire Bernard</td>
                      <td className="px-2.5 py-1.5">claire@studio-b.fr</td>
                      <td className="px-2.5 py-1.5 tabular-nums">+33 6 12 34 56 78</td>
                      <td className="px-2.5 py-1.5">Studio B</td>
                      <td className="px-2.5 py-1.5">Actif</td>
                      <td className="px-2.5 py-1.5">Contact principal</td>
                    </tr>
                    <tr>
                      <td className="px-2.5 py-1.5 text-fg">Marc Lefèvre</td>
                      <td className="px-2.5 py-1.5">marc@atelier-nord.fr</td>
                      <td className="px-2.5 py-1.5 tabular-nums">+33 6 98 76 54 32</td>
                      <td className="px-2.5 py-1.5">Atelier Nord</td>
                      <td className="px-2.5 py-1.5">Prospect</td>
                      <td className="px-2.5 py-1.5">Devis demandé</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <ul className="text-[11px] text-faint space-y-1">
                <li>
                  • <strong className="text-muted">Nom</strong> est obligatoire ; toutes les autres colonnes sont optionnelles et peuvent être associées à l'étape suivante.
                </li>
                <li>
                  • <strong className="text-muted">Statut</strong> accepte :{" "}
                  <span className="text-muted">Actif</span>,{" "}
                  <span className="text-muted">Prospect</span> ou{" "}
                  <span className="text-muted">Inactif</span> (par défaut : Actif si vide).
                </li>
                <li>
                  • <strong className="text-muted">Email</strong> doit être valide s'il est renseigné (ex. nom@entreprise.fr).
                </li>
              </ul>
            </div>
          </div>
        )}

        {step === "map" && preview && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted border border-line bg-canvas p-3">
              <span>
                Feuille :{" "}
                <strong className="text-fg">{preview.sheetName}</strong>
              </span>
              <span className="tabular-nums">
                {preview.totalRows} lignes détectées · {previewHeaders.length}{" "}
                colonnes
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] text-muted mb-1">
                    {field.label}
                    {field.required && <span className="text-accent"> *</span>}
                  </label>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: e.target.value || undefined,
                      }))
                    }
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  >
                    <option value="">— Ignorer ce champ —</option>
                    {previewHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted mb-1.5">
                Gestion des doublons (email ou nom identique)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: "skip", label: "Ignorer les doublons" },
                    { id: "update", label: "Mettre à jour les fiches" },
                    { id: "error", label: "Rejeter comme erreur" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDuplicatePolicy(opt.id)}
                    className={`px-3 py-2 text-xs border text-left transition-colors ${
                      duplicatePolicy === opt.id
                        ? "border-fg bg-panel-raised text-fg"
                        : "border-line bg-canvas text-muted hover:text-fg"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-faint mb-2">
                Aperçu des premières lignes du fichier
              </p>
              <div className="border border-line overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-panel-raised border-b border-line text-faint">
                    <tr>
                      {previewHeaders.map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 font-medium whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {previewHeaders.map((h) => (
                          <td
                            key={h}
                            className="px-3 py-2 text-muted whitespace-nowrap max-w-[180px] truncate"
                          >
                            {row[h] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
              >
                Changer de fichier
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleValidate}
                className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
              >
                {isLoading ? "Validation..." : "Analyser et valider"}
              </button>
            </div>
          </div>
        )}

        {step === "validate" && validation && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Total</span>
                <p className="mt-1 text-lg font-medium text-fg tabular-nums">
                  {validation.summary.total}
                </p>
              </div>
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Valides</span>
                <p className="mt-1 text-lg font-medium text-fg tabular-nums">
                  {validation.summary.valid}
                </p>
              </div>
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Doublons</span>
                <p className="mt-1 text-lg font-medium text-muted tabular-nums">
                  {validation.summary.duplicates}
                </p>
              </div>
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Rejetées</span>
                <p className="mt-1 text-lg font-medium text-accent tabular-nums">
                  {validation.summary.invalid}
                </p>
              </div>
            </div>

            {validation.issues.length > 0 ? (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-faint mb-2">
                  Anomalies et doublons détectés
                </p>
                <div className="border border-line max-h-56 overflow-y-auto divide-y divide-line">
                  {validation.issues.map((issue, idx) => (
                    <div
                      key={`${issue.rowNumber}-${idx}`}
                      className="px-3.5 py-2.5 text-xs flex items-start justify-between gap-4 bg-canvas"
                    >
                      <div className="min-w-0">
                        <span className="text-faint tabular-nums mr-2">
                          Ligne {issue.rowNumber}
                        </span>
                        <span className="text-fg font-medium">
                          {issue.name || "(sans nom)"}
                        </span>
                        {issue.email && (
                          <span className="text-muted ml-2">{issue.email}</span>
                        )}
                        <p className="text-[11px] text-muted mt-0.5">
                          {issue.errors.join(" ")}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase shrink-0 text-faint">
                        {issue.status === "duplicate" ? "Doublon" : "Erreur"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-line bg-canvas p-4 text-xs text-fg flex items-center gap-2">
                <CheckCircle2 size={15} className="text-accent" />
                <span>
                  Toutes les lignes sont valides et prêtes à être importées.
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setStep("map")}
                className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
              >
                Retour au mapping
              </button>
              <button
                type="button"
                disabled={
                  isLoading ||
                  (validation.summary.valid === 0 &&
                    !(
                      duplicatePolicy === "update" &&
                      validation.summary.duplicates > 0
                    ))
                }
                onClick={handleCommit}
                className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
              >
                {isLoading ? "Importation..." : "Confirmer l'import"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && report && (
          <div className="space-y-5">
            <div className="border border-line bg-canvas p-4 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-accent shrink-0" />
              <div className="text-xs">
                <p className="text-fg font-medium">Import terminé</p>
                <p className="text-muted mt-0.5">
                  Votre répertoire client a été mis à jour avec le bilan ci-dessous.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Importées</span>
                <p className="mt-1 text-lg font-medium text-fg tabular-nums">
                  {report.imported}
                </p>
              </div>
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">
                  Mises à jour
                </span>
                <p className="mt-1 text-lg font-medium text-fg tabular-nums">
                  {report.updated}
                </p>
              </div>
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Ignorées</span>
                <p className="mt-1 text-lg font-medium text-muted tabular-nums">
                  {report.skipped}
                </p>
              </div>
              <div className="border border-line bg-canvas p-3">
                <span className="text-[10px] text-faint uppercase">Rejetées</span>
                <p className="mt-1 text-lg font-medium text-accent tabular-nums">
                  {report.rejected}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede]"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
