export interface ApiError {
  message: string;
  status: number;
}

class ApiClient {
  private activeCompanyId: string | null = null;

  setActiveCompanyId(id: string | null) {
    this.activeCompanyId = id;
    if (id) {
      sessionStorage.setItem("active_company_id", id);
    } else {
      sessionStorage.removeItem("active_company_id");
    }
  }

  getActiveCompanyId(): string | null {
    if (!this.activeCompanyId) {
      this.activeCompanyId = sessionStorage.getItem("active_company_id");
    }
    return this.activeCompanyId;
  }

  private buildHeaders(initial?: HeadersInit, isFormData = false): Headers {
    const headers = new Headers(initial || {});
    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("X-Requested-With")) {
      headers.set("X-Requested-With", "XMLHttpRequest");
    }
    const companyId = this.getActiveCompanyId();
    if (companyId && !headers.has("x-company-id")) {
      headers.set("x-company-id", companyId);
    }
    return headers;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isFormData = options.body instanceof FormData;
    const headers = this.buildHeaders(options.headers, isFormData);

    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: "include",
    });

    let data: unknown = null;
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    if (isJson) {
      data = await response.json().catch(() => null);
    } else {
      await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errObj =
        typeof data === "object" && data !== null
          ? (data as { error?: string; message?: string })
          : null;
      const errorMsg =
        errObj?.error || errObj?.message || `Erreur requête (${response.status})`;
      const error: ApiError = {
        message: errorMsg,
        status: response.status,
      };
      throw error;
    }

    if (!isJson || data === null) {
      throw {
        message:
          "Réponse inattendue du serveur. Veuillez recharger la page ou réessayer.",
        status: response.status || 500,
      } satisfies ApiError;
    }

    return data as T;
  }

  async downloadBlob(endpoint: string): Promise<Blob> {
    const headers = this.buildHeaders(undefined, true);
    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw {
        message: errData?.error || `Erreur export (${response.status})`,
        status: response.status,
      } satisfies ApiError;
    }

    return response.blob();
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  postForm<T>(endpoint: string, formData: FormData) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const api = new ApiClient();
