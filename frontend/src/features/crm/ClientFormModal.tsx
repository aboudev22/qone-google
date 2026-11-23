import React, { useState } from "react";
import { X } from "lucide-react";
import {
  clientsApi,
  type Client,
  type ClientStatus,
} from "../../shared/api/erp";

interface ClientFormModalProps {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  client,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [companyName, setCompanyName] = useState(client?.companyName ?? "");
  const [status, setStatus] = useState<ClientStatus>(client?.status ?? "active");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom du client est obligatoire.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      if (client) {
        await clientsApi.update(client.id, {
          name,
          email,
          phone,
          companyName,
          status,
          notes,
        });
      } else {
        await clientsApi.create({
          name,
          email,
          phone,
          companyName,
          status,
          notes,
        });
      }
      onSaved();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible d'enregistrer le client.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-lg border border-line-strong bg-panel p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-sm font-medium text-fg">
            {client ? "Modifier le client" : "Nouveau client"}
          </h2>
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
            <span className="size-1.5 mt-1.5 rounded-full bg-accent shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="client-name"
                className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
              >
                Nom complet *
              </label>
              <input
                id="client-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Camille Laurent"
                className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="client-company"
                className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
              >
                Entreprise / Société
              </label>
              <input
                id="client-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Atelier Horizon"
                className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="client-email"
                className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
              >
                Email
              </label>
              <input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="camille@horizon.fr"
                className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="client-phone"
                className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
              >
                Téléphone
              </label>
              <input
                id="client-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="client-status"
              className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
            >
              Statut
            </label>
            <select
              id="client-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ClientStatus)}
              className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
            >
              <option value="active">Actif</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="client-notes"
              className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
            >
              Notes
            </label>
            <textarea
              id="client-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexte commercial, préférences de facturation..."
              className="w-full bg-canvas border border-line px-3.5 py-2 text-xs text-fg focus:border-fg focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
            >
              {isSubmitting
                ? "Enregistrement..."
                : client
                ? "Mettre à jour"
                : "Créer le client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
