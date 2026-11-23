const RAW_API_BASE = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");

let inMemoryToken: string | null = null;
let inMemoryCompanyId: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function setActiveCompanyHeader(companyId: string | null): void {
  inMemoryCompanyId = companyId;
}

export function getActiveCompanyHeader(): string | null {
  return inMemoryCompanyId;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {
    "X-Requested-With": "qone-erp",
    ...(options.headers || {}),
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (inMemoryToken) {
    headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }
  if (inMemoryCompanyId) {
    headers["X-Company-Id"] = inMemoryCompanyId;
  }

  const url = `${RAW_API_BASE}${path}`;
  const response = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: unknown;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text ? { message: text } : null;
  }

  if (!response.ok) {
    const msg =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Erreur serveur (${response.status})`;
    throw new Error(msg);
  }

  return data as T;
}
