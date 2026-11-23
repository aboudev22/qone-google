import { localErpStore } from "../lib/localErpStore";

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
  lastName?: string;
  companyName?: string;
  inviteToken?: string;
  seedDemoData?: boolean;
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

export const authApi = {
  async getBootstrapStatus(): Promise<{ needsSetup: boolean }> {
    return localErpStore.getBootstrapStatus();
  },

  async register(input: RegisterInput): Promise<AuthResponse> {
    return localErpStore.register(input);
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    return localErpStore.login(input);
  },

  async logout(): Promise<{ message: string }> {
    localErpStore.logout();
    return { message: "Déconnecté." };
  },

  async getMe(): Promise<AuthMeResponse | null> {
    return localErpStore.getMe();
  },

  async getInvitation(token: string): Promise<{ invitation: InvitationPreview }> {
    return { invitation: localErpStore.getInvitation(token) };
  },
};
