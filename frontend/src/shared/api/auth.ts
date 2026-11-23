import { apiRequest, setAuthToken } from "./http";

export type AccountType = "company" | "individual";
export type WorkspaceType = "company" | "personal";
export type Role = "owner" | "admin" | "member";
export type ModuleKey = "crm" | "sales" | "stock" | "projects";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  jobTitle?: string;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  workspaceType: WorkspaceType;
  role: Role;
  enabledModules?: ModuleKey[];
  member_since?: string;
}

export interface PendingInvitation {
  id: string;
  companyId: string;
  companyName: string;
  role: Role;
  projectId: string | null;
  projectName: string | null;
  token: string;
  invitedByName: string;
  createdAt: string;
  expiresAt: string;
}

export interface DirectoryUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  accountType: AccountType;
  jobTitle: string;
  alreadyMember: boolean;
  alreadyInvited: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  accountType: AccountType;
  companyName?: string;
  jobTitle?: string;
  inviteToken?: string;
  seedDemoData?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  mode?: AccountType;
  inviteToken?: string;
}

export interface AuthMeResponse {
  user: User;
  companies: Company[];
  pendingInvitations: PendingInvitation[];
  token?: string;
}

export interface AuthResponse {
  user: User;
  company?: Company;
  companies?: Company[];
  pendingInvitations?: PendingInvitation[];
  token?: string;
}

export interface InvitationPreview {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  companyName: string;
  projectName?: string | null;
}

export const authApi = {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
    });
    if (res.token) setAuthToken(res.token);
    return res;
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
    });
    if (res.token) setAuthToken(res.token);
    return res;
  },

  async logout(): Promise<{ message: string }> {
    try {
      return await apiRequest<{ message: string }>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      setAuthToken(null);
    }
  },

  async getMe(): Promise<AuthMeResponse | null> {
    try {
      const res = await apiRequest<AuthMeResponse>("/api/auth/me");
      if (res.token) setAuthToken(res.token);
      return res;
    } catch {
      setAuthToken(null);
      return null;
    }
  },

  async getInvitation(token: string): Promise<{ invitation: InvitationPreview }> {
    return apiRequest<{ invitation: InvitationPreview }>(
      `/api/auth/invitations/${encodeURIComponent(token)}`,
    );
  },

  async acceptInvitation(id: string): Promise<{
    companies: Company[];
    pendingInvitations: PendingInvitation[];
    joinedCompanyId: string;
  }> {
    return apiRequest(`/api/auth/invitations/${encodeURIComponent(id)}/accept`, {
      method: "POST",
    });
  },

  async declineInvitation(id: string): Promise<{
    pendingInvitations: PendingInvitation[];
  }> {
    return apiRequest(`/api/auth/invitations/${encodeURIComponent(id)}/decline`, {
      method: "POST",
    });
  },

  async searchUsers(query: string): Promise<{ users: DirectoryUser[] }> {
    const q = query.trim();
    if (q.length < 2) return { users: [] };
    return apiRequest(`/api/users/search?q=${encodeURIComponent(q)}`);
  },
};
