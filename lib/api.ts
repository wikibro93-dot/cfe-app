const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * Auth is sent via the httpOnly `cfe_token` cookie (set by /api/auth/verify-otp).
 * No token is read from storage and no Authorization header is sent —
 * `credentials: "same-origin"` lets the browser attach the cookie.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${endpoint}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
  patch: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, { method: "PATCH", body: JSON.stringify(data) }),
};
