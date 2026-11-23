import { Router } from "express";
import { env } from "../../config/env.js";
import { getStore, toPublicUser } from "../../db/store.js";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "./password.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.get("/bootstrap-status", async (_req, res) => {
  const hasUsers = await getStore().hasAnyUsers();
  res.json({ needsSetup: !hasUsers });
});

authRouter.post("/bootstrap-demo", async (req, res) => {
  const store = getStore();
  if (await store.hasAnyUsers()) {
    res.status(409).json({
      error: "Un espace est déjà configuré. Veuillez vous connecter.",
    });
    return;
  }

  const {
    email,
    password,
    firstName,
    lastName,
    companyName,
    seedDemoData = true,
  } = req.body ?? {};

  if (
    typeof email !== "string" ||
    !EMAIL_RE.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    typeof firstName !== "string" ||
    !firstName.trim() ||
    typeof lastName !== "string" ||
    !lastName.trim() ||
    typeof companyName !== "string" ||
    !companyName.trim()
  ) {
    res.status(400).json({
      error:
        "Veuillez renseigner tous les champs et un mot de passe d'au moins 8 caractères.",
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await store.createUser({
    email: email.trim().toLowerCase(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    passwordHash,
  });

  const company = await store.createCompanyWithOwner({
    userId: user.id,
    name: companyName.trim(),
  });

  if (seedDemoData) {
    const c1 = await store.createClient({
      companyId: company.id,
      name: "Camille Laurent",
      email: "camille@atelier-horizon.fr",
      phone: "+33 6 12 45 78 90",
      companyName: "Atelier Horizon",
      status: "active",
      notes: "Client historique — facturation mensuelle",
    });
    const c2 = await store.createClient({
      companyId: company.id,
      name: "Thomas Moreau",
      email: "t.moreau@nordic-log.fr",
      phone: "+33 6 44 89 10 22",
      companyName: "Nordic Logistics",
      status: "active",
      notes: "Déploiement multi-sites prévu au T2",
    });
    const c3 = await store.createClient({
      companyId: company.id,
      name: "Nadia Benali",
      email: "nadia@maison-clair.fr",
      phone: "+33 7 81 20 33 14",
      companyName: "Maison Clair",
      status: "prospect",
      notes: "Demande de démonstration suite au salon",
    });
    await store.createClient({
      companyId: company.id,
      name: "Julien Mercier",
      email: "j.mercier@agence-vesper.fr",
      phone: "+33 6 98 11 04 55",
      companyName: "Agence Vesper",
      status: "inactive",
      notes: "Contrat terminé en fin d'exercice",
    });

    await store.createOpportunity({
      companyId: company.id,
      clientId: c1.id,
      title: "Extension licences équipe",
      amount: 4800,
      probability: 80,
      stage: "negotiation",
      expectedCloseDate: "2026-12-15",
      notes: "Validation finale en cours avec la direction",
      ownerUserId: user.id,
    });
    await store.createOpportunity({
      companyId: company.id,
      clientId: c2.id,
      title: "Pack CRM & Import annuel",
      amount: 9200,
      probability: 55,
      stage: "proposal",
      expectedCloseDate: "2026-12-28",
      notes: "Proposition envoyée",
      ownerUserId: user.id,
    });
    await store.createOpportunity({
      companyId: company.id,
      clientId: c3.id,
      title: "Onboarding initial",
      amount: 2400,
      probability: 30,
      stage: "qualification",
      expectedCloseDate: "2027-01-12",
      notes: "Qualification des besoins équipe",
      ownerUserId: user.id,
    });
    await store.createOpportunity({
      companyId: company.id,
      clientId: c1.id,
      title: "Audit données & migration",
      amount: 3100,
      probability: 100,
      stage: "won",
      expectedCloseDate: "2026-11-10",
      notes: "Signé",
      ownerUserId: user.id,
    });

    await store.createInvitation({
      companyId: company.id,
      email: "sami.morel@studio-qone.fr",
      firstName: "Sami",
      lastName: "Morel",
      role: "admin",
      token: generateOpaqueToken(16),
      invitedByUserId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  const rawSessionToken = generateOpaqueToken(32);
  await store.createSession({
    tokenHash: hashToken(rawSessionToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + env.sessionTtlMs).toISOString(),
  });
  setSessionCookie(req, res, rawSessionToken);

  const companies = await store.listCompaniesForUser(user.id);
  res.status(201).json({
    user: toPublicUser(user),
    company,
    companies,
  });
});

authRouter.get("/invitation/:token", async (req, res) => {
  const token = String(req.params.token ?? "").trim();
  if (!token) {
    res.status(400).json({ error: "Jeton d'invitation manquant." });
    return;
  }

  const store = getStore();
  const inv = await store.findInvitationByToken(token);
  if (!inv) {
    res.status(404).json({ error: "Invitation invalide ou expirée." });
    return;
  }

  res.json({
    invitation: {
      email: inv.email,
      firstName: inv.firstName,
      lastName: inv.lastName,
      role: inv.role,
      companyName: inv.companyName,
    },
  });
});

authRouter.post("/register", async (req, res) => {
  const { email, password, firstName, lastName, companyName, inviteToken } =
    req.body ?? {};

  if (
    typeof email !== "string" ||
    !EMAIL_RE.test(email.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    typeof firstName !== "string" ||
    !firstName.trim() ||
    typeof lastName !== "string" ||
    !lastName.trim()
  ) {
    res.status(400).json({
      error:
        "Veuillez fournir un prénom, nom, email valide et un mot de passe d'au moins 8 caractères.",
    });
    return;
  }

  const store = getStore();
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await store.findUserByEmail(normalizedEmail);
  if (existingUser) {
    res.status(409).json({
      error: "Un compte existe déjà avec cette adresse email.",
    });
    return;
  }

  let invitation = null;
  if (typeof inviteToken === "string" && inviteToken.trim()) {
    invitation = await store.findInvitationByToken(inviteToken.trim());
    if (!invitation) {
      res.status(400).json({ error: "Cette invitation est invalide ou expirée." });
      return;
    }
    if (invitation.email.toLowerCase() !== normalizedEmail) {
      res.status(400).json({
        error: `Cette invitation est réservée à l'adresse ${invitation.email}.`,
      });
      return;
    }
  } else if (typeof companyName !== "string" || !companyName.trim()) {
    res.status(400).json({
      error: "Veuillez renseigner le nom de votre entreprise.",
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await store.createUser({
    email: normalizedEmail,
    firstName,
    lastName,
    passwordHash,
  });

  if (invitation) {
    await store.addMembership({
      userId: user.id,
      companyId: invitation.companyId,
      role: invitation.role,
    });
    await store.markInvitationAccepted(invitation.id);
  } else {
    await store.createCompanyWithOwner({
      userId: user.id,
      name: String(companyName),
    });
  }

  const rawSessionToken = generateOpaqueToken(32);
  await store.createSession({
    tokenHash: hashToken(rawSessionToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + env.sessionTtlMs).toISOString(),
  });
  setSessionCookie(req, res, rawSessionToken);

  const companies = await store.listCompaniesForUser(user.id);
  res.status(201).json({
    user: toPublicUser(user),
    company: companies[0],
    companies,
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password, inviteToken } = req.body ?? {};
  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    res.status(400).json({ error: "Email et mot de passe requis." });
    return;
  }

  const store = getStore();
  const user = await store.findUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: "Identifiants invalides." });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Identifiants invalides." });
    return;
  }

  if (typeof inviteToken === "string" && inviteToken.trim()) {
    const invitation = await store.findInvitationByToken(inviteToken.trim());
    if (
      invitation &&
      invitation.email.toLowerCase() === user.email.toLowerCase()
    ) {
      await store.addMembership({
        userId: user.id,
        companyId: invitation.companyId,
        role: invitation.role,
      });
      await store.markInvitationAccepted(invitation.id);
    }
  }

  const rawSessionToken = generateOpaqueToken(32);
  await store.createSession({
    tokenHash: hashToken(rawSessionToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + env.sessionTtlMs).toISOString(),
  });
  setSessionCookie(req, res, rawSessionToken);

  const companies = await store.listCompaniesForUser(user.id);
  res.json({
    user: toPublicUser(user),
    companies,
  });
});

authRouter.post("/logout", async (req: AuthenticatedRequest, res) => {
  const cookiesHeader = req.headers.cookie;
  if (cookiesHeader) {
    const match = cookiesHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${env.sessionCookieName}=`));
    if (match) {
      const rawToken = decodeURIComponent(
        match.slice(env.sessionCookieName.length + 1),
      );
      await getStore().deleteSessionByTokenHash(hashToken(rawToken));
    }
  }
  clearSessionCookie(req, res);
  res.json({ message: "Déconnecté." });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.authUser!;
  const companies = await getStore().listCompaniesForUser(user.id);
  res.json({
    user: toPublicUser(user),
    companies,
  });
});
