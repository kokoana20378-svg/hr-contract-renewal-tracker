// API base URL - in web mode uses relative path, in APK mode uses the configured server
const getApiBase = (): string => {
  if (window.location.protocol === "capacitor:" || window.location.protocol === "file:") {
    const saved = localStorage.getItem("api_server_url");
    return saved || "http://10.0.2.2:3000";
  }
  return "/api";
};

export const API_BASE = getApiBase();

export function setApiServer(url: string) {
  localStorage.setItem("api_server_url", url.replace(/\/+$/, ""));
}

export function getApiServer(): string {
  return localStorage.getItem("api_server_url") || "";
}

export function api(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = api(path);
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
  }

  return res.json();
}
