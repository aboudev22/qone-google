import type { Company, ModuleKey, Role, User } from "../api/auth";
import type {
  ActivityLog,
  Client,
  ClientStatus,
  Opportunity,
  OpportunityStage,
  TeamInvitation,
  TeamMember,
} from "../api/erp";

const STORAGE_KEY = "qone_erp_store_v1";
const SESSION_USER_KEY = "qone_session_user_id";
const ACTIVE_COMPANY_KEY = "qone_active_company_id";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StoredUser extends User {
  passwordHash: string;
  createdAt: string;
}

interface StoredCompany {
  id: string;
  name: string;
  slug: string;
  enabledModules: ModuleKey[];
  createdAt: string;
}

interface StoredMembership {
  id: string;
  userId: string;
  companyId: string;
  role: Role;
  joinedAt: string;
}

interface StoredInvitation extends TeamInvitation {
  companyName: string;
}

interface LocalDatabase {
  users: StoredUser[];
  companies: StoredCompany[];
  memberships: StoredMembership[];
  invitations: StoredInvitation[];
  clients: Client[];
  opportunities: Opportunity[];
  activities: ActivityLog[];
}

function emptyDb(): LocalDatabase {
  return {
    users: [],
    companies: [],
    memberships: [],
    invitations: [],
    clients: [],
    opportunities: [],
    activities: [],
  };
}

function loadDb(): LocalDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as Partial<LocalDatabase>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
      invitations: Array.isArray(parsed.invitations) ? parsed.invitations : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    };
  } catch {
    return emptyDb();
  }
}

function saveDb(db: LocalDatabase): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "entreprise";
}

function makeUniqueSlug(db: LocalDatabase, name: string, excludeId?: string): string {
  const base = slugify(name);
  let candidate = base;
  let counter = 2;
  while (db.companies.some((c) => c.slug === candidate && c.id !== excludeId)) {
    candidate = `${base}-${counter++}`;
  }
  return candidate;
}

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function hashPassword(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || makeId().slice(0, 12);
  const input = `${actualSalt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(input);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${actualSalt}$${hex}`;
  }
  // Fallback for non-secure HTTP contexts during local network demos
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return `${actualSalt}$${hash.toString(16)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt] = stored.split("$");
  if (!salt) return false;
  const candidate = await hashPassword(password, salt);
  return candidate === stored;
}

function toPublicUser(u: StoredUser): User {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    createdAt: u.createdAt,
  };
}

function userCompanies(db: LocalDatabase, userId: string): Company[] {
  const result: Company[] = [];
  for (const m of db.memberships) {
    if (m.userId !== userId) continue;
    const company = db.companies.find((c) => c.id === m.companyId);
    if (!company) continue;
    result.push({
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: m.role,
      enabledModules: company.enabledModules,
      member_since: m.joinedAt,
    });
  }
  return result;
}

function appendActivity(
  db: LocalDatabase,
  companyId: string,
  user: User,
  action: string,
  summary: string,
): void {
  const actorName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  db.activities.unshift({
    id: makeId(),
    companyId,
    actorUid: user.id,
    actorName: actorName.slice(0, 160),
    action: action.slice(0, 64),
    summary: summary.slice(0, 300),
    createdAt: new Date().toISOString(),
  });
  if (db.activities.length > 300) {
    db.activities = db.activities.slice(0, 300);
  }
}

function seedDemoDataForCompany(
  db: LocalDatabase,
  companyId: string,
  ownerUserId: string,
): void {
  const now = new Date().toISOString();
  const c1Id = makeId();
  const c2Id = makeId();
  const c3Id = makeId();
  const c4Id = makeId();

  db.clients.unshift(
    {
      id: c4Id,
      companyId,
      name: "Julien Mercier",
      email: "j.mercier@agence-vesper.fr",
      phone: "+33 6 98 11 04 55",
      companyName: "Agence Vesper",
      status: "inactive",
      notes: "Contrat terminé en fin d'exercice",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: c3Id,
      companyId,
      name: "Nadia Benali",
      email: "nadia@maison-clair.fr",
      phone: "+33 7 81 20 33 14",
      companyName: "Maison Clair",
      status: "prospect",
      notes: "Demande de démonstration suite au salon",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: c2Id,
      companyId,
      name: "Thomas Moreau",
      email: "t.moreau@nordic-log.fr",
      phone: "+33 6 44 89 10 22",
      companyName: "Nordic Logistics",
      status: "active",
      notes: "Déploiement multi-sites prévu au T2",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: c1Id,
      companyId,
      name: "Camille Laurent",
      email: "camille@atelier-horizon.fr",
      phone: "+33 6 12 45 78 90",
      companyName: "Atelier Horizon",
      status: "active",
      notes: "Client historique — facturation mensuelle",
      createdAt: now,
      updatedAt: now,
    },
  );

  db.opportunities.unshift(
    {
      id: makeId(),
      companyId,
      clientId: c1Id,
      clientName: "Camille Laurent",
      title: "Extension licences équipe",
      amount: 4800,
      probability: 80,
      stage: "negotiation",
      expectedCloseDate: "2026-12-15",
      notes: "Validation finale en cours avec la direction",
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId(),
      companyId,
      clientId: c2Id,
      clientName: "Thomas Moreau",
      title: "Pack CRM & Import annuel",
      amount: 9200,
      probability: 55,
      stage: "proposal",
      expectedCloseDate: "2026-12-28",
      notes: "Proposition envoyée",
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId(),
      companyId,
      clientId: c3Id,
      clientName: "Nadia Benali",
      title: "Onboarding initial",
      amount: 2400,
      probability: 30,
      stage: "qualification",
      expectedCloseDate: "2027-01-12",
      notes: "Qualification des besoins équipe",
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId(),
      companyId,
      clientId: c1Id,
      clientName: "Camille Laurent",
      title: "Audit données & migration",
      amount: 3100,
      probability: 100,
      stage: "won",
      expectedCloseDate: "2026-11-10",
      notes: "Signé",
      ownerUserId,
      createdAt: now,
      updatedAt: now,
    },
  );
}

export function getActiveCompanyId(): string | null {
  return sessionStorage.getItem(ACTIVE_COMPANY_KEY);
}

export function setActiveCompanyId(id: string | null): void {
  if (id) {
    sessionStorage.setItem(ACTIVE_COMPANY_KEY, id);
  } else {
    sessionStorage.removeItem(ACTIVE_COMPANY_KEY);
  }
}

function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_USER_KEY);
}

function setSessionUserId(id: string | null): void {
  if (id) {
    localStorage.setItem(SESSION_USER_KEY, id);
  } else {
    localStorage.removeItem(SESSION_USER_KEY);
  }
}

function requireSession(db: LocalDatabase): {
  user: StoredUser;
  companyId: string;
  role: Role;
} {
  const userId = getSessionUserId();
  if (!userId) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    setSessionUserId(null);
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  const companies = userCompanies(db, user.id);
  if (companies.length === 0) {
    throw new Error("Aucune entreprise associée à ce compte.");
  }

  const storedCompanyId = getActiveCompanyId();
  const active =
    companies.find((c) => c.id === storedCompanyId) || companies[0];
  setActiveCompanyId(active.id);

  return { user, companyId: active.id, role: active.role };
}

export const localErpStore = {
  getBootstrapStatus() {
    const db = loadDb();
    return { needsSetup: db.users.length === 0 };
  },

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    companyName?: string;
    inviteToken?: string;
    seedDemoData?: boolean;
  }): Promise<{ user: User; company: Company; companies: Company[] }> {
    const db = loadDb();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanFirst = input.firstName.trim();
    const cleanLast = (input.lastName ?? "").trim();

    if (!EMAIL_RE.test(cleanEmail)) {
      throw new Error("Veuillez saisir une adresse email valide.");
    }
    if (input.password.length < 8) {
      throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (!cleanFirst) {
      throw new Error("Veuillez renseigner votre prénom.");
    }
    if (db.users.some((u) => u.email === cleanEmail)) {
      throw new Error("Un compte existe déjà avec cette adresse email.");
    }

    let invitation: StoredInvitation | undefined;
    if (input.inviteToken?.trim()) {
      invitation = db.invitations.find(
        (i) =>
          i.token === input.inviteToken!.trim() &&
          i.status === "pending" &&
          new Date(i.expiresAt).getTime() > Date.now(),
      );
      if (!invitation) {
        throw new Error("Cette invitation est invalide ou expirée.");
      }
      if (invitation.email.toLowerCase() !== cleanEmail) {
        throw new Error(
          `Cette invitation est réservée à l'adresse ${invitation.email}.`,
        );
      }
    } else if (!input.companyName?.trim()) {
      throw new Error("Veuillez renseigner le nom de votre entreprise.");
    }

    const now = new Date().toISOString();
    const user: StoredUser = {
      id: makeId(),
      email: cleanEmail,
      firstName: cleanFirst,
      lastName: cleanLast,
      passwordHash: await hashPassword(input.password),
      createdAt: now,
    };
    db.users.push(user);

    const publicUser = toPublicUser(user);

    if (invitation) {
      db.memberships.push({
        id: makeId(),
        userId: user.id,
        companyId: invitation.companyId,
        role: invitation.role,
        joinedAt: now,
      });
      invitation.status = "accepted";
      appendActivity(
        db,
        invitation.companyId,
        publicUser,
        "team.joined",
        `${cleanFirst} ${cleanLast}`.trim() + " a rejoint l'équipe",
      );
    } else {
      const companyId = makeId();
      const company: StoredCompany = {
        id: companyId,
        name: input.companyName!.trim(),
        slug: makeUniqueSlug(db, input.companyName!.trim()),
        enabledModules: ["crm", "sales"],
        createdAt: now,
      };
      db.companies.push(company);
      db.memberships.push({
        id: makeId(),
        userId: user.id,
        companyId,
        role: "owner",
        joinedAt: now,
      });

      if (input.seedDemoData) {
        seedDemoDataForCompany(db, companyId, user.id);
      }
      appendActivity(
        db,
        companyId,
        publicUser,
        "company.created",
        `Création de l'espace ${company.name}`,
      );
    }

    saveDb(db);
    setSessionUserId(user.id);

    const companies = userCompanies(db, user.id);
    if (companies[0]) {
      setActiveCompanyId(companies[0].id);
    }

    return {
      user: publicUser,
      company: companies[0],
      companies,
    };
  },

  async login(input: {
    email: string;
    password: string;
    inviteToken?: string;
  }): Promise<{ user: User; companies: Company[] }> {
    const db = loadDb();
    const cleanEmail = input.email.trim().toLowerCase();
    const user = db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      throw new Error("Email ou mot de passe incorrect.");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw new Error("Email ou mot de passe incorrect.");
    }

    const publicUser = toPublicUser(user);

    if (input.inviteToken?.trim()) {
      const invitation = db.invitations.find(
        (i) =>
          i.token === input.inviteToken!.trim() &&
          i.status === "pending" &&
          new Date(i.expiresAt).getTime() > Date.now() &&
          i.email.toLowerCase() === cleanEmail,
      );
      if (invitation) {
        const already = db.memberships.some(
          (m) => m.userId === user.id && m.companyId === invitation.companyId,
        );
        if (!already) {
          db.memberships.push({
            id: makeId(),
            userId: user.id,
            companyId: invitation.companyId,
            role: invitation.role,
            joinedAt: new Date().toISOString(),
          });
        }
        invitation.status = "accepted";
      }
    }

    const companies = userCompanies(db, user.id);
    if (companies[0]) {
      appendActivity(
        db,
        companies[0].id,
        publicUser,
        "auth.login",
        `Connexion de ${publicUser.firstName || publicUser.email}`,
      );
    }

    saveDb(db);
    setSessionUserId(user.id);
    if (companies[0]) {
      setActiveCompanyId(companies[0].id);
    }

    return { user: publicUser, companies };
  },

  logout(): void {
    const db = loadDb();
    const userId = getSessionUserId();
    if (userId) {
      const user = db.users.find((u) => u.id === userId);
      if (user) {
        const companies = userCompanies(db, user.id);
        const activeId = getActiveCompanyId() || companies[0]?.id;
        if (activeId) {
          appendActivity(
            db,
            activeId,
            toPublicUser(user),
            "auth.logout",
            `Déconnexion de ${user.firstName || user.email}`,
          );
          saveDb(db);
        }
      }
    }
    setSessionUserId(null);
    setActiveCompanyId(null);
  },

  getMe(): { user: User; companies: Company[] } | null {
    const userId = getSessionUserId();
    if (!userId) return null;
    const db = loadDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      setSessionUserId(null);
      return null;
    }
    return {
      user: toPublicUser(user),
      companies: userCompanies(db, user.id),
    };
  },

  getInvitation(token: string) {
    const db = loadDb();
    const inv = db.invitations.find(
      (i) =>
        i.token === token.trim() &&
        i.status === "pending" &&
        new Date(i.expiresAt).getTime() > Date.now(),
    );
    if (!inv) {
      throw new Error("Invitation invalide ou expirée.");
    }
    return {
      email: inv.email,
      firstName: inv.firstName,
      lastName: inv.lastName,
      role: inv.role,
      companyName: inv.companyName,
    };
  },

  createCompany(name: string): Company {
    const db = loadDb();
    const { user } = requireSession(db);
    if (name.trim().length < 2) {
      throw new Error("Le nom de l'entreprise doit comporter au moins 2 caractères.");
    }
    const now = new Date().toISOString();
    const company: StoredCompany = {
      id: makeId(),
      name: name.trim(),
      slug: makeUniqueSlug(db, name.trim()),
      enabledModules: ["crm", "sales"],
      createdAt: now,
    };
    db.companies.push(company);
    db.memberships.push({
      id: makeId(),
      userId: user.id,
      companyId: company.id,
      role: "owner",
      joinedAt: now,
    });
    appendActivity(
      db,
      company.id,
      toPublicUser(user),
      "company.created",
      `Création de l'espace ${company.name}`,
    );
    saveDb(db);

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      role: "owner",
      enabledModules: company.enabledModules,
      member_since: now,
    };
  },

  updateCurrentCompany(patch: {
    name?: string;
    slug?: string;
    enabledModules?: ModuleKey[];
  }): Company {
    const db = loadDb();
    const { user, companyId, role } = requireSession(db);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Permissions insuffisantes pour modifier les paramètres.");
    }
    const company = db.companies.find((c) => c.id === companyId);
    if (!company) {
      throw new Error("Entreprise introuvable.");
    }

    if (patch.name !== undefined) {
      if (patch.name.trim().length < 2) {
        throw new Error(
          "Le nom de l'entreprise doit comporter au moins 2 caractères.",
        );
      }
      company.name = patch.name.trim();
    }
    if (patch.slug !== undefined) {
      if (patch.slug.trim().length < 2) {
        throw new Error("Le slug doit comporter au moins 2 caractères.");
      }
      company.slug = makeUniqueSlug(db, patch.slug.trim(), company.id);
    }
    if (patch.enabledModules !== undefined) {
      company.enabledModules = patch.enabledModules;
    }

    appendActivity(
      db,
      company.id,
      toPublicUser(user),
      "company.updated",
      `Paramètres de ${company.name} mis à jour`,
    );
    saveDb(db);

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      role,
      enabledModules: company.enabledModules,
    };
  },

  getCompanySummary() {
    const db = loadDb();
    const { companyId } = requireSession(db);
    const members = db.memberships.filter((m) => m.companyId === companyId);
    const clients = db.clients.filter((c) => c.companyId === companyId);
    const opportunities = db.opportunities.filter(
      (o) => o.companyId === companyId,
    );
    const recentActivities = db.activities
      .filter((a) => a.companyId === companyId)
      .slice(0, 8);

    const openOpps = opportunities.filter(
      (o) => o.stage !== "won" && o.stage !== "lost",
    );
    const wonOpps = opportunities.filter((o) => o.stage === "won");

    return {
      summary: {
        membersCount: members.length || 1,
        clientsCount: clients.length,
        activeClientsCount: clients.filter((c) => c.status === "active").length,
        opportunitiesCount: opportunities.length,
        openOpportunitiesCount: openOpps.length,
        pipelineValue: openOpps.reduce((sum, o) => sum + o.amount, 0),
        wonValue: wonOpps.reduce((sum, o) => sum + o.amount, 0),
      },
      recentClients: clients.slice(0, 5),
      recentOpportunities: opportunities.slice(0, 5),
      recentActivities,
    };
  },

  listTeam(): { members: TeamMember[]; invitations: TeamInvitation[] } {
    const db = loadDb();
    const { companyId } = requireSession(db);
    const members: TeamMember[] = db.memberships
      .filter((m) => m.companyId === companyId)
      .map((m) => {
        const u = db.users.find((usr) => usr.id === m.userId);
        return {
          id: m.id,
          userId: m.userId,
          email: u?.email ?? "",
          firstName: u?.firstName ?? "Membre",
          lastName: u?.lastName ?? "",
          role: m.role,
          joinedAt: m.joinedAt,
        };
      });

    const invitations = db.invitations.filter(
      (i) => i.companyId === companyId && i.status === "pending",
    );

    return { members, invitations };
  },

  inviteMember(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    role: Role;
  }): { addedDirectly: boolean; invitation?: TeamInvitation; members?: TeamMember[] } {
    const db = loadDb();
    const { user, companyId, role } = requireSession(db);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Permissions insuffisantes pour inviter un collaborateur.");
    }
    if (input.role === "owner" && role !== "owner") {
      throw new Error(
        "Seul un propriétaire peut attribuer le rôle de propriétaire.",
      );
    }

    const cleanEmail = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      throw new Error("Adresse email invalide.");
    }

    const company = db.companies.find((c) => c.id === companyId);
    const existingMember = db.memberships.some((m) => {
      if (m.companyId !== companyId) return false;
      const u = db.users.find((usr) => usr.id === m.userId);
      return u?.email.toLowerCase() === cleanEmail;
    });
    if (existingMember) {
      throw new Error("Cet utilisateur fait déjà partie de l'entreprise.");
    }

    const existingUser = db.users.find((u) => u.email === cleanEmail);
    if (existingUser) {
      db.memberships.push({
        id: makeId(),
        userId: existingUser.id,
        companyId,
        role: input.role,
        joinedAt: new Date().toISOString(),
      });
      appendActivity(
        db,
        companyId,
        toPublicUser(user),
        "team.added",
        `Ajout de ${existingUser.email} à l'équipe`,
      );
      saveDb(db);
      return {
        addedDirectly: true,
        members: this.listTeam().members,
      };
    }

    const now = new Date().toISOString();
    const inv: StoredInvitation = {
      id: makeId(),
      companyId,
      companyName: company?.name || "Espace qone",
      email: cleanEmail,
      firstName: (input.firstName || "").trim(),
      lastName: (input.lastName || "").trim(),
      role: input.role,
      token: makeId().replace(/-/g, ""),
      status: "pending",
      createdAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    db.invitations.unshift(inv);
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "team.invited",
      `Invitation envoyée à ${cleanEmail}`,
    );
    saveDb(db);

    return { addedDirectly: false, invitation: inv };
  },

  revokeInvitation(id: string): void {
    const db = loadDb();
    const { user, companyId, role } = requireSession(db);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Permissions insuffisantes.");
    }
    const inv = db.invitations.find(
      (i) => i.id === id && i.companyId === companyId,
    );
    if (!inv) {
      throw new Error("Invitation introuvable.");
    }
    inv.status = "revoked";
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "team.invite_revoked",
      `Invitation révoquée (${inv.email})`,
    );
    saveDb(db);
  },

  updateMemberRole(memberId: string, nextRole: Role): TeamMember {
    const db = loadDb();
    const { user, companyId, role } = requireSession(db);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Permissions insuffisantes.");
    }
    const m = db.memberships.find(
      (item) => item.id === memberId && item.companyId === companyId,
    );
    if (!m) {
      throw new Error("Membre introuvable.");
    }
    if ((m.role === "owner" || nextRole === "owner") && role !== "owner") {
      throw new Error(
        "Seul un propriétaire peut modifier ce niveau de rôle.",
      );
    }
    const ownerCount = db.memberships.filter(
      (item) => item.companyId === companyId && item.role === "owner",
    ).length;
    if (m.role === "owner" && nextRole !== "owner" && ownerCount <= 1) {
      throw new Error("L'entreprise doit conserver au moins un propriétaire.");
    }

    m.role = nextRole;
    const targetUser = db.users.find((u) => u.id === m.userId);
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "team.role_updated",
      `Rôle mis à jour pour ${targetUser?.email || "un membre"}`,
    );
    saveDb(db);

    return {
      id: m.id,
      userId: m.userId,
      email: targetUser?.email ?? "",
      firstName: targetUser?.firstName ?? "Membre",
      lastName: targetUser?.lastName ?? "",
      role: m.role,
      joinedAt: m.joinedAt,
    };
  },

  removeMember(memberId: string): void {
    const db = loadDb();
    const { user, companyId, role } = requireSession(db);
    if (role !== "owner" && role !== "admin") {
      throw new Error("Permissions insuffisantes.");
    }
    const idx = db.memberships.findIndex(
      (item) => item.id === memberId && item.companyId === companyId,
    );
    if (idx === -1) {
      throw new Error("Membre introuvable.");
    }
    const target = db.memberships[idx];
    if (target.userId === user.id) {
      throw new Error("Vous ne pouvez pas retirer votre propre accès ici.");
    }
    if (target.role === "owner" && role !== "owner") {
      throw new Error(
        "Seul un propriétaire peut retirer un autre propriétaire.",
      );
    }
    const ownerCount = db.memberships.filter(
      (item) => item.companyId === companyId && item.role === "owner",
    ).length;
    if (target.role === "owner" && ownerCount <= 1) {
      throw new Error("Impossible de retirer le dernier propriétaire.");
    }

    const targetUser = db.users.find((u) => u.id === target.userId);
    db.memberships.splice(idx, 1);
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "team.removed",
      `Retrait de ${targetUser?.email || "un collaborateur"}`,
    );
    saveDb(db);
  },

  listClients(params?: { search?: string; status?: string }): Client[] {
    const db = loadDb();
    const { companyId } = requireSession(db);
    let list = db.clients.filter((c) => c.companyId === companyId);

    if (params?.status && params.status !== "all") {
      list = list.filter((c) => c.status === params.status);
    }
    if (params?.search?.trim()) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q),
      );
    }

    return list;
  },

  createClient(input: {
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: ClientStatus;
    notes?: string;
  }): Client {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    if (!input.name.trim()) {
      throw new Error("Le nom du client est obligatoire.");
    }
    const cleanEmail = (input.email || "").trim().toLowerCase();
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      throw new Error("Adresse email invalide.");
    }

    const now = new Date().toISOString();
    const client: Client = {
      id: makeId(),
      companyId,
      name: input.name.trim(),
      email: cleanEmail,
      phone: (input.phone || "").trim(),
      companyName: (input.companyName || "").trim(),
      status: input.status || "active",
      notes: (input.notes || "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    db.clients.unshift(client);
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "client.created",
      `Création du client ${client.name}`,
    );
    saveDb(db);
    return client;
  },

  updateClient(
    id: string,
    patch: Partial<{
      name: string;
      email: string;
      phone: string;
      companyName: string;
      status: ClientStatus;
      notes: string;
    }>,
  ): Client {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    const client = db.clients.find(
      (c) => c.id === id && c.companyId === companyId,
    );
    if (!client) {
      throw new Error("Client introuvable.");
    }

    if (patch.name !== undefined) {
      if (!patch.name.trim()) {
        throw new Error("Le nom du client ne peut pas être vide.");
      }
      client.name = patch.name.trim();
    }
    if (patch.email !== undefined) {
      const cleanEmail = patch.email.trim().toLowerCase();
      if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
        throw new Error("Adresse email invalide.");
      }
      client.email = cleanEmail;
    }
    if (patch.phone !== undefined) client.phone = patch.phone.trim();
    if (patch.companyName !== undefined) {
      client.companyName = patch.companyName.trim();
    }
    if (patch.status !== undefined) client.status = patch.status;
    if (patch.notes !== undefined) client.notes = patch.notes.trim();
    client.updatedAt = new Date().toISOString();

    for (const opp of db.opportunities) {
      if (opp.companyId === companyId && opp.clientId === client.id) {
        opp.clientName = client.name;
      }
    }

    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "client.updated",
      `Mise à jour du client ${client.name}`,
    );
    saveDb(db);
    return { ...client };
  },

  deleteClient(id: string): void {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    const idx = db.clients.findIndex(
      (c) => c.id === id && c.companyId === companyId,
    );
    if (idx === -1) {
      throw new Error("Client introuvable.");
    }
    const removed = db.clients[idx];
    db.clients.splice(idx, 1);
    db.opportunities = db.opportunities.filter(
      (o) => !(o.companyId === companyId && o.clientId === id),
    );
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "client.deleted",
      `Suppression du client ${removed.name}`,
    );
    saveDb(db);
  },

  commitImportedClients(
    operations: Array<
      | {
          type: "create";
          data: {
            name: string;
            email: string;
            phone: string;
            companyName: string;
            status: ClientStatus;
            notes: string;
          };
        }
      | {
          type: "update";
          clientId: string;
          data: {
            name: string;
            email: string;
            phone: string;
            companyName: string;
            status: ClientStatus;
            notes: string;
          };
        }
    >,
  ): { imported: number; updated: number } {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    const now = new Date().toISOString();
    let imported = 0;
    let updated = 0;

    for (const op of operations) {
      if (op.type === "create") {
        db.clients.unshift({
          id: makeId(),
          companyId,
          ...op.data,
          createdAt: now,
          updatedAt: now,
        });
        imported++;
      } else {
        const existing = db.clients.find(
          (c) => c.id === op.clientId && c.companyId === companyId,
        );
        if (existing) {
          Object.assign(existing, op.data, { updatedAt: now });
          updated++;
        }
      }
    }

    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "client.imported",
      `Import Excel : ${imported} ajout(s), ${updated} mise(s) à jour`,
    );
    saveDb(db);
    return { imported, updated };
  },

  listOpportunities(): Opportunity[] {
    const db = loadDb();
    const { companyId } = requireSession(db);
    return db.opportunities
      .filter((o) => o.companyId === companyId)
      .map((o) => {
        const client = db.clients.find((c) => c.id === o.clientId);
        const owner = db.users.find((u) => u.id === o.ownerUserId);
        return {
          ...o,
          clientName: client?.name || o.clientName || "Client",
          ownerName: owner
            ? `${owner.firstName} ${owner.lastName}`.trim()
            : o.ownerName || "",
        };
      });
  },

  createOpportunity(input: {
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate?: string;
    notes?: string;
  }): Opportunity {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    if (!input.title.trim()) {
      throw new Error("Le titre de l'opportunité est requis.");
    }
    const client = db.clients.find(
      (c) => c.id === input.clientId && c.companyId === companyId,
    );
    if (!client) {
      throw new Error("Client associé introuvable.");
    }

    const now = new Date().toISOString();
    const opp: Opportunity = {
      id: makeId(),
      companyId,
      clientId: client.id,
      clientName: client.name,
      title: input.title.trim(),
      amount: Math.max(0, Number(input.amount) || 0),
      probability: Math.max(
        0,
        Math.min(100, Math.round(Number(input.probability) || 0)),
      ),
      stage: input.stage,
      expectedCloseDate: (input.expectedCloseDate || "").trim(),
      notes: (input.notes || "").trim(),
      ownerUserId: user.id,
      ownerName: `${user.firstName} ${user.lastName}`.trim(),
      createdAt: now,
      updatedAt: now,
    };

    db.opportunities.unshift(opp);
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "opportunity.created",
      `Opportunité créée : ${opp.title}`,
    );
    saveDb(db);
    return opp;
  },

  updateOpportunity(
    id: string,
    patch: Partial<{
      clientId: string;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expectedCloseDate: string;
      notes: string;
    }>,
  ): Opportunity {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    const opp = db.opportunities.find(
      (o) => o.id === id && o.companyId === companyId,
    );
    if (!opp) {
      throw new Error("Opportunité introuvable.");
    }

    if (patch.clientId !== undefined) {
      const client = db.clients.find(
        (c) => c.id === patch.clientId && c.companyId === companyId,
      );
      if (!client) {
        throw new Error("Client associé introuvable.");
      }
      opp.clientId = client.id;
      opp.clientName = client.name;
    }
    if (patch.title !== undefined) {
      if (!patch.title.trim()) {
        throw new Error("Le titre ne peut pas être vide.");
      }
      opp.title = patch.title.trim();
    }
    if (patch.amount !== undefined) {
      opp.amount = Math.max(0, Number(patch.amount) || 0);
    }
    if (patch.probability !== undefined) {
      opp.probability = Math.max(
        0,
        Math.min(100, Math.round(Number(patch.probability) || 0)),
      );
    }
    if (patch.stage !== undefined) opp.stage = patch.stage;
    if (patch.expectedCloseDate !== undefined) {
      opp.expectedCloseDate = patch.expectedCloseDate.trim();
    }
    if (patch.notes !== undefined) opp.notes = patch.notes.trim();
    opp.updatedAt = new Date().toISOString();

    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "opportunity.updated",
      `Opportunité mise à jour : ${opp.title}`,
    );
    saveDb(db);
    return { ...opp };
  },

  deleteOpportunity(id: string): void {
    const db = loadDb();
    const { user, companyId } = requireSession(db);
    const idx = db.opportunities.findIndex(
      (o) => o.id === id && o.companyId === companyId,
    );
    if (idx === -1) {
      throw new Error("Opportunité introuvable.");
    }
    const removed = db.opportunities[idx];
    db.opportunities.splice(idx, 1);
    appendActivity(
      db,
      companyId,
      toPublicUser(user),
      "opportunity.deleted",
      `Opportunité supprimée : ${removed.title}`,
    );
    saveDb(db);
  },
};
