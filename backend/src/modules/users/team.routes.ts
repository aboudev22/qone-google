import { Router } from "express";
import { getStore } from "../../db/store.js";
import {
  requireAuth,
  requireCompany,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { generateOpaqueToken } from "../auth/password.js";
import type { Role } from "../../shared/types.js";

export const teamRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: Role[] = ["owner", "admin", "member"];

teamRouter.use(requireAuth);

teamRouter.get(
  "/",
  requireCompany(),
  async (req: AuthenticatedRequest, res) => {
    const store = getStore();
    const companyId = req.companyContext!.companyId;
    const [members, invitations] = await Promise.all([
      store.listTeamMembers(companyId),
      store.listInvitations(companyId),
    ]);
    res.json({ members, invitations });
  },
);

teamRouter.post(
  "/invitations",
  requireCompany(["owner", "admin"]),
  async (req: AuthenticatedRequest, res) => {
    const { email, firstName, lastName, role } = req.body ?? {};
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      res.status(400).json({ error: "Adresse email invalide." });
      return;
    }

    const assignedRole: Role =
      role === "admin" || role === "member" || role === "owner"
        ? role
        : "member";

    if (assignedRole === "owner" && req.companyContext!.role !== "owner") {
      res.status(403).json({
        error: "Seul un propriétaire peut attribuer le rôle de propriétaire.",
      });
      return;
    }

    const store = getStore();
    const companyId = req.companyContext!.companyId;
    const normalizedEmail = email.trim().toLowerCase();

    const members = await store.listTeamMembers(companyId);
    if (members.some((m) => m.email.toLowerCase() === normalizedEmail)) {
      res.status(409).json({
        error: "Cet utilisateur fait déjà partie de l'entreprise.",
      });
      return;
    }

    const existingUser = await store.findUserByEmail(normalizedEmail);
    if (existingUser) {
      await store.addMembership({
        userId: existingUser.id,
        companyId,
        role: assignedRole,
      });
      const updatedMembers = await store.listTeamMembers(companyId);
      res.status(201).json({
        addedDirectly: true,
        members: updatedMembers,
      });
      return;
    }

    const token = generateOpaqueToken(16);
    const invitation = await store.createInvitation({
      companyId,
      email: normalizedEmail,
      firstName: typeof firstName === "string" ? firstName : "",
      lastName: typeof lastName === "string" ? lastName : "",
      role: assignedRole,
      token,
      invitedByUserId: req.authUser!.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    res.status(201).json({
      addedDirectly: false,
      invitation,
    });
  },
);

teamRouter.delete(
  "/invitations/:id",
  requireCompany(["owner", "admin"]),
  async (req: AuthenticatedRequest, res) => {
    const ok = await getStore().revokeInvitation(
      req.companyContext!.companyId,
      String(req.params.id),
    );
    if (!ok) {
      res.status(404).json({ error: "Invitation introuvable." });
      return;
    }
    res.json({ message: "Invitation révoquée." });
  },
);

teamRouter.patch(
  "/members/:id/role",
  requireCompany(["owner", "admin"]),
  async (req: AuthenticatedRequest, res) => {
    const { role } = req.body ?? {};
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: "Rôle invalide." });
      return;
    }

    const store = getStore();
    const companyId = req.companyContext!.companyId;
    const members = await store.listTeamMembers(companyId);
    const target = members.find((m) => m.id === String(req.params.id));

    if (!target) {
      res.status(404).json({ error: "Membre introuvable." });
      return;
    }

    if (
      (target.role === "owner" || role === "owner") &&
      req.companyContext!.role !== "owner"
    ) {
      res.status(403).json({
        error: "Seul un propriétaire peut modifier ce niveau de rôle.",
      });
      return;
    }

    const ownerCount = members.filter((m) => m.role === "owner").length;
    if (target.role === "owner" && role !== "owner" && ownerCount <= 1) {
      res.status(400).json({
        error: "L'entreprise doit conserver au moins un propriétaire.",
      });
      return;
    }

    const updated = await store.updateMembershipRole(
      companyId,
      target.id,
      role,
    );
    res.json({ member: updated });
  },
);

teamRouter.delete(
  "/members/:id",
  requireCompany(["owner", "admin"]),
  async (req: AuthenticatedRequest, res) => {
    const store = getStore();
    const companyId = req.companyContext!.companyId;
    const members = await store.listTeamMembers(companyId);
    const target = members.find((m) => m.id === String(req.params.id));

    if (!target) {
      res.status(404).json({ error: "Membre introuvable." });
      return;
    }

    if (target.userId === req.authUser!.id) {
      res.status(400).json({
        error: "Vous ne pouvez pas retirer votre propre accès ici.",
      });
      return;
    }

    if (target.role === "owner" && req.companyContext!.role !== "owner") {
      res.status(403).json({
        error: "Seul un propriétaire peut retirer un autre propriétaire.",
      });
      return;
    }

    const ownerCount = members.filter((m) => m.role === "owner").length;
    if (target.role === "owner" && ownerCount <= 1) {
      res.status(400).json({
        error: "Impossible de retirer le dernier propriétaire.",
      });
      return;
    }

    await store.removeMembership(companyId, target.id);
    res.json({ message: "Membre retiré de l'entreprise." });
  },
);
