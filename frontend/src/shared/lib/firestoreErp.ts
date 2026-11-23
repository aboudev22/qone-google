import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
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
import { auth, db, handleFirestoreError, OperationType } from "./firebase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === "string" && value) {
    return value;
  }
  return new Date().toISOString();
}

function makeSlug(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || "espace";
}

function splitDisplayName(fbUser: FirebaseUser): {
  firstName: string;
  lastName: string;
} {
  const display = (fbUser.displayName || "").trim();
  if (display) {
    const parts = display.split(/\s+/);
    return {
      firstName: parts[0].slice(0, 100),
      lastName: parts.slice(1).join(" ").slice(0, 100),
    };
  }
  const emailPrefix = (fbUser.email || "Utilisateur").split("@")[0];
  return {
    firstName: emailPrefix.slice(0, 100) || "Utilisateur",
    lastName: "",
  };
}

function requireFirebaseUser(): FirebaseUser {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }
  return fbUser;
}

export async function upsertUserProfile(fbUser: FirebaseUser): Promise<User> {
  const path = `users/${fbUser.uid}`;
  const ref = doc(db, "users", fbUser.uid);
  try {
    const snap = await getDoc(ref);
    const email = (fbUser.email || "").trim().toLowerCase();
    const fallbackNames = splitDisplayName(fbUser);

    if (snap.exists()) {
      const data = snap.data();
      if (email && data.email !== email) {
        await updateDoc(ref, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
      return {
        id: fbUser.uid,
        email: String(data.email || email),
        firstName: String(data.firstName || fallbackNames.firstName),
        lastName: String(data.lastName ?? fallbackNames.lastName),
        createdAt: tsToIso(data.createdAt),
      };
    }

    await setDoc(ref, {
      uid: fbUser.uid,
      email,
      firstName: fallbackNames.firstName,
      lastName: fallbackNames.lastName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: fbUser.uid,
      email,
      firstName: fallbackNames.firstName,
      lastName: fallbackNames.lastName,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateOwnUserNames(
  uid: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, "users", uid), {
      firstName: firstName.trim().slice(0, 100),
      lastName: lastName.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function loadUserCompanies(uid: string): Promise<Company[]> {
  const path = `users/${uid}/memberships`;
  try {
    const snap = await getDocs(collection(db, "users", uid, "memberships"));
    const companies = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.companyId || d.id),
        name: String(data.companyName || "Entreprise"),
        slug: String(data.companySlug || "espace"),
        role: (data.role as Role) || "member",
        enabledModules: (Array.isArray(data.enabledModules)
          ? data.enabledModules
          : ["crm", "sales"]) as ModuleKey[],
        member_since: tsToIso(data.joinedAt),
      };
    });
    companies.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return companies;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

async function getCompanyMemberUids(companyId: string): Promise<string[]> {
  const fbUser = requireFirebaseUser();
  const path = `companies/${companyId}`;
  try {
    const snap = await getDoc(doc(db, "companies", companyId));
    if (!snap.exists()) {
      return [fbUser.uid];
    }
    const uids = snap.data().memberUids;
    if (Array.isArray(uids) && uids.length > 0) {
      return uids.map(String);
    }
    return [fbUser.uid];
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function recordActivity(
  companyId: string,
  user: User,
  action: string,
  summary: string,
  memberUidsOverride?: string[],
): Promise<void> {
  try {
    const memberUids =
      memberUidsOverride && memberUidsOverride.length > 0
        ? memberUidsOverride
        : await getCompanyMemberUids(companyId);
    const id = crypto.randomUUID();
    const actorName =
      `${user.firstName} ${user.lastName}`.trim() || user.email || "Membre";
    await setDoc(doc(db, "companies", companyId, "activities", id), {
      id,
      companyId,
      actorUid: user.id,
      actorName: actorName.slice(0, 160),
      action: action.slice(0, 64),
      summary: summary.slice(0, 300),
      memberUids,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Activity log skipped:", err);
  }
}

export async function listActivities(
  companyId: string,
  maxItems = 12,
): Promise<ActivityLog[]> {
  const fbUser = requireFirebaseUser();
  const path = `companies/${companyId}/activities`;
  try {
    const q = query(
      collection(db, "companies", companyId, "activities"),
      where("memberUids", "array-contains", fbUser.uid),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        companyId: String(data.companyId || companyId),
        actorUid: String(data.actorUid || ""),
        actorName: String(data.actorName || "Membre"),
        action: String(data.action || ""),
        summary: String(data.summary || ""),
        createdAt: tsToIso(data.createdAt),
      };
    });
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items.slice(0, maxItems);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createCompanyWorkspace(input: {
  user: User;
  companyName: string;
  seedDemoData?: boolean;
}): Promise<Company> {
  const cleanName = input.companyName.trim().slice(0, 140);
  if (!cleanName) {
    throw new Error("Le nom de l'entreprise est obligatoire.");
  }

  const companyId = crypto.randomUUID();
  const slug = makeSlug(cleanName);
  const enabledModules: ModuleKey[] = ["crm", "sales"];
  const memberUids = [input.user.id];

  const batch = writeBatch(db);

  batch.set(doc(db, "companies", companyId), {
    id: companyId,
    name: cleanName,
    slug,
    ownerUid: input.user.id,
    memberUids,
    enabledModules,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, "companies", companyId, "members", input.user.id), {
    uid: input.user.id,
    companyId,
    email: input.user.email,
    firstName: input.user.firstName,
    lastName: input.user.lastName,
    role: "owner",
    memberUids,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, "users", input.user.id, "memberships", companyId), {
    companyId,
    companyName: cleanName,
    companySlug: slug,
    role: "owner",
    enabledModules,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const actId = crypto.randomUUID();
  const actorName =
    `${input.user.firstName} ${input.user.lastName}`.trim() || input.user.email;
  batch.set(doc(db, "companies", companyId, "activities", actId), {
    id: actId,
    companyId,
    actorUid: input.user.id,
    actorName,
    action: "company.created",
    summary: `Espace créé : ${cleanName}`,
    memberUids,
    createdAt: serverTimestamp(),
  });

  if (input.seedDemoData) {
    const sampleClients: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      companyName: string;
      status: ClientStatus;
      notes: string;
    }> = [
      {
        id: crypto.randomUUID(),
        name: "Claire Bernard",
        email: "claire@studio-b.fr",
        phone: "+33 6 12 34 56 78",
        companyName: "Studio B",
        status: "active",
        notes: "Compte annuel CRM et suivi commercial.",
      },
      {
        id: crypto.randomUUID(),
        name: "Marc Lefèvre",
        email: "marc@atelier-nord.fr",
        phone: "+33 6 98 76 54 32",
        companyName: "Atelier Nord",
        status: "prospect",
        notes: "Demande de démonstration équipe 12 personnes.",
      },
      {
        id: crypto.randomUUID(),
        name: "Nadia Khelifi",
        email: "nadia@khelifi-conseil.fr",
        phone: "+33 6 45 81 20 11",
        companyName: "Khelifi Conseil",
        status: "active",
        notes: "Déploiement multisite en cours.",
      },
      {
        id: crypto.randomUUID(),
        name: "Lucas Moreau",
        email: "lucas@moreau-logistique.fr",
        phone: "+33 6 77 10 34 90",
        companyName: "Moreau Logistique",
        status: "inactive",
        notes: "Relance prévue au prochain trimestre.",
      },
    ];

    for (const c of sampleClients) {
      batch.set(doc(db, "companies", companyId, "clients", c.id), {
        id: c.id,
        companyId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        companyName: c.companyName,
        status: c.status,
        notes: c.notes,
        createdByUid: input.user.id,
        memberUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const sampleOpps: Array<{
      clientIndex: number;
      title: string;
      amount: number;
      probability: number;
      stage: OpportunityStage;
      expectedCloseDate: string;
      notes: string;
    }> = [
      {
        clientIndex: 0,
        title: "Extension licences Studio B",
        amount: 6400,
        probability: 80,
        stage: "negotiation",
        expectedCloseDate: "2026-12-15",
        notes: "Validation juridique finale en cours.",
      },
      {
        clientIndex: 1,
        title: "Déploiement ERP Atelier Nord",
        amount: 12500,
        probability: 45,
        stage: "proposal",
        expectedCloseDate: "2027-01-10",
        notes: "Proposition commerciale envoyée.",
      },
      {
        clientIndex: 2,
        title: "Renouvellement annuel Khelifi",
        amount: 9200,
        probability: 100,
        stage: "won",
        expectedCloseDate: "2026-11-18",
        notes: "Contrat signé pour 12 mois.",
      },
      {
        clientIndex: 1,
        title: "Atelier import données Excel",
        amount: 2800,
        probability: 25,
        stage: "qualification",
        expectedCloseDate: "2027-01-25",
        notes: "Qualification technique programmée.",
      },
    ];

    for (const o of sampleOpps) {
      const client = sampleClients[o.clientIndex];
      const oppId = crypto.randomUUID();
      batch.set(doc(db, "companies", companyId, "opportunities", oppId), {
        id: oppId,
        companyId,
        clientId: client.id,
        clientName: client.name,
        title: o.title,
        amount: o.amount,
        probability: o.probability,
        stage: o.stage,
        expectedCloseDate: o.expectedCloseDate,
        notes: o.notes,
        ownerUserId: input.user.id,
        ownerName: actorName,
        memberUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `companies/${companyId}`);
  }

  return {
    id: companyId,
    name: cleanName,
    slug,
    role: "owner",
    enabledModules,
    member_since: new Date().toISOString(),
  };
}

export async function updateCompanySettings(
  companyId: string,
  user: User,
  patch: { name?: string; slug?: string; enabledModules?: ModuleKey[] },
): Promise<Company> {
  const path = `companies/${companyId}`;
  try {
    const compRef = doc(db, "companies", companyId);
    const snap = await getDoc(compRef);
    if (!snap.exists()) {
      throw new Error("Entreprise introuvable.");
    }
    const existing = snap.data();
    const nextName =
      patch.name !== undefined && patch.name.trim()
        ? patch.name.trim().slice(0, 140)
        : String(existing.name);
    const nextSlug =
      patch.slug !== undefined && patch.slug.trim()
        ? makeSlug(patch.slug)
        : String(existing.slug);
    const nextModules: ModuleKey[] = Array.isArray(patch.enabledModules)
      ? patch.enabledModules.filter((m): m is ModuleKey => m === "crm" || m === "sales")
      : (existing.enabledModules as ModuleKey[]);

    const membersSnap = await getDocs(
      query(
        collection(db, "companies", companyId, "members"),
        where("memberUids", "array-contains", user.id),
      ),
    );

    const batch = writeBatch(db);
    batch.update(compRef, {
      name: nextName,
      slug: nextSlug,
      enabledModules: nextModules,
      updatedAt: serverTimestamp(),
    });

    for (const mDoc of membersSnap.docs) {
      batch.update(doc(db, "users", mDoc.id, "memberships", companyId), {
        companyName: nextName,
        companySlug: nextSlug,
        enabledModules: nextModules,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await recordActivity(
      companyId,
      user,
      "company.updated",
      `Paramètres de l'entreprise mis à jour (${nextName})`,
      Array.isArray(existing.memberUids) ? existing.memberUids : [user.id],
    );

    const myMember = membersSnap.docs.find((d) => d.id === user.id);
    const role = (myMember?.data().role as Role) || "owner";

    return {
      id: companyId,
      name: nextName,
      slug: nextSlug,
      role,
      enabledModules: nextModules,
      member_since: tsToIso(existing.createdAt),
    };
  } catch (err) {
    if (err instanceof Error && err.message === "Entreprise introuvable.") {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function listClients(
  companyId: string,
  filters?: { search?: string; status?: string },
): Promise<Client[]> {
  const fbUser = requireFirebaseUser();
  const path = `companies/${companyId}/clients`;
  try {
    const q = query(
      collection(db, "companies", companyId, "clients"),
      where("memberUids", "array-contains", fbUser.uid),
    );
    const snap = await getDocs(q);
    let items: Client[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        companyId: String(data.companyId || companyId),
        name: String(data.name || ""),
        email: String(data.email || ""),
        phone: String(data.phone || ""),
        companyName: String(data.companyName || ""),
        status: (data.status as ClientStatus) || "active",
        notes: String(data.notes || ""),
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
      };
    });

    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (filters?.status && filters.status !== "all") {
      items = items.filter((c) => c.status === filters.status);
    }

    const search = (filters?.search || "").trim().toLowerCase();
    if (search) {
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.email.toLowerCase().includes(search) ||
          c.companyName.toLowerCase().includes(search) ||
          c.phone.toLowerCase().includes(search),
      );
    }

    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createClientRecord(
  companyId: string,
  user: User,
  input: {
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    status?: ClientStatus;
    notes?: string;
  },
): Promise<Client> {
  const cleanName = input.name.trim().slice(0, 160);
  if (!cleanName) {
    throw new Error("Le nom du client est obligatoire.");
  }
  const cleanEmail = (input.email || "").trim().toLowerCase().slice(0, 200);
  if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
    throw new Error("Adresse email invalide.");
  }

  const id = crypto.randomUUID();
  const path = `companies/${companyId}/clients/${id}`;
  try {
    const memberUids = await getCompanyMemberUids(companyId);
    const status: ClientStatus = input.status || "active";
    const phone = (input.phone || "").trim().slice(0, 60);
    const companyName = (input.companyName || "").trim().slice(0, 160);
    const notes = (input.notes || "").trim().slice(0, 2000);

    await setDoc(doc(db, "companies", companyId, "clients", id), {
      id,
      companyId,
      name: cleanName,
      email: cleanEmail,
      phone,
      companyName,
      status,
      notes,
      createdByUid: user.id,
      memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordActivity(
      companyId,
      user,
      "client.created",
      `Client ajouté : ${cleanName}`,
      memberUids,
    );

    const now = new Date().toISOString();
    return {
      id,
      companyId,
      name: cleanName,
      email: cleanEmail,
      phone,
      companyName,
      status,
      notes,
      createdAt: now,
      updatedAt: now,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateClientRecord(
  companyId: string,
  clientId: string,
  user: User,
  patch: Partial<{
    name: string;
    email: string;
    phone: string;
    companyName: string;
    status: ClientStatus;
    notes: string;
  }>,
): Promise<Client> {
  const path = `companies/${companyId}/clients/${clientId}`;
  try {
    const ref = doc(db, "companies", companyId, "clients", clientId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error("Client introuvable.");
    }
    const existing = snap.data();

    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.name !== undefined) {
      if (!patch.name.trim()) {
        throw new Error("Le nom du client ne peut pas être vide.");
      }
      updatePayload.name = patch.name.trim().slice(0, 160);
    }
    if (patch.email !== undefined) {
      const cleanEmail = patch.email.trim().toLowerCase().slice(0, 200);
      if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
        throw new Error("Adresse email invalide.");
      }
      updatePayload.email = cleanEmail;
    }
    if (patch.phone !== undefined) {
      updatePayload.phone = patch.phone.trim().slice(0, 60);
    }
    if (patch.companyName !== undefined) {
      updatePayload.companyName = patch.companyName.trim().slice(0, 160);
    }
    if (patch.status !== undefined) {
      updatePayload.status = patch.status;
    }
    if (patch.notes !== undefined) {
      updatePayload.notes = patch.notes.trim().slice(0, 2000);
    }

    await updateDoc(ref, updatePayload);
    const nextName = String(updatePayload.name ?? existing.name);
    await recordActivity(
      companyId,
      user,
      "client.updated",
      `Fiche client mise à jour : ${nextName}`,
      Array.isArray(existing.memberUids) ? existing.memberUids : [user.id],
    );

    return {
      id: clientId,
      companyId,
      name: nextName,
      email: String(updatePayload.email ?? existing.email ?? ""),
      phone: String(updatePayload.phone ?? existing.phone ?? ""),
      companyName: String(updatePayload.companyName ?? existing.companyName ?? ""),
      status: (updatePayload.status ?? existing.status ?? "active") as ClientStatus,
      notes: String(updatePayload.notes ?? existing.notes ?? ""),
      createdAt: tsToIso(existing.createdAt),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Client")) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteClientRecord(
  companyId: string,
  clientId: string,
  user: User,
): Promise<void> {
  const path = `companies/${companyId}/clients/${clientId}`;
  try {
    const ref = doc(db, "companies", companyId, "clients", clientId);
    const snap = await getDoc(ref);
    const name = snap.exists() ? String(snap.data().name || "") : clientId;
    const memberUids =
      snap.exists() && Array.isArray(snap.data().memberUids)
        ? snap.data().memberUids
        : undefined;
    await deleteDoc(ref);
    await recordActivity(
      companyId,
      user,
      "client.deleted",
      `Client supprimé : ${name}`,
      memberUids,
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function batchCommitImportedClients(
  companyId: string,
  user: User,
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
): Promise<{ imported: number; updated: number }> {
  const path = `companies/${companyId}/clients`;
  try {
    const memberUids = await getCompanyMemberUids(companyId);
    let imported = 0;
    let updated = 0;

    const CHUNK = 400;
    for (let i = 0; i < operations.length; i += CHUNK) {
      const slice = operations.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const op of slice) {
        if (op.type === "create") {
          const id = crypto.randomUUID();
          batch.set(doc(db, "companies", companyId, "clients", id), {
            id,
            companyId,
            name: op.data.name,
            email: op.data.email,
            phone: op.data.phone,
            companyName: op.data.companyName,
            status: op.data.status,
            notes: op.data.notes,
            createdByUid: user.id,
            memberUids,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          imported++;
        } else {
          batch.update(doc(db, "companies", companyId, "clients", op.clientId), {
            name: op.data.name,
            email: op.data.email,
            phone: op.data.phone,
            companyName: op.data.companyName,
            status: op.data.status,
            notes: op.data.notes,
            updatedAt: serverTimestamp(),
          });
          updated++;
        }
      }
      await batch.commit();
    }

    if (imported > 0 || updated > 0) {
      await recordActivity(
        companyId,
        user,
        "client.imported",
        `Import Excel : ${imported} créés, ${updated} mis à jour`,
        memberUids,
      );
    }

    return { imported, updated };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function listOpportunities(companyId: string): Promise<Opportunity[]> {
  const fbUser = requireFirebaseUser();
  const path = `companies/${companyId}/opportunities`;
  try {
    const q = query(
      collection(db, "companies", companyId, "opportunities"),
      where("memberUids", "array-contains", fbUser.uid),
    );
    const snap = await getDocs(q);
    const items: Opportunity[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        companyId: String(data.companyId || companyId),
        clientId: String(data.clientId || ""),
        clientName: String(data.clientName || ""),
        title: String(data.title || ""),
        amount: Number(data.amount || 0),
        probability: Number(data.probability || 0),
        stage: (data.stage as OpportunityStage) || "prospecting",
        expectedCloseDate: String(data.expectedCloseDate || ""),
        notes: String(data.notes || ""),
        ownerUserId: String(data.ownerUserId || ""),
        ownerName: String(data.ownerName || ""),
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
      };
    });
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function createOpportunityRecord(
  companyId: string,
  user: User,
  input: {
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate?: string;
    notes?: string;
  },
): Promise<Opportunity> {
  const cleanTitle = input.title.trim().slice(0, 180);
  if (!cleanTitle || !input.clientId) {
    throw new Error("Titre et client associé obligatoires.");
  }

  const id = crypto.randomUUID();
  const path = `companies/${companyId}/opportunities/${id}`;
  try {
    const [clientSnap, memberUids] = await Promise.all([
      getDoc(doc(db, "companies", companyId, "clients", input.clientId)),
      getCompanyMemberUids(companyId),
    ]);
    if (!clientSnap.exists()) {
      throw new Error("Client associé introuvable.");
    }
    const clientName = String(clientSnap.data().name || "").slice(0, 160);
    const ownerName =
      (`${user.firstName} ${user.lastName}`.trim() || user.email).slice(0, 160);
    const amount = Math.max(0, Number(input.amount) || 0);
    const probability = Math.min(100, Math.max(0, Number(input.probability) || 0));
    const expectedCloseDate = (input.expectedCloseDate || "").slice(0, 32);
    const notes = (input.notes || "").trim().slice(0, 2000);

    await setDoc(doc(db, "companies", companyId, "opportunities", id), {
      id,
      companyId,
      clientId: input.clientId,
      clientName,
      title: cleanTitle,
      amount,
      probability,
      stage: input.stage,
      expectedCloseDate,
      notes,
      ownerUserId: user.id,
      ownerName,
      memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordActivity(
      companyId,
      user,
      "opportunity.created",
      `Opportunité créée : ${cleanTitle}`,
      memberUids,
    );

    const now = new Date().toISOString();
    return {
      id,
      companyId,
      clientId: input.clientId,
      clientName,
      title: cleanTitle,
      amount,
      probability,
      stage: input.stage,
      expectedCloseDate,
      notes,
      ownerUserId: user.id,
      ownerName,
      createdAt: now,
      updatedAt: now,
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Client")) {
      throw err;
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateOpportunityRecord(
  companyId: string,
  oppId: string,
  user: User,
  patch: Partial<{
    clientId: string;
    title: string;
    amount: number;
    probability: number;
    stage: OpportunityStage;
    expectedCloseDate: string;
    notes: string;
  }>,
): Promise<Opportunity> {
  const path = `companies/${companyId}/opportunities/${oppId}`;
  try {
    const ref = doc(db, "companies", companyId, "opportunities", oppId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error("Opportunité introuvable.");
    }
    const existing = snap.data();

    const updatePayload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (patch.title !== undefined) {
      updatePayload.title = patch.title.trim().slice(0, 180);
    }
    if (patch.clientId !== undefined && patch.clientId !== existing.clientId) {
      const clientSnap = await getDoc(
        doc(db, "companies", companyId, "clients", patch.clientId),
      );
      if (!clientSnap.exists()) {
        throw new Error("Client associé introuvable.");
      }
      updatePayload.clientId = patch.clientId;
      updatePayload.clientName = String(clientSnap.data().name || "").slice(0, 160);
    }
    if (patch.amount !== undefined) {
      updatePayload.amount = Math.max(0, Number(patch.amount) || 0);
    }
    if (patch.probability !== undefined) {
      updatePayload.probability = Math.min(
        100,
        Math.max(0, Number(patch.probability) || 0),
      );
    }
    if (patch.stage !== undefined) {
      updatePayload.stage = patch.stage;
    }
    if (patch.expectedCloseDate !== undefined) {
      updatePayload.expectedCloseDate = patch.expectedCloseDate.slice(0, 32);
    }
    if (patch.notes !== undefined) {
      updatePayload.notes = patch.notes.trim().slice(0, 2000);
    }

    await updateDoc(ref, updatePayload);
    const nextTitle = String(updatePayload.title ?? existing.title);
    await recordActivity(
      companyId,
      user,
      "opportunity.updated",
      patch.stage
        ? `Opportunité déplacée (${nextTitle})`
        : `Opportunité modifiée : ${nextTitle}`,
      Array.isArray(existing.memberUids) ? existing.memberUids : [user.id],
    );

    return {
      id: oppId,
      companyId,
      clientId: String(updatePayload.clientId ?? existing.clientId),
      clientName: String(updatePayload.clientName ?? existing.clientName ?? ""),
      title: nextTitle,
      amount: Number(updatePayload.amount ?? existing.amount ?? 0),
      probability: Number(updatePayload.probability ?? existing.probability ?? 0),
      stage: (updatePayload.stage ?? existing.stage ?? "prospecting") as OpportunityStage,
      expectedCloseDate: String(
        updatePayload.expectedCloseDate ?? existing.expectedCloseDate ?? "",
      ),
      notes: String(updatePayload.notes ?? existing.notes ?? ""),
      ownerUserId: String(existing.ownerUserId || ""),
      ownerName: String(existing.ownerName || ""),
      createdAt: tsToIso(existing.createdAt),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && (err.message.includes("Opportunité") || err.message.includes("Client"))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteOpportunityRecord(
  companyId: string,
  oppId: string,
  user: User,
): Promise<void> {
  const path = `companies/${companyId}/opportunities/${oppId}`;
  try {
    const ref = doc(db, "companies", companyId, "opportunities", oppId);
    const snap = await getDoc(ref);
    const title = snap.exists() ? String(snap.data().title || "") : oppId;
    const memberUids =
      snap.exists() && Array.isArray(snap.data().memberUids)
        ? snap.data().memberUids
        : undefined;
    await deleteDoc(ref);
    await recordActivity(
      companyId,
      user,
      "opportunity.deleted",
      `Opportunité supprimée : ${title}`,
      memberUids,
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function listTeam(companyId: string): Promise<{
  members: TeamMember[];
  invitations: TeamInvitation[];
}> {
  const fbUser = requireFirebaseUser();
  const membersPath = `companies/${companyId}/members`;
  const invitesPath = `invitations`;
  try {
    const [membersSnap, invitesSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "companies", companyId, "members"),
          where("memberUids", "array-contains", fbUser.uid),
        ),
      ),
      getDocs(
        query(
          collection(db, "invitations"),
          where("memberUids", "array-contains", fbUser.uid),
        ),
      ),
    ]);

    const members: TeamMember[] = membersSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: String(data.uid || d.id),
        email: String(data.email || ""),
        firstName: String(data.firstName || ""),
        lastName: String(data.lastName || ""),
        role: (data.role as Role) || "member",
        joinedAt: tsToIso(data.joinedAt),
      };
    });

    const invitations: TeamInvitation[] = invitesSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          companyId: String(data.companyId || ""),
          email: String(data.email || ""),
          firstName: String(data.firstName || ""),
          lastName: String(data.lastName || ""),
          role: (data.role as Role) || "member",
          token: String(data.id || d.id),
          status: (data.status as "pending" | "accepted" | "revoked") || "pending",
          createdAt: tsToIso(data.createdAt),
          expiresAt: String(data.expiresAt || ""),
        };
      })
      .filter((inv) => inv.companyId === companyId && inv.status === "pending");

    return { members, invitations };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `${membersPath}|${invitesPath}`);
  }
}

export async function createTeamInvitation(
  company: Company,
  user: User,
  input: { email: string; firstName?: string; lastName?: string; role: Role },
): Promise<TeamInvitation> {
  const cleanEmail = input.email.trim().toLowerCase().slice(0, 200);
  if (!EMAIL_RE.test(cleanEmail)) {
    throw new Error("Adresse email invalide.");
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const path = `invitations/${token}`;
  try {
    const [memberUids, compSnap] = await Promise.all([
      getCompanyMemberUids(company.id),
      getDoc(doc(db, "companies", company.id)),
    ]);
    const realCompanyName = compSnap.exists()
      ? String(compSnap.data().name || company.name)
      : company.name;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const firstName = (input.firstName || "").trim().slice(0, 100);
    const lastName = (input.lastName || "").trim().slice(0, 100);

    await setDoc(doc(db, "invitations", token), {
      id: token,
      companyId: company.id,
      companyName: realCompanyName.slice(0, 140),
      email: cleanEmail,
      firstName,
      lastName,
      role: input.role,
      status: "pending",
      invitedByUid: user.id,
      memberUids,
      expiresAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await recordActivity(
      company.id,
      user,
      "team.invited",
      `Invitation envoyée à ${cleanEmail}`,
      memberUids,
    );

    return {
      id: token,
      companyId: company.id,
      email: cleanEmail,
      firstName,
      lastName,
      role: input.role,
      token,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function revokeTeamInvitation(
  companyId: string,
  inviteId: string,
  user: User,
): Promise<void> {
  const path = `invitations/${inviteId}`;
  try {
    await updateDoc(doc(db, "invitations", inviteId), {
      status: "revoked",
      updatedAt: serverTimestamp(),
    });
    await recordActivity(
      companyId,
      user,
      "team.invitation_revoked",
      "Invitation révoquée",
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function previewInvitationForSignedInUser(token: string) {
  const path = `invitations/${token}`;
  try {
    const snap = await getDoc(doc(db, "invitations", token));
    if (!snap.exists()) {
      throw new Error("Invitation introuvable ou réservée à un autre compte Google.");
    }
    const data = snap.data();
    if (data.status !== "pending") {
      throw new Error("Cette invitation a déjà été utilisée ou révoquée.");
    }
    return {
      id: String(data.id || token),
      companyId: String(data.companyId),
      companyName: String(data.companyName || "Entreprise"),
      email: String(data.email || ""),
      firstName: String(data.firstName || ""),
      lastName: String(data.lastName || ""),
      role: (data.role as Role) || "member",
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invitation")) {
      throw err;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function acceptTeamInvitation(
  token: string,
  user: User,
): Promise<Company> {
  const invPath = `invitations/${token}`;
  try {
    const invSnap = await getDoc(doc(db, "invitations", token));
    if (!invSnap.exists()) {
      throw new Error("Invitation introuvable ou inaccessible.");
    }
    const inv = invSnap.data();
    if (inv.status !== "pending") {
      throw new Error("Cette invitation n'est plus active.");
    }
    const companyId = String(inv.companyId);
    const compSnap = await getDoc(doc(db, "companies", companyId));
    const existingMemberUids = compSnap.exists() && Array.isArray(compSnap.data().memberUids)
      ? compSnap.data().memberUids.map(String)
      : [String(inv.invitedByUid), user.id];
    const nextMemberUids = Array.from(new Set([...existingMemberUids, user.id]));
    const companyName = String(inv.companyName || compSnap.data()?.name || "Entreprise");
    const companySlug = makeSlug(companyName);
    const enabledModules: ModuleKey[] = compSnap.exists() && Array.isArray(compSnap.data().enabledModules)
      ? (compSnap.data().enabledModules as ModuleKey[])
      : ["crm", "sales"];
    const role = (inv.role as Role) || "member";

    const batch = writeBatch(db);
    batch.update(doc(db, "invitations", token), {
      status: "accepted",
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, "companies", companyId), {
      memberUids: arrayUnion(user.id),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "companies", companyId, "members", user.id), {
      uid: user.id,
      companyId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      inviteToken: token,
      memberUids: nextMemberUids,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "users", user.id, "memberships", companyId), {
      companyId,
      companyName,
      companySlug,
      role,
      enabledModules,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    return {
      id: companyId,
      name: companyName,
      slug: companySlug,
      role,
      enabledModules,
      member_since: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invitation")) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, invPath);
  }
}

export async function updateMemberRoleRecord(
  companyId: string,
  memberUid: string,
  nextRole: Role,
  user: User,
): Promise<TeamMember> {
  const path = `companies/${companyId}/members/${memberUid}`;
  try {
    const memberRef = doc(db, "companies", companyId, "members", memberUid);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      throw new Error("Collaborateur introuvable.");
    }
    const data = snap.data();
    const batch = writeBatch(db);
    batch.update(memberRef, {
      role: nextRole,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, "users", memberUid, "memberships", companyId), {
      role: nextRole,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await recordActivity(
      companyId,
      user,
      "team.role_updated",
      `Rôle mis à jour pour ${data.firstName || data.email}`,
    );

    return {
      id: memberUid,
      userId: memberUid,
      email: String(data.email || ""),
      firstName: String(data.firstName || ""),
      lastName: String(data.lastName || ""),
      role: nextRole,
      joinedAt: tsToIso(data.joinedAt),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function removeCompanyMember(
  companyId: string,
  memberUid: string,
  user: User,
): Promise<void> {
  const path = `companies/${companyId}/members/${memberUid}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "companies", companyId, "members", memberUid));
    batch.delete(doc(db, "users", memberUid, "memberships", companyId));
    batch.update(doc(db, "companies", companyId), {
      memberUids: arrayRemove(memberUid),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    await recordActivity(
      companyId,
      user,
      "team.member_removed",
      "Collaborateur retiré de l'espace",
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
