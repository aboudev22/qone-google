import type { DbAdapter, LogCategory } from "./types.js";

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL DEFAULT '',
    account_type TEXT NOT NULL DEFAULT 'company',
    job_title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    workspace_type TEXT NOT NULL DEFAULT 'company',
    enabled_modules TEXT NOT NULL DEFAULT '["crm","sales","stock","projects"]',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    department TEXT NOT NULL DEFAULT '',
    joined_at TEXT NOT NULL,
    UNIQUE(user_id, company_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_company ON memberships(company_id)`,
  `CREATE TABLE IF NOT EXISTS invitations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    project_id TEXT,
    project_name TEXT,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    invited_by_user_id TEXT NOT NULL,
    invited_by_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)`,
  `CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id)`,
  `CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    project_role TEXT NOT NULL DEFAULT 'contributor',
    added_by TEXT NOT NULL,
    added_at TEXT NOT NULL,
    UNIQUE(project_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    assignee_user_id TEXT,
    due_date TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_user_id)`,
  `CREATE TABLE IF NOT EXISTS stock_items (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Général',
    unit TEXT NOT NULL DEFAULT 'pcs',
    quantity INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 5,
    unit_price REAL NOT NULL DEFAULT 0,
    supplier TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stock_items_company ON stock_items(company_id)`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity_delta INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    actor_user_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id)`,
  `CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    probability INTEGER NOT NULL DEFAULT 50,
    stage TEXT NOT NULL DEFAULT 'prospecting',
    expected_close_date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    owner_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_opportunities_company ON opportunities(company_id)`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    actor_uid TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_email TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created ON activity_logs(company_id, created_at DESC)`,
];

export async function ensureSchema(db: DbAdapter): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    await db.execute(sql);
  }
}

export function makeId(): string {
  return globalThis.crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function writeActivityLog(
  db: DbAdapter,
  input: {
    companyId: string;
    actorUid: string;
    actorName: string;
    actorEmail: string;
    category: LogCategory;
    action: string;
    summary: string;
    details?: string;
  },
): Promise<void> {
  await db.execute(
    `INSERT INTO activity_logs (
      id, company_id, actor_uid, actor_name, actor_email, category, action, summary, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      makeId(),
      input.companyId,
      input.actorUid,
      input.actorName.slice(0, 160),
      input.actorEmail.slice(0, 180),
      input.category,
      input.action.slice(0, 80),
      input.summary.slice(0, 300),
      (input.details || "").slice(0, 500),
      nowIso(),
    ],
  );
}
