import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { getStore } from "../db/store.js";
import { hashToken } from "../modules/auth/password.js";
import type { CompanyRecord, Role, UserRecord } from "../shared/types.js";

export interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
  sessionTokenHash?: string;
  companyContext?: {
    companyId: string;
    role: Role;
    company: CompanyRecord;
  };
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.headers["x-forwarded-proto"];
  if (typeof proto === "string" && proto.split(",")[0].trim() === "https") {
    return true;
  }
  return Boolean(req.secure);
}

export function setSessionCookie(
  req: Request,
  res: Response,
  rawToken: string,
): void {
  const secure = isHttpsRequest(req);
  res.cookie(env.sessionCookieName, rawToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    partitioned: secure,
    path: "/",
    maxAge: env.sessionTtlMs,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  res.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    partitioned: secure,
    path: "/",
  });
}

export function csrfGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const xRequestedWith = req.headers["x-requested-with"];
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  if (origin && typeof host === "string") {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host.split(",")[0].trim()) {
        next();
        return;
      }
    } catch {
      res.status(403).json({ error: "Origine de requête invalide." });
      return;
    }
  }

  if (xRequestedWith === "XMLHttpRequest") {
    next();
    return;
  }

  if (!origin) {
    next();
    return;
  }

  res.status(403).json({ error: "Requête bloquée par la protection CSRF." });
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[env.sessionCookieName];
  if (!rawToken) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }

  const tokenHash = hashToken(rawToken);
  const store = getStore();
  const session = await store.findSessionByTokenHash(tokenHash);
  if (!session) {
    clearSessionCookie(req, res);
    res.status(401).json({ error: "Session expirée ou invalide." });
    return;
  }

  const user = await store.findUserById(session.userId);
  if (!user) {
    clearSessionCookie(req, res);
    res.status(401).json({ error: "Utilisateur introuvable." });
    return;
  }

  req.authUser = user;
  req.sessionTokenHash = tokenHash;
  next();
}

export function requireCompany(allowedRoles?: Role[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "Authentification requise." });
      return;
    }

    const store = getStore();
    const headerCompanyId = req.headers["x-company-id"];
    let targetCompanyId =
      typeof headerCompanyId === "string" && headerCompanyId.trim()
        ? headerCompanyId.trim()
        : "";

    if (!targetCompanyId) {
      const companies = await store.listCompaniesForUser(user.id);
      if (companies.length === 0) {
        res.status(403).json({ error: "Aucune entreprise associée à ce compte." });
        return;
      }
      targetCompanyId = companies[0].id;
    }

    const membership = await store.getMembership(user.id, targetCompanyId);
    if (!membership) {
      res.status(403).json({ error: "Accès refusé à cette entreprise." });
      return;
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      res.status(403).json({
        error: "Permissions insuffisantes pour effectuer cette action.",
      });
      return;
    }

    const company = await store.findCompanyById(targetCompanyId);
    if (!company) {
      res.status(404).json({ error: "Entreprise introuvable." });
      return;
    }

    req.companyContext = {
      companyId: company.id,
      role: membership.role,
      company,
    };
    next();
  };
}
