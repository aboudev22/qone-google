import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, Mail, Shield, Trash2, UserPlus, X } from "lucide-react";
import type { Role } from "../../shared/api/auth";
import {
  teamApi,
  type TeamInvitation,
  type TeamMember,
} from "../../shared/api/erp";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABELS: Record<Role, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Collaborateur",
};

export const TeamPage: React.FC = () => {
  const { user, currentCompany } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canManageTeam =
    currentCompany?.role === "owner" || currentCompany?.role === "admin";

  const loadTeam = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await teamApi.list();
      setMembers(res.members);
      setInvitations(res.invitations);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de charger la liste des collaborateurs.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadTeam());
  }, [loadTeam]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setIsInviting(true);
    try {
      await teamApi.invite({
        email: inviteEmail,
        firstName: inviteFirstName,
        lastName: inviteLastName,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteRole("member");
      setInviteModalOpen(false);
      await loadTeam();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible d'envoyer l'invitation.";
      setInviteError(msg);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, nextRole: Role) => {
    setError(null);
    try {
      await teamApi.updateRole(member.id, nextRole);
      await loadTeam();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de modifier le rôle.";
      setError(msg);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    setError(null);
    try {
      await teamApi.removeMember(member.id);
      await loadTeam();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de retirer ce collaborateur.";
      setError(msg);
    }
  };

  const handleRevokeInvitation = async (inv: TeamInvitation) => {
    setError(null);
    try {
      await teamApi.revokeInvitation(inv.id);
      await loadTeam();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Impossible de révoquer cette invitation.";
      setError(msg);
    }
  };

  const handleCopyInviteLink = async (inv: TeamInvitation) => {
    const link = `${window.location.origin}/register?invite=${encodeURIComponent(inv.token)}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="text-[11px] text-faint uppercase tracking-wider">
            04 / Module Équipe
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Collaborateurs & Accès
          </h1>
          <p className="mt-1 text-xs text-muted">
            Gérez les membres de l'entreprise {currentCompany?.name} et leurs rôles.
          </p>
        </div>

        {canManageTeam && (
          <button
            type="button"
            onClick={() => {
              setInviteError(null);
              setInviteModalOpen(true);
            }}
            className="flex items-center gap-2 bg-fg px-4 py-2 text-xs font-medium text-canvas hover:bg-[#dedede] transition-colors whitespace-nowrap"
          >
            <UserPlus size={13} />
            <span>Inviter un collègue</span>
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="border border-line-strong bg-panel p-4 text-xs text-fg"
        >
          {error}
        </div>
      )}

      <div className="border border-line bg-panel overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-panel-raised text-[11px] text-faint uppercase tracking-wider">
              <th className="py-3.5 px-5 font-medium">Membre</th>
              <th className="py-3.5 px-5 font-medium">Rôle</th>
              <th className="py-3.5 px-5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-muted">
                  Chargement des membres...
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const isSelf = member.userId === user?.id;
                const canEditThisMember =
                  canManageTeam &&
                  !isSelf &&
                  (currentCompany?.role === "owner" || member.role !== "owner");

                return (
                  <tr key={member.id} className="hover:bg-panel-raised/50">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <span className="size-8 border border-line bg-panel-raised flex items-center justify-center text-xs font-medium text-fg uppercase shrink-0">
                          {member.firstName?.[0]}
                          {member.lastName?.[0]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-fg">
                            {member.firstName} {member.lastName}{" "}
                            {isSelf && <span className="text-faint">(Vous)</span>}
                          </p>
                          <p className="text-[11px] text-faint flex items-center gap-1.5">
                            <Mail size={11} />
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      {canEditThisMember ? (
                        <select
                          aria-label={`Rôle de ${member.firstName} ${member.lastName}`}
                          value={member.role}
                          onChange={(e) =>
                            void handleRoleChange(member, e.target.value as Role)
                          }
                          className="bg-canvas border border-line px-2.5 py-1.5 text-xs text-fg focus:border-fg focus:outline-none"
                        >
                          {currentCompany?.role === "owner" && (
                            <option value="owner">Propriétaire</option>
                          )}
                          <option value="admin">Administrateur</option>
                          <option value="member">Collaborateur</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-fg">
                          <Shield size={12} className="text-accent" />
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-right">
                      {canEditThisMember ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member)}
                          className="p-1.5 text-muted hover:text-accent border border-transparent hover:border-line"
                          title="Retirer de l'entreprise"
                          aria-label={`Retirer ${member.firstName} ${member.lastName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span className="text-[11px] text-faint">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] text-faint uppercase tracking-wider">
            Invitations en attente
          </p>
          <div className="border border-line bg-panel divide-y divide-line">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs"
              >
                <div>
                  <p className="text-fg font-medium">
                    {inv.firstName || inv.lastName
                      ? `${inv.firstName} ${inv.lastName}`.trim()
                      : inv.email}
                  </p>
                  <p className="text-[11px] text-faint">
                    {inv.email} · {ROLE_LABELS[inv.role]}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyInviteLink(inv)}
                    className="flex items-center gap-1.5 border border-line px-3 py-1.5 text-[11px] text-muted hover:text-fg hover:border-line-strong"
                  >
                    {copiedId === inv.id ? (
                      <>
                        <Check size={12} className="text-accent" />
                        <span>Lien copié</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copier le lien</span>
                      </>
                    )}
                  </button>
                  {canManageTeam && (
                    <button
                      type="button"
                      onClick={() => handleRevokeInvitation(inv)}
                      className="p-1.5 text-muted hover:text-accent border border-transparent hover:border-line"
                      title="Révoquer l'invitation"
                      aria-label={`Révoquer ${inv.email}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-line-strong bg-panel p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-medium text-fg">
                Inviter un collègue
              </h2>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="p-1 text-muted hover:text-fg"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            {inviteError && (
              <div className="border border-line-strong bg-panel-raised p-3 text-xs text-fg">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="inv-first"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Prénom
                  </label>
                  <input
                    id="inv-first"
                    type="text"
                    value={inviteFirstName}
                    onChange={(e) => setInviteFirstName(e.target.value)}
                    placeholder="Sami"
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="inv-last"
                    className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                  >
                    Nom
                  </label>
                  <input
                    id="inv-last"
                    type="text"
                    value={inviteLastName}
                    onChange={(e) => setInviteLastName(e.target.value)}
                    placeholder="Morel"
                    className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="inv-email"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Adresse email *
                </label>
                <input
                  id="inv-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collegue@entreprise.com"
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="inv-role"
                  className="block text-[11px] uppercase tracking-wider text-muted mb-1.5"
                >
                  Rôle attribué
                </label>
                <select
                  id="inv-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full bg-canvas border border-line px-3 py-2 text-xs text-fg focus:border-fg focus:outline-none"
                >
                  <option value="member">
                    Collaborateur (CRM & Opportunités)
                  </option>
                  <option value="admin">
                    Administrateur (Équipe, CRM & Réglages)
                  </option>
                  {currentCompany?.role === "owner" && (
                    <option value="owner">Propriétaire (Accès complet)</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 border border-line text-xs text-muted hover:text-fg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="px-4 py-2 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede] disabled:opacity-50"
                >
                  {isInviting ? "Création..." : "Créer l'invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
