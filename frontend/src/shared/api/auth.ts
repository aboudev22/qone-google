import { api } from "./client";

export type Role = "owner" | "admin" | "member";
export type ModuleKey = "crm" | "sales";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  role: Role;
  enabledModules?: ModuleKey[];
  member_since?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  inviteToken?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  inviteToken?: string;
}

export interface AuthMeResponse {
  user: User;
  companies: Company[];
}

export interface AuthResponse {
  user: User;
  company?: Company;
  companies?: Company[];
}

export interface InvitationPreview {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  companyName: string;
}

export interface BootstrapDemoInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  seedDemoData?: boolean;
}

export const authApi = {
  getBootstrapStatus() {
    return api.get<{ needsSetup: boolean }>("/api/auth/bootstrap-status");
  },

  bootstrapDemo(input: BootstrapDemoInput) {
    return api.post<AuthResponse>("/api/auth/bootstrap-demo", input);
  },

  register(input: RegisterInput) {
    return api.post<AuthResponse>("/api/auth/register", input);
  },

  login(input: LoginInput) {
    return api.post<AuthResponse>("/api/auth/login", input);
  },

  logout() {
    return api.post<{ message: string }>("/api/auth/logout");
  },

  getMe() {
    return api.get<AuthMeResponse>("/api/auth/me");
  },

  getInvitation(token: string) {
    return api.get<{ invitation: InvitationPreview }>(
      `/api/auth/invitation/${encodeURIComponent(token)}`,
    );
  },
};
