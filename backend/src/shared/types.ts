export type Role = "owner" | "admin" | "member";

export type ModuleKey = "crm" | "sales";

export type ClientStatus = "active" | "prospect" | "inactive";

export type OpportunityStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface CompanyRecord {
  id: string;
  name: string;
  slug: string;
  enabledModules: ModuleKey[];
  createdAt: string;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  companyId: string;
  role: Role;
  createdAt: string;
}

export interface CompanyWithRole extends CompanyRecord {
  role: Role;
  member_since: string;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationRecord {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  token: string;
  invitedByUserId: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  expiresAt: string;
}

export interface ClientRecord {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  status: ClientStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityRecord {
  id: string;
  companyId: string;
  clientId: string;
  clientName?: string;
  title: string;
  amount: number;
  probability: number;
  stage: OpportunityStage;
  expectedCloseDate: string;
  notes: string;
  ownerUserId: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberView {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  joinedAt: string;
}
