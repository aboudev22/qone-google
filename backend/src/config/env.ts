export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL?.trim() || "",
  sessionCookieName: "qone_session",
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  maxImportFileBytes: 5 * 1024 * 1024,
};
