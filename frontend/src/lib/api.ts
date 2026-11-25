const BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const TOKEN_KEY = 'fincollect.token';

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: Record<string, string> = {}) {
    super(message);
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers what to do when the API rejects the session (e.g. sign the user out). */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch { /* storage unavailable: session lasts until reload */ }
  },
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.');
  }

  const data = await res.json().catch(() => null);
  // The API always answers in JSON; an empty 5xx comes from the dev proxy when the backend is down.
  if (!res.ok && data === null && res.status >= 500) {
    throw new ApiError(res.status, 'Cannot reach the server. Check that the backend is running.');
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') unauthorizedHandler?.();
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`, data?.errors ?? {});
  }
  return data as T;
}

/** URL of a file the API stores, e.g. a customer photo path such as uploads/customers/….jpg */
export const fileUrl = (path: string) => `${BASE_URL}/${path}`;

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T = { ok: boolean }>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  put: <T = { ok: boolean }>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T = { ok: boolean }>(path: string) => request<T>('DELETE', path),
};
