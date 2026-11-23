import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Mail,
  Search,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  authApi,
  type DirectoryUser,
  type Role,
} from "../../shared/api/auth";
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
  const [notice, setNotice] = useState<string | null>(null);

  // Live employee search on the platform
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger la liste des collaborateurs.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadTeam());
  }, [loadTeam]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!canManageTeam || q.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      void authApi
        .searchUsers(q)
        .then((res) => setSearchResults(res.users))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, canManageTeam]);

  const handleQuickAddOrInvite = async (
    target: DirectoryUser,
    directAdd: boolean,
  ) => {
    setError(null);
    setNotice(null);
    setIsInviting(true);
    try {
      await teamApi.invite({
        email: target.email,
        firstName: target.firstName,
        lastName: target.lastName,
        role: "member",
        directAdd,
      });
      setNotice(
        directAdd
          ? `${target.firstName} ${target.lastName} ajouté directement à l'entreprise.`
          : `Invitation envoyée à ${target.email}.`,
      );
      setSearchQuery("");
      setSearchResults([]);
      await loadTeam();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Impossible d'ajouter ce collaborateur.",
      );
    } finally {
      setIsInviting(false);
    }
  };

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
      setInviteError(
        err instanceof Error
          ? err.message
          : "Impossible d'envoyer l'invitation.",
      );
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
      setError(
        err instanceof Error ? err.message : "Impossible de modifier le rôle.",
      );
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    setError(null);
    try {
      await teamApi.removeMember(member.id);
      await loadTeam();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de retirer ce collaborateur.",
      );
    }
  };

  const handleRevokeInvitation = async (inv: TeamInvitation) => {
    setError(null);
    try {
      await teamApi.revokeInvitation(inv.id);
      await loadTeam();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de révoquer cette invitation.",
      );
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
            06 / Module Équipe & Employés
          </div>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            Employés, Recherche & Invitations
          </h1>
          <p className="mt-1 text-xs text-muted">
            Recherchez des employés inscrits par email ou nom et invitez-les dans {currentCompany?.name}.
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
            <span>Inviter par email</span>
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

      {notice && (
        <div className="border border-line-strong bg-panel p-4 text-xs text-fg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Check size={14} className="text-accent" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search Registered Employees on the Platform */}
      {canManageTeam && (
        <div className="border border-line bg-panel p-5 space-y-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-fg">
              Ajouter un employé inscrit sur la plateforme
            </h2>
            <p className="mt-1 text-[11px] text-muted">
              Tapez l'adresse email (recommandé) ou le nom d'un compte existant pour le trouver et l'ajouter ou l'inviter.
            </p>
          </div>

          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const next = e.target.value;
                setSearchQuery(next);
                if (next.trim().length < 2) setSearchResults([]);
              }}
              placeholder="Rechercher par email ou nom (ex: sami@mail.com)..."
              className="w-full bg-canvas border border-line pl-9 pr-3.5 py-2.5 text-xs text-fg placeholder:text-faint focus:border-fg focus:outline-none"
            />
          </div>

          {isSearching && (
            <p className="text-[11px] text-faint">Recherche des comptes...</p>
          )}

          {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
            <div className="border border-line bg-canvas p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-muted">
                Aucun compte trouvé pour « {searchQuery.trim()} ».
              </span>
              {searchQuery.includes("@") && (
                <button
                  type="button"
                  onClick={() => {
                    setInviteEmail(searchQuery.trim());
                    setInviteModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-fg text-canvas text-xs font-medium hover:bg-[#dedede]"
                >
                  Créer une invitation pour {searchQuery.trim()}
                </button>
              )}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="border border-line bg-canvas divide-y divide-line">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <p className="text-fg font-medium">
                      {u.firstName} {u.lastName}{" "}
                      {u.jobTitle && (
                        <span className="text-[11px] text-faint font-normal">
                          · {u.jobTitle}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-faint">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {u.alreadyMember ? (
                      <span className="text-[11px] text-accent">Déjà membre</span>
                    ) : u.alreadyInvited ? (
                      <span className="text-[11px] text-muted">Invitation en attente</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isInviting}
                          onClick={() => void handleQuickAddOrInvite(u, true)}
                          className="px-3 py-1.5 bg-fg text-canvas text-[11px] font-medium hover:bg-[#dedede]"
                        >
                          Ajouter directement
                        </button>
                        <button
                          type="button"
                          disabled={isInviting}
                          onClick={() => void handleQuickAddOrInvite(u, false)}
                          className="px-3 py-1.5 border border-line text-[11px] text-muted hover:text-fg hover:border-line-strong"
                        >
                          Envoyer invitation
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Members Table */}
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
                            {member.jobTitle ? ` · ${member.jobTitle}` : ""}
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
                          onClick={() => void handleRemoveMember(member)}
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
                    {inv.projectName ? ` · Projet : ${inv.projectName}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyInviteLink(inv)}
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
                      onClick={() => void handleRevokeInvitation(inv)}
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
                Inviter un employé par email
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
                    Collaborateur (Projets, Stock, CRM & Ventes)
                  </option>
                  <option value="admin">
                    Administrateur (Équipe, Projets, Stock & Réglages)
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
                  {isInviting ? "Envoi..." : "Envoyer l'invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
